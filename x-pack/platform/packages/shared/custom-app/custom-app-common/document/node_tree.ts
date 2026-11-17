/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { getCapability, NODE_EVENTS, toActionArray } from '@kbn/custom-app-registry';
import { OPTIONS_SOURCE_SUFFIX } from './constants';
import {
  isContainerNode,
  type Action,
  type ActionList,
  type AppNode,
  type DataSource,
} from './document_schema';

/** Returns the direct children of a node, empty for leaf nodes. */
export const getNodeChildren = (node: AppNode): readonly AppNode[] =>
  isContainerNode(node) ? node.children : [];

/**
 * Whether an app has nothing in it yet. A new app starts like this, and is shown an empty state,
 * not a blank panel, until something is added.
 */
export const isEmptyDocument = (document: { body: readonly AppNode[] }): boolean =>
  document.body.length === 0;

/** A node that is drawn, which has an id whether or not one was written. */
export type IdentifiedNode = AppNode & { id: string };

/**
 * The nodes with an id each: one that has none is given its place under its parent, such as
 * `kpis.1`, or `.1` at the top, which no id that is written can be, since those have no dot.
 */
export const withNodeIds = (nodes: readonly AppNode[], parentId = ''): IdentifiedNode[] =>
  nodes.map((node, index) => {
    const id = node.id ?? `${parentId}.${index}`;
    const children = getNodeChildren(node);
    return {
      ...node,
      id,
      ...(children.length > 0 ? { children: withNodeIds(children, id) } : {}),
    } as IdentifiedNode;
  });

/** The props of a node whose text may contain `{{state.key}}` references. */
export const getInterpolatedText = (node: AppNode): ReadonlyArray<{ prop: string; text: string }> =>
  getCapabilityText(node);

const getCapabilityText = (node: AppNode): ReadonlyArray<{ prop: string; text: string }> => {
  const capability = getCapability(node.type);
  return [
    ...(capability?.interpolated ?? []).flatMap((prop) => {
      const text = (node as unknown as Record<string, unknown>)[prop];
      return typeof text === 'string' ? [{ prop, text }] : [];
    }),
    ...((
      capability?.extraText as
        | ((node: AppNode) => ReadonlyArray<{ prop: string; text: string }>)
        | undefined
    )?.(node) ?? []),
  ];
};

/** The ES|QL query a node runs, if it shows data. */
export const getNodeQuery = (node: AppNode): string | undefined => {
  const data = getCapability(node.type)?.data;
  return data === 'query' || data === 'query_or_source'
    ? (node as { query?: string }).query
    : undefined;
};

/** Where a node gets what it shows, if it shows data: a query, or a source of cases. */
export const getNodeSource = (node: AppNode): DataSource | undefined => {
  if (getCapability(node.type)?.data === 'query_or_source') {
    const { source } = node as { source?: DataSource };
    if (source) return source;
  }
  const query = getNodeQuery(node);
  return query === undefined ? undefined : { type: 'esql', query };
};

/** The id the source of the options of a select is known by, which is not that of a component. */
export const getOptionsSourceId = (nodeId: string): string => `${nodeId}${OPTIONS_SOURCE_SUFFIX}`;

const collectNodeSources = (node: IdentifiedNode): Record<string, DataSource> => {
  const source = getNodeSource(node);
  return {
    ...(source === undefined ? {} : { [node.id]: source }),
    ...Object.fromEntries(
      (
        (
          getCapability(node.type)?.sources as
            | ((node: AppNode) => ReadonlyArray<{ suffix: string; query: string }>)
            | undefined
        )?.(node) ?? []
      ).map(({ suffix, query }) => [`${node.id}${suffix}`, { type: 'esql', query }])
    ),
    ...Object.assign({}, ...(getNodeChildren(node) as IdentifiedNode[]).map(collectNodeSources)),
  };
};

/**
 * Every source of the app, by the id of the node that shows it, and of the options of a select.
 * The ids are those `withNodeIds` gives.
 */
export const collectSources = (body: readonly AppNode[]): Record<string, DataSource> =>
  Object.assign({}, ...withNodeIds(body).map(collectNodeSources));

/** The values of the app that a source is driven by, which are the ones that make it run again. */
export const getSourceStateKeys = (source: DataSource): string[] => {
  if (source.type !== 'cases') return [];
  return [source.status, source.severity, source.search, source.tag].flatMap((filter) =>
    typeof filter === 'object' ? [filter.fromState] : []
  );
};

/** The state keys an input node reads and writes: its `bind`, or one for each field of a form. */
export const getNodeBindings = (node: AppNode): string[] => {
  const bindings = getCapability(node.type)?.bindings as ((node: AppNode) => string[]) | undefined;
  if (bindings) return bindings(node);
  const { bind } = node as { bind?: unknown };
  return typeof bind === 'string' ? [bind] : [];
};

/**
 * What kind of value an input sets: a list for a box of lines, and for a select that takes several
 * options, a true or a false for a switch, and text for every other.
 */
export const getBindingType = (node: AppNode): 'string' | 'list' | 'boolean' => {
  const kind = getCapability(node.type)?.bindingType;
  if (typeof kind === 'function')
    return (kind as (node: AppNode) => 'string' | 'list' | 'boolean')(node);
  return kind ?? 'string';
};

/** The actions a node can run, with the event that runs them. */
export const getNodeActions = (
  node: AppNode
): ReadonlyArray<{ event: string; actions: readonly Action[] }> =>
  NODE_EVENTS.flatMap((event) => {
    const actions = (node as unknown as Record<string, ActionList | undefined>)[event];
    return actions === undefined ? [] : [{ event, actions: toActionArray(actions) }];
  });

/** Every query of the app, by the id of the node that runs it, as `withNodeIds` gives it. */
export const collectQueries = (body: readonly AppNode[]): Record<string, string> => {
  const collect = (node: IdentifiedNode): Record<string, string> => {
    const query = getNodeQuery(node);
    return {
      ...(query === undefined ? {} : { [node.id]: query }),
      ...Object.assign({}, ...(getNodeChildren(node) as IdentifiedNode[]).map(collect)),
    };
  };
  return Object.assign({}, ...withNodeIds(body).map(collect));
};
