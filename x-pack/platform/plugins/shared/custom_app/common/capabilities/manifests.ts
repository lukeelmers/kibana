/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { z, lazySchema } from '@kbn/zod/v4';
import type { AnyPrimitiveDefinition } from '@elastic/isomer-sdk';
import {
  registerCapability,
  type AnyCapability,
  type CapabilityManifest,
} from '@kbn/custom-app-registry';
import { actionsSchema, DATA_PROPS, querySchema } from '@kbn/custom-app-common';
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
import { row, stat } from '../pack';
import { buttonCapability } from './button/manifest';
import { flyoutCapability } from './flyout/manifest';
import { formCapability } from './form/manifest';
import { selectCapability } from './select/manifest';

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
    interpolated: ['label'],
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
      onRowClick: actionsSchema
        .default([])
        .describe('The actions to run when a row is clicked, with that row.'),
    },
    data: 'query',
    events: { onRowClick: 'onRowClick' },
    example: {
      type: 'table',
      id: 'services',
      query: 'FROM logs-* | STATS errors = COUNT(*) BY service',
    },
  }),
  buttonCapability,
  formCapability,
  selectCapability,
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
  flyoutCapability,
] as const;

/** Registers the capabilities that ship with custom apps. It can be called more than once. */
export const registerBuiltinCapabilities = (): void => {
  registerBuiltinActions();
  [...BUILTIN_CAPABILITIES, ...BUILTIN_CONTAINERS].forEach((capability) =>
    registerCapability(capability as unknown as AnyCapability)
  );
};
