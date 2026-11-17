/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { z, lazySchema } from '@kbn/zod/v4';
import type { AnyPrimitiveDefinition } from '@elastic/isomer-sdk';
import {
  getCapability,
  getDataAdapter,
  registerCapability,
  type AnyCapability,
  type CapabilityManifest,
} from '@kbn/custom-app-registry';
import {
  actionsSchema,
  DATA_PROPS,
  OPTIONS_SOURCE_SUFFIX,
  querySchema,
  stateKeySchema,
} from '@kbn/custom-app-common';
import {
  actions,
  code,
  context,
  divider,
  fields,
  header,
  link,
  markdown,
  quote,
  section,
  table,
} from '@kbn/isomer-components';
import { registerBuiltinActions } from '../actions/manifests';
import {
  button,
  flyout,
  form,
  input,
  row,
  select,
  stat,
  type FormNode,
  type SelectNode,
} from '../pack';

type AppProps = Omit<CapabilityManifest, 'kind' | 'id' | 'version' | 'props' | 'doc'> & {
  /** Props of the primitive the app fills: from a query, or from `children`. */
  fills?: readonly string[];
  /** What the app adds to the primitive's props. */
  props?: z.ZodRawShape;
  example: Record<string, unknown>;
};

/**
 * A node of an app as a primitive: the primitive's props, without those the app fills, and with
 * what the app adds, such as a query or the actions of an event.
 */
const fromPrimitive = (
  primitive: AnyPrimitiveDefinition,
  { fills = [], props = {}, example, ...app }: AppProps
): AnyCapability => {
  const omitted = new Set(['type', 'id', ...fills]);
  return {
    kind: 'component',
    id: primitive.type,
    version: 1,
    // Built from the shape, since `omit` refuses a schema with refinements.
    props: lazySchema(() =>
      z.object({
        ...Object.fromEntries(
          Object.entries(primitive.schema.shape).filter(([key]) => !omitted.has(key))
        ),
        surfaces: (primitive.schema.shape.surfaces as z.ZodType).describe(
          'Where it is shown: "react" for Kibana, and the other surfaces of Isomer. Everywhere when left out.'
        ),
        ...props,
      })
    ),
    doc: {
      summary: primitive.catalog.purpose,
      whenToUse: primitive.catalog.useWhen.join(' '),
      example,
    },
    ...app,
  } as unknown as AnyCapability;
};

/** Reports what the primitive's own refinements, which `props` leaves out, say of the node. */
const refinements =
  (primitive: AnyPrimitiveDefinition) =>
  (
    node: Record<string, unknown> & { id?: string },
    { issue }: { issue: (message: string) => void }
  ) => {
    const { id = primitive.type, visibleWhen, ...props } = node;
    const result = primitive.schema.safeParse(props);
    if (!result.success) issue(`Node "${id}": ${result.error.issues[0]?.message}`);
  };

const handlers = (event: string, when: string) => ({
  [event]: actionsSchema.default([]).describe(`The actions to run ${when}.`),
});

const bind = () => ({
  bind: stateKeySchema.describe('The value of the app it sets. It must be declared as a string.'),
});

/** Reports an option given twice. */
const checkOptions = (
  options: ReadonlyArray<{ value: string }>,
  issue: (message: string) => void,
  where: string
) => {
  const seen = new Set<string>();
  options.forEach(({ value }) => {
    if (seen.has(value)) issue(`${where} has the option "${value}" more than once`);
    seen.add(value);
  });
};

const query = (shows: string) => ({ query: querySchema.describe(`An ES|QL query. ${shows}`) });

/** The capabilities that ship with custom apps, as Isomer primitives. */
export const BUILTIN_CAPABILITIES = [
  fromPrimitive(header, {
    interpolated: ['text'],
    example: { type: 'header', id: 'title', text: 'Service health' },
  }),
  fromPrimitive(markdown, {
    interpolated: ['text'],
    example: { type: 'markdown', id: 'intro', text: 'Errors by **service**.' },
  }),
  fromPrimitive(context, { example: { type: 'context', id: 'note', items: [{ text: 'Live' }] } }),
  fromPrimitive(divider, { example: { type: 'divider', id: 'rule' } }),
  fromPrimitive(quote, { example: { type: 'quote', id: 'summary', text: 'All quiet.' } }),
  fromPrimitive(code, { example: { type: 'code', id: 'query', text: 'FROM logs-*' } }),
  fromPrimitive(actions, {
    example: {
      type: 'actions',
      id: 'more',
      buttons: [{ label: 'Docs', url: 'https://www.elastic.co/docs' }],
    },
  }),
  fromPrimitive(link, {
    interpolated: ['label', 'path'],
    validate: refinements(link),
    example: { type: 'link', id: 'discover', label: 'Open in Discover', app: 'discover' },
  }),
  fromPrimitive(stat, {
    fills: DATA_PROPS.stat.fills,
    props: query('The value is the first column of the first row.'),
    data: 'query',
    interpolated: ['title'],
    example: { type: 'stat', id: 'errors', title: 'Errors', query: 'FROM logs-* | STATS COUNT(*)' },
  }),
  fromPrimitive(fields, {
    fills: DATA_PROPS.fields.fills,
    props: query('Each column of the first row is a labeled value.'),
    data: 'query',
    example: { type: 'fields', id: 'detail', query: 'FROM logs-* | LIMIT 1' },
  }),
  fromPrimitive(table, {
    fills: DATA_PROPS.table.fills,
    props: {
      ...query('Every row is shown, under its columns.'),
      columns: (table.schema.shape.columns as z.ZodType)
        .optional()
        .describe(
          'Left out, the columns are those of the query. A column given here with the label of one of the query says how to format it.'
        ),
      onRowClick: actionsSchema
        .default([])
        .describe(
          'The actions to run when a row is clicked. { "flyout": "<id>" } opens a flyout that has the row as {{row.<column>}}.'
        ),
    },
    data: 'query',
    example: {
      type: 'table',
      id: 'services',
      query: 'FROM logs-* | STATS errors = COUNT(*) BY service',
    },
  }),
  fromPrimitive(input, {
    props: { ...bind(), ...handlers('onChange', 'after it sets its value, with the value') },
    private: true,
    example: { type: 'input', id: 'name', label: 'Service', bind: 'name_filter' },
  }),
  fromPrimitive(select, {
    props: {
      ...bind(),
      ...handlers('onChange', 'after it sets its value, with the value'),
      optionsQuery: querySchema
        .optional()
        .describe('An ES|QL query whose first column is the value of each option, after options.'),
    },
    bindingType: (node) => (node.multiple === true ? 'list' : 'string'),
    sources: (node) =>
      node.optionsQuery === undefined
        ? []
        : [{ suffix: OPTIONS_SOURCE_SUFFIX, query: String(node.optionsQuery) }],
    validate: (node, { issue }) => {
      const {
        id = 'select',
        options,
        optionsQuery,
      } = node as unknown as SelectNode & {
        id?: string;
        optionsQuery?: string;
      };
      if (options.length === 0 && optionsQuery === undefined) {
        issue(`Node "${id}" has no options; give it some, or a query that returns them`);
      }
      checkOptions(options, issue, `Node "${id}"`);
    },
    example: {
      type: 'select',
      id: 'region',
      label: 'Region',
      bind: 'region',
      options: [{ value: '', label: 'All regions' }, { value: 'eu' }],
    },
  }),
  fromPrimitive(button, {
    props: handlers('onClick', 'when it is pressed'),
    compact: true,
    example: { type: 'button', id: 'go', label: 'Escalate', onClick: [] },
  }),
  fromPrimitive(form, {
    props: handlers(
      'onSubmit',
      'once the answers are in the values named by the fields. A workflow with no inputs is given the answers by name. A flyout the form is in closes once they are done'
    ),
    private: true,
    bindings: (node) => (node as unknown as FormNode).fields.map(({ name }) => name),
    extraText: (node) =>
      (node as unknown as FormNode).fields.flatMap(({ value }, index) =>
        value === undefined ? [] : [{ prop: `fields[${index}].value`, text: value }]
      ),
    validate: (node, { issue }) => {
      const { id = 'form', fields: questions } = node as unknown as FormNode & { id?: string };
      const seen = new Set<string>();
      questions.forEach(({ name, kind, options = [] }) => {
        if (seen.has(name)) issue(`Node "${id}" has two fields that set "${name}"`);
        seen.add(name);
        if (kind === 'select' && options.length === 0) {
          issue(`Node "${id}" has a select field "${name}" with no options`);
        }
        checkOptions(options, issue, `Node "${id}"`);
      });
    },
    example: {
      type: 'form',
      id: 'report',
      fields: [{ name: 'reason', label: 'Reason' }],
      submitLabel: 'Send',
      onSubmit: [],
    },
  }),
] as const;

/** The capabilities that hold other components, in `children`. */
export const BUILTIN_CONTAINERS = [
  fromPrimitive(section, {
    fills: ['body'],
    container: true,
    interpolated: ['title'],
    example: { type: 'section', id: 'details', title: 'Details', children: [] },
  }),
  fromPrimitive(row, {
    fills: ['body'],
    container: true,
    example: { type: 'row', id: 'kpis', children: [] },
  }),
  fromPrimitive(flyout, {
    fills: ['body'],
    container: true,
    overlay: true,
    interpolated: ['title'],
    example: { type: 'flyout', id: 'detail', title: 'Detail', children: [] },
  }),
] as const;

/**
 * Registers the primitives of the runtime's packs that are not registered yet, such as those of
 * other plugins, with nothing beyond what every node of an app has. One with a data adapter shows
 * data: its query fills the props the adapter says.
 */
export const registerPackPrimitives = (primitives: readonly AnyPrimitiveDefinition[]): void =>
  primitives
    .filter(({ type }) => getCapability(type) === undefined)
    .forEach((primitive) => {
      const adapter = getDataAdapter(primitive.type);
      const example = primitive.catalog.example as unknown as Record<string, unknown>;
      registerCapability(
        fromPrimitive(primitive, {
          fills: adapter?.fills,
          data: adapter ? 'query' : undefined,
          example: adapter
            ? {
                ...Object.fromEntries(
                  Object.entries(example).filter(([key]) => !adapter.fills.includes(key))
                ),
                query: 'FROM <index> | ...',
              }
            : example,
        })
      );
    });

/** Registers the capabilities that ship with custom apps. It can be called more than once. */
export const registerBuiltinCapabilities = (): void => {
  registerBuiltinActions();
  [...BUILTIN_CAPABILITIES, ...BUILTIN_CONTAINERS].forEach((capability) =>
    registerCapability(capability as unknown as AnyCapability)
  );
};
