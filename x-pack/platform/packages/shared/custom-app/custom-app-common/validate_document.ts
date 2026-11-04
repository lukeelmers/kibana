/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { z } from '@kbn/zod/v4';
import { CUSTOM_CONTENT_SCRIPT_PATTERN } from '@kbn/custom-content-common';
import {
  CASES_FILTERS,
  CASES_SEVERITIES,
  CASES_STATUSES,
  MAX_DECLARED_QUERIES,
  MAX_NODE_COUNT,
  MAX_NODE_DEPTH,
  MAX_STATE_KEYS,
  TEXT_FILTERS,
} from './constants';
import type { AppNode, AppTheme, DeclaredQuery, StateDeclaration } from './document_schema';
import {
  BOUND_PROPS,
  THEME_BOUND_PROPS,
  getPath,
  getVisibilityOperators,
  isQueryRef,
  isRowRef,
  isStateRef,
  type StateRef,
} from './bindings';
import {
  findFilterReferences,
  findQueryReferences,
  findRowReferences,
  findStateReferences,
  hasMalformedReference,
} from './interpolation';
import {
  getInterpolatedText,
  getNodeActions,
  getBindingType,
  getNodeBindings,
  getNodeChildren,
  getNodeSource,
  getNodeSubtrees,
  getSourceStateKeys,
} from './node_tree';

interface DocumentToValidate {
  state: Record<string, StateDeclaration>;
  queries?: Record<string, DeclaredQuery>;
  root: AppNode;
  theme?: AppTheme;
}

/** Where each action's `fromColumn` and `fromInput` values make sense. */
const ACTION_VALUE_SOURCES: Record<string, { fromColumn: boolean; fromInput: boolean }> = {
  onRowClick: { fromColumn: true, fromInput: false },
  onChartClick: { fromColumn: true, fromInput: false },
  onChange: { fromColumn: false, fromInput: true },
  onClick: { fromColumn: false, fromInput: false },
  onSubmit: { fromColumn: false, fromInput: false },
};

/**
 * Where an action may run a workflow: when something is pressed or a row is clicked, never when an
 * input changes, which is every key that is typed and would start a workflow for each.
 */
const WORKFLOW_EVENTS: readonly string[] = ['onClick', 'onRowClick', 'onChartClick', 'onSubmit'];

const collectNodes = (
  root: AppNode,
  ctx: z.RefinementCtx
): { nodes: AppNode[]; rowScoped: Set<string>; withinLimits: boolean } => {
  const nodes: AppNode[] = [];
  /** The ids of the nodes that are drawn for a row, and can read its columns. */
  const rowScoped = new Set<string>();
  const seenIds = new Set<string>();
  const pending: Array<{ node: AppNode; depth: number; inRow: boolean }> = [
    { node: root, depth: 1, inRow: false },
  ];

  for (let current = pending.pop(); current; current = pending.pop()) {
    const { node, depth, inRow } = current;
    if (inRow) rowScoped.add(node.id);

    if (depth > MAX_NODE_DEPTH) {
      ctx.addIssue({
        code: 'custom',
        message: `Nodes may be nested at most ${MAX_NODE_DEPTH} deep`,
      });
      return { nodes, rowScoped, withinLimits: false };
    }
    if (nodes.length >= MAX_NODE_COUNT) {
      ctx.addIssue({
        code: 'custom',
        message: `A document may hold at most ${MAX_NODE_COUNT} nodes`,
      });
      return { nodes, rowScoped, withinLimits: false };
    }

    if (seenIds.has(node.id)) {
      ctx.addIssue({
        code: 'custom',
        message: `Duplicate node id "${node.id}"`,
        params: { nodeId: node.id },
      });
    }
    seenIds.add(node.id);
    nodes.push(node);

    // Pushed in reverse so nodes are visited, and issues reported, in document order.
    [...getNodeSubtrees(node)].reverse().forEach((child) =>
      pending.push({
        node: child,
        depth: depth + 1,
        inRow: inRow || (node.type === 'list' && child === node.template),
      })
    );
  }

  return { nodes, rowScoped, withinLimits: true };
};

/**
 * Enforces what the node schemas cannot express: size limits, unique ids, and that everything a
 * node refers to (state keys, flyouts) exists and is used with the right type.
 * Without the bounds a single saved panel could carry an arbitrarily large tree.
 */
export const validateDocument = (document: DocumentToValidate, ctx: z.RefinementCtx): void => {
  const { state } = document;
  const issue = (message: string, nodeId?: string) =>
    ctx.addIssue({
      code: 'custom',
      message,
      ...(nodeId === undefined ? {} : { params: { nodeId } }),
    });

  if (Object.keys(state).length > MAX_STATE_KEYS) {
    issue(`A document may hold at most ${MAX_STATE_KEYS} state keys`);
  }
  const queries = document.queries ?? {};
  if (Object.keys(queries).length > MAX_DECLARED_QUERIES) {
    issue(`A document may declare at most ${MAX_DECLARED_QUERIES} queries`);
  }
  const { nodes, rowScoped, withinLimits } = collectNodes(document.root, ctx);
  if (!withinLimits) return;

  /** What is wrong with a reference to a row or a declared query, which have no kind to check. */
  const checkScopedReference = (
    nodeId: string,
    property: string,
    ref: { $row: string } | { $query: string; field: string }
  ) => {
    if ('$row' in ref && !rowScoped.has(nodeId)) {
      issue(
        `Node "${nodeId}" reads "${property}" from the column "${ref.$row}" of a row, which only the template of a list has`,
        nodeId
      );
    }
    if ('$query' in ref && !(ref.$query in queries)) {
      issue(`Node "${nodeId}" reads "${property}" from unknown query "${ref.$query}"`, nodeId);
    }
  };

  /** What is wrong with a property that reads a value, and the value it starts as. */
  const checkReference = (
    subject: string,
    property: string,
    ref: StateRef,
    bound: { schema: z.ZodType; kind: 'string' | 'number' | 'boolean' },
    nodeId?: string
  ) => {
    const declaration = state[ref.$state];
    if (!declaration) {
      issue(`${subject} reads "${property}" from unknown state key "${ref.$state}"`, nodeId);
    } else if (declaration.type !== bound.kind) {
      issue(
        `${subject} reads "${property}" from state key "${ref.$state}" (${declaration.type}); it needs a ${bound.kind} key`,
        nodeId
      );
    } else if (!bound.schema.safeParse(declaration.default).success) {
      issue(
        `${subject} reads "${property}" from state key "${
          ref.$state
        }", whose default ${JSON.stringify(
          declaration.default
        )} is not a value "${property}" can have`,
        nodeId
      );
    }
  };

  Object.entries(THEME_BOUND_PROPS).forEach(([property, bound]) => {
    const value = (document.theme as Record<string, unknown> | undefined)?.[property];
    if (isStateRef(value)) checkReference('The theme', property, value, bound);
  });

  // The sections that are held by what holds them, which is all they are for.
  const sectionParents = new Set(
    nodes
      .filter(({ type }) => type === 'tabs' || type === 'accordion')
      .flatMap((node) => getNodeChildren(node).map(({ id }) => id))
  );
  const firstTimeRangeId = nodes.find(({ type }) => type === 'time_range')?.id;
  const flyoutIds = new Set(nodes.filter(({ type }) => type === 'flyout').map(({ id }) => id));

  nodes.forEach((node) => {
    if (rowScoped.has(node.id)) {
      // A template is drawn once for each row: what it holds shows the row, and does not fetch,
      // set or open anything of its own, which would be done once for every row.
      const what =
        getNodeSource(node) !== undefined
          ? 'shows data of its own'
          : getNodeBindings(node).length > 0
          ? 'is an input'
          : node.type === 'flyout' || node.type === 'time_range'
          ? `is a ${node.type === 'flyout' ? 'flyout' : 'time range'}`
          : undefined;
      if (what) {
        issue(
          `Node "${node.id}" is in the template of a list and ${what}; a template only shows its row`,
          node.id
        );
      }
    }

    const bindings = getNodeBindings(node);
    const wanted = getBindingType(node);
    bindings.forEach((binding) => {
      const declaration = state[binding];
      if (binding === '') {
        // Reported as too short.
      } else if (!declaration) {
        issue(`Node "${node.id}" binds unknown state key "${binding}"`, node.id);
      } else if (declaration.type !== wanted) {
        issue(
          `Node "${node.id}" binds state key "${binding}" (${declaration.type}); ${
            wanted === 'list'
              ? 'this input sets a list and needs a list key'
              : wanted === 'boolean'
              ? 'a switch sets a true or a false and needs a boolean key'
              : 'an input needs a string key'
          }`,
          node.id
        );
      }
    });

    Object.entries(BOUND_PROPS[node.type] ?? {}).forEach(([path, bound]) => {
      const value = getPath(node, path);
      if (isStateRef(value)) {
        checkReference(`Node "${node.id}"`, path, value, bound, node.id);
      } else if (isRowRef(value) || isQueryRef(value)) {
        checkScopedReference(node.id, path, value);
      }
    });

    if (node.visibleWhen) {
      const rule = node.visibleWhen;
      const operators = getVisibilityOperators(rule);
      const [operator] = operators;
      if (operators.length > 1) {
        issue(
          `Node "${node.id}" is shown by a rule with ${operators.join(
            ' and '
          )}; a rule compares in one way only`,
          node.id
        );
      } else if ('$state' in rule) {
        const { $state: key, equals } = rule;
        const declaration = state[key];
        const isNumeric = ['gt', 'gte', 'lt', 'lte'].includes(operator);
        if (!declaration) {
          issue(`Node "${node.id}" is shown by unknown state key "${key}"`, node.id);
        } else if (operator === 'isEmpty' || operator === 'isNotEmpty') {
          if (declaration.type !== 'string' && declaration.type !== 'list') {
            issue(
              `Node "${node.id}" is shown when state key "${key}" (${declaration.type}) is empty or not; that needs a string or a list key`,
              node.id
            );
          }
        } else if (declaration.type === 'list') {
          issue(`Node "${node.id}" is shown by state key "${key}", which is a list`, node.id);
        } else if (operator === undefined && declaration.type !== 'boolean') {
          issue(
            `Node "${node.id}" is shown by state key "${key}" (${declaration.type}); without "equals" it needs a boolean key`,
            node.id
          );
        } else if (isNumeric && declaration.type !== 'number') {
          issue(
            `Node "${node.id}" is shown when state key "${key}" (${declaration.type}) is compared with ${operator}, which needs a number key`,
            node.id
          );
        } else if (
          (operator === 'equals' || operator === 'notEquals') &&
          typeof rule[operator] !== declaration.type
        ) {
          const operand = operator === 'equals' ? equals : rule.notEquals;
          issue(
            `Node "${node.id}" is shown when state key "${key}" (${declaration.type}) ${
              operator === 'equals' ? 'equals' : 'does not equal'
            } ${JSON.stringify(operand)}, which is a ${typeof operand}`,
            node.id
          );
        }
      } else {
        checkScopedReference(node.id, 'visibleWhen', rule);
      }
    }

    if (node.type === 'tabs' || node.type === 'accordion') {
      node.children
        .filter((child) => child.type !== 'section')
        .forEach((child) =>
          issue(
            `Node "${node.id}" is ${
              node.type === 'tabs' ? 'tabs' : 'an accordion'
            } and holds only sections, not "${child.id}" (${child.type})`,
            node.id
          )
        );
    }
    if (node.type === 'section' && !sectionParents.has(node.id)) {
      issue(`Node "${node.id}" is a section, which is only part of tabs or an accordion`, node.id);
    }

    if (node.type === 'form') {
      const seenKeys = new Set<string>();
      node.fields.forEach((field) => {
        if (seenKeys.has(field.bind)) {
          issue(
            `Node "${node.id}" has two fields that set "${field.bind}"; each needs a value of its own`,
            node.id
          );
        }
        seenKeys.add(field.bind);
        if (field.kind === 'select') {
          const seen = new Set<string>();
          field.options.forEach(({ value }) => {
            if (seen.has(value)) {
              issue(
                `Node "${node.id}" has the option "${value}" more than once in "${field.label}"`,
                node.id
              );
            }
            seen.add(value);
          });
        }
      });
    }

    if (
      node.type === 'stat' ||
      node.type === 'metric' ||
      node.type === 'progress' ||
      node.type === 'table' ||
      node.type === 'key_value' ||
      node.type === 'list'
    ) {
      if ((node.query === undefined) === (node.source === undefined)) {
        issue(
          `Node "${node.id}" shows data and needs a query or a source, and one of them only`,
          node.id
        );
      }
    }

    const source = getNodeSource(node);
    if (source?.type === 'cases') {
      getSourceStateKeys(source)
        .filter((key) => !(key in state))
        .forEach((key) =>
          issue(`Node "${node.id}" filters cases by the unknown state key "${key}"`, node.id)
        );

      const allowed = { status: CASES_STATUSES, severity: CASES_SEVERITIES } as const;
      CASES_FILTERS.forEach((filter) => {
        const value = source[filter];
        const known: readonly string[] | undefined =
          filter in allowed ? allowed[filter as keyof typeof allowed] : undefined;
        // An empty value filters nothing, which an "All" option of a select says.
        if (known && typeof value === 'string' && value !== '' && !known.includes(value)) {
          issue(
            `Node "${node.id}" filters cases by the ${filter} "${value}"; it is one of ${known.join(
              ', '
            )}`,
            node.id
          );
        }
      });
    }

    if (node.type === 'link' && node.to.type === 'discover') {
      const { from } = node.to;
      const target = nodes.find(({ id }) => id === from);
      const targetSource = target ? getNodeSource(target) : undefined;
      if (!target) {
        issue(`Node "${node.id}" opens "${from}" in Discover, which is not a component`, node.id);
      } else if (targetSource?.type !== 'esql') {
        issue(
          `Node "${node.id}" opens "${from}" in Discover, which has no ES|QL query to open`,
          node.id
        );
      }
    }

    if (node.type === 'time_range' && node.id !== firstTimeRangeId) {
      issue(
        `Node "${node.id}" is a second time range; an app has one, which sets the period of all of it`,
        node.id
      );
    }

    if (node.type === 'custom_content') {
      if (!node.template?.trim()) {
        issue(
          `Node "${node.id}" has no template; describe what it should show in its "prompt"`,
          node.id
        );
      } else if (CUSTOM_CONTENT_SCRIPT_PATTERN.test(node.template)) {
        issue(
          `Node "${node.id}" has a template with a script in it; it is shown with scripting off, so write it as plain HTML`,
          node.id
        );
      }
    }

    if (node.type === 'select' && node.options.length === 0 && node.optionsQuery === undefined) {
      issue(
        `Node "${node.id}" has no options; give it some, or a query that returns them`,
        node.id
      );
    }

    if (node.type === 'select' || node.type === 'button_group') {
      const seen = new Set<string>();
      node.options.forEach(({ value }) => {
        if (seen.has(value)) {
          issue(`Node "${node.id}" has the option "${value}" more than once`, node.id);
        }
        seen.add(value);
      });
    }

    getInterpolatedText(node).forEach(({ prop, text }) => {
      if (hasMalformedReference(text)) {
        issue(
          `Node "${node.id}" has a malformed reference in "${prop}"; use {{state.<key>}}`,
          node.id
        );
      }
      findStateReferences(text)
        .filter((key) => !(key in state))
        .forEach((key) => issue(`Node "${node.id}" refers to unknown state key "${key}"`, node.id));
      if (!rowScoped.has(node.id) && findRowReferences(text).length > 0) {
        issue(
          `Node "${node.id}" refers to a column of a row in "${prop}", which only the template of a list has`,
          node.id
        );
      }
      findQueryReferences(text)
        .filter(({ id }) => !(id in queries))
        .forEach(({ id }) => issue(`Node "${node.id}" refers to unknown query "${id}"`, node.id));
      findFilterReferences(text)
        .filter((filter) => !(TEXT_FILTERS as readonly string[]).includes(filter))
        .forEach((filter) =>
          issue(
            `Node "${
              node.id
            }" uses the unknown filter "${filter}" in "${prop}"; it is one of ${TEXT_FILTERS.join(
              ', '
            )}`,
            node.id
          )
        );
    });

    getNodeActions(node).forEach(({ event, actions }) => {
      const eventSources = ACTION_VALUE_SOURCES[event] ?? { fromColumn: false, fromInput: false };
      // In the template of a list, what is pressed is pressed for a row, whose columns it can hand on.
      const allowed = rowScoped.has(node.id) ? { ...eventSources, fromColumn: true } : eventSources;

      actions.forEach((action) => {
        if (action.type === 'runWorkflow') {
          if (!WORKFLOW_EVENTS.includes(event)) {
            issue(
              `Node "${node.id}" runs a workflow on ${event}; a workflow can only be run by a button, a row click, a click on a chart or a form that is submitted`,
              node.id
            );
          }
          Object.entries(action.inputs).forEach(([name, value]) => {
            if (typeof value !== 'object') return;
            if ('fromColumn' in value && !allowed.fromColumn) {
              issue(
                `Node "${node.id}": the input "${name}" of the workflow takes a column, which only a row click has`,
                node.id
              );
            }
            if ('fromState' in value && !(value.fromState in state)) {
              issue(
                `Node "${node.id}": the input "${name}" of the workflow takes the unknown state key "${value.fromState}"`,
                node.id
              );
            }
          });
          return;
        }
        if (action.type === 'openFlyout' && !flyoutIds.has(action.flyout)) {
          issue(`Node "${node.id}" opens "${action.flyout}", which is not a flyout`, node.id);
        }
        if (action.type !== 'setState') return;

        const declaration = state[action.key];
        if (!declaration) {
          issue(`Node "${node.id}" sets unknown state key "${action.key}"`, node.id);
          return;
        }

        const { value } = action;
        if (Array.isArray(value)) {
          if (declaration.type !== 'list') {
            issue(
              `Node "${node.id}" sets state key "${action.key}" (${declaration.type}) to a list`,
              node.id
            );
          }
        } else if (typeof value === 'object') {
          if ('fromColumn' in value && !allowed.fromColumn) {
            issue(`Node "${node.id}": fromColumn is not valid in ${event}`, node.id);
          }
          if ('fromInput' in value && !allowed.fromInput) {
            issue(`Node "${node.id}": fromInput is only valid on input nodes`, node.id);
          }
        } else if (typeof value !== declaration.type) {
          issue(
            `Node "${node.id}" sets state key "${action.key}" (${
              declaration.type
            }) to a ${typeof value}`
          );
        }
      });
    });
  });
};
