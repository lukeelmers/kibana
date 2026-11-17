/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { z } from '@kbn/zod/v4';
import {
  actionKind,
  getAction,
  getCapability,
  toActionArray,
  type ActionValidationContext,
  type CapabilityValidationContext,
} from '@kbn/custom-app-registry';
import {
  CASES_FILTERS,
  CASES_SEVERITIES,
  CASES_STATUSES,
  MAX_NODE_COUNT,
  MAX_NODE_DEPTH,
  MAX_STATE_KEYS,
} from './constants';
import type { ActionList, AppNode } from './document_schema';
import { findReferences, hasMalformedReference, type StateValue } from './interpolation';
import {
  getInterpolatedText,
  getNodeActions,
  getBindingType,
  getNodeBindings,
  getNodeChildren,
  getNodeSource,
  getSourceStateKeys,
} from './node_tree';
import { getStateType } from './state_defaults';

interface DocumentToValidate {
  state: Record<string, StateValue>;
  body: AppNode[];
}

interface CollectedNode {
  node: AppNode;
  /** The flyout the node is in, or is. */
  flyout?: AppNode;
}

/** How a message names a node: by its id, or by its type when it has none. */
const nameOf = (node: AppNode): string => node.id ?? node.type;

const isOverlay = (node: AppNode): boolean => getCapability(node.type)?.overlay === true;

const collectNodes = (
  body: readonly AppNode[],
  ctx: z.RefinementCtx
): { nodes: CollectedNode[]; withinLimits: boolean } => {
  const nodes: CollectedNode[] = [];
  const seenIds = new Set<string>();
  // Pushed in reverse so nodes are visited, and issues reported, in document order.
  const pending: Array<CollectedNode & { depth: number }> = [...body]
    .reverse()
    .map((node) => ({ node, depth: 1 }));

  for (let current = pending.pop(); current; current = pending.pop()) {
    const { node, depth } = current;
    const flyout = isOverlay(node) ? node : current.flyout;

    if (depth > MAX_NODE_DEPTH) {
      ctx.addIssue({
        code: 'custom',
        message: `Nodes may be nested at most ${MAX_NODE_DEPTH} deep`,
      });
      return { nodes, withinLimits: false };
    }
    if (nodes.length >= MAX_NODE_COUNT) {
      ctx.addIssue({
        code: 'custom',
        message: `A document may hold at most ${MAX_NODE_COUNT} nodes`,
      });
      return { nodes, withinLimits: false };
    }

    if (node.id !== undefined) {
      if (seenIds.has(node.id)) {
        ctx.addIssue({
          code: 'custom',
          message: `Duplicate node id "${node.id}"`,
          params: { nodeId: node.id },
        });
      }
      seenIds.add(node.id);
    }
    nodes.push({ node, flyout });

    [...getNodeChildren(node)]
      .reverse()
      .forEach((child) => pending.push({ node: child, depth: depth + 1, flyout }));
  }

  return { nodes, withinLimits: true };
};

/**
 * Enforces what the node schemas cannot express: size limits, unique ids, and that everything a
 * node refers to (state keys, flyouts, the row of a row click) exists and is used with the right
 * type. Without the bounds a single saved panel could carry an arbitrarily large tree.
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
  const { nodes, withinLimits } = collectNodes(document.body, ctx);
  if (!withinLimits) return;

  const flyoutIds = new Set(
    nodes.flatMap(({ node }) => (isOverlay(node) && node.id !== undefined ? [node.id] : []))
  );

  // The flyouts a row click opens have that row, for {{row.key}}.
  const rowFlyoutIds = new Set(
    nodes.flatMap(({ node }) =>
      toActionArray((node as { onRowClick?: ActionList }).onRowClick ?? []).flatMap((action) => {
        const { flyout } = action as { flyout?: unknown };
        return typeof flyout === 'string' ? [flyout] : [];
      })
    )
  );

  /** What is wrong with the references of a text, each as the end of a sentence. */
  const checkText = (text: string, hasRow: boolean): string[] => [
    ...(hasMalformedReference(text)
      ? ['has a malformed reference; use {{state.<key>}} or {{row.<column>}}']
      : []),
    ...findReferences(text).flatMap(({ scope, key }) => {
      if (scope === 'state') return key in state ? [] : [`refers to unknown state key "${key}"`];
      return hasRow
        ? []
        : [
            `refers to {{row.${key}}} where there is no row; a row is there in a row click, and in a flyout a row click opens`,
          ];
    }),
  ];

  nodes.forEach(({ node, flyout }) => {
    const name = nameOf(node);
    const nodeIssue = (message: string) => issue(message, node.id);
    const hasRow = flyout?.id !== undefined && rowFlyoutIds.has(flyout.id);
    const capability = getCapability(node.type);

    if (isOverlay(node) && node.id === undefined) {
      nodeIssue(`A ${node.type} needs an id, which the action that opens it names`);
    }

    const wanted = getBindingType(node);
    getNodeBindings(node).forEach((binding) => {
      if (binding === '') return; // Reported as too short.
      if (!(binding in state)) {
        nodeIssue(`Node "${name}" binds unknown state key "${binding}"`);
        return;
      }
      const type = getStateType(state[binding]);
      if (type !== wanted) {
        nodeIssue(
          `Node "${name}" binds state key "${binding}" (${type}); ${
            wanted === 'list'
              ? 'this input sets a list and needs a list key'
              : wanted === 'boolean'
              ? 'a switch sets a true or a false and needs a boolean key'
              : 'an input needs a string key'
          }`
        );
      }
    });

    if (node.visibleWhen) {
      const { $state: key, equals } = node.visibleWhen;
      const type = key in state ? getStateType(state[key]) : undefined;
      if (!type) {
        nodeIssue(`Node "${name}" is shown by unknown state key "${key}"`);
      } else if (type === 'list') {
        nodeIssue(`Node "${name}" is shown by state key "${key}", which is a list`);
      } else if (equals === undefined && type !== 'boolean') {
        nodeIssue(
          `Node "${name}" is shown by state key "${key}" (${type}); without "equals" it needs a boolean key`
        );
      } else if (equals !== undefined && typeof equals !== type) {
        nodeIssue(
          `Node "${name}" is shown when state key "${key}" (${type}) equals ${JSON.stringify(
            equals
          )}, which is a ${typeof equals}`
        );
      }
    }

    const shown = node as { query?: string; source?: unknown };
    if (capability?.data === 'query' && shown.query === undefined) {
      nodeIssue(`Node "${name}" shows data and needs a query`);
    }
    if (capability?.data === 'query_or_source') {
      if ((shown.query === undefined) === (shown.source === undefined)) {
        nodeIssue(`Node "${name}" shows data and needs a query or a source, and one of them only`);
      }
    }

    const source = getNodeSource(node);
    if (source?.type === 'cases') {
      getSourceStateKeys(source)
        .filter((key) => !(key in state))
        .forEach((key) =>
          nodeIssue(`Node "${name}" filters cases by the unknown state key "${key}"`)
        );

      const allowed = { status: CASES_STATUSES, severity: CASES_SEVERITIES } as const;
      CASES_FILTERS.forEach((filter) => {
        const value = source[filter];
        const known: readonly string[] | undefined =
          filter in allowed ? allowed[filter as keyof typeof allowed] : undefined;
        // An empty value filters nothing, which an "All" option of a select says.
        if (known && typeof value === 'string' && value !== '' && !known.includes(value)) {
          nodeIssue(
            `Node "${name}" filters cases by the ${filter} "${value}"; it is one of ${known.join(
              ', '
            )}`
          );
        }
      });
    }

    (
      capability?.validate as
        | ((node: AppNode, context: CapabilityValidationContext) => void)
        | undefined
    )?.(node, {
      nodes: nodes.map((collected) => collected.node),
      sourceOf: (nodeId) => {
        const target = nodes.find((collected) => collected.node.id === nodeId);
        return target ? getNodeSource(target.node) : undefined;
      },
      parentOf: (nodeId) =>
        nodes.find((candidate) => getNodeChildren(candidate.node).some(({ id }) => id === nodeId))
          ?.node,
      checkText: (text) => checkText(text, hasRow),
      issue: nodeIssue,
    });

    getInterpolatedText(node).forEach(({ prop, text }) => {
      checkText(text, hasRow).forEach((problem) =>
        nodeIssue(`Node "${name}" ${problem}, in "${prop}"`)
      );
    });

    getNodeActions(node).forEach(({ event, actions }) => {
      const context: ActionValidationContext = {
        nodeId: name,
        event,
        state,
        checkText: (text) => checkText(text, hasRow || event === 'onRowClick'),
        overlayIds: flyoutIds,
        issue: nodeIssue,
      };
      actions.forEach((action) => {
        (
          getAction(actionKind(action) ?? '')?.validate as
            | ((action: unknown, context: ActionValidationContext) => void)
            | undefined
        )?.(action, context);
      });
    });
  });
};
