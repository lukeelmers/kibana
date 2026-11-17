/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { getCapability, type CapabilityQueryResult } from '@kbn/custom-app-registry';
import { isNodeVisible, resolveBoundProps } from './bindings';
import { fillDataProps } from './data_props';
import { isContainerNode, type AppDocument, type AppNode } from './document_schema';
import { interpolate, type StateValue } from './interpolation';
import { getNodeChildren, getNodeSource, withNodeIds, type IdentifiedNode } from './node_tree';

/** Primitives a person acts on, which a rendered copy of the app has no use for. */
const INTERACTIVE_TYPES = new Set(['form', 'input', 'select', 'button', 'flyout']);

/** The props an app adds to a primitive, which Isomer does not know. */
const APP_PROPS = new Set(['id', 'visibleWhen', 'query', 'source', 'bind', 'children']);

export interface CompositionNode {
  type: string;
  [prop: string]: unknown;
}

/** An Isomer composition: what every surface of the runtime renders. */
export interface AppComposition {
  type: 'view';
  title: string;
  body: CompositionNode[];
}

export interface CompositionInputs {
  state: Readonly<Record<string, StateValue>>;
  /** What each query returned, by the id `withNodeIds` gives its node. */
  data: Readonly<Record<string, CapabilityQueryResult>>;
}

const interpolateText = (node: AppNode, state: CompositionInputs['state']): AppNode =>
  (getCapability(node.type)?.interpolated ?? []).reduce<AppNode>((resolved, prop) => {
    const text = (resolved as unknown as Record<string, unknown>)[prop];
    return typeof text === 'string'
      ? { ...resolved, [prop]: interpolate(text, { state }) }
      : resolved;
  }, node);

const withoutAppProps = (node: AppNode): CompositionNode =>
  Object.fromEntries(
    Object.entries(node).filter(([key]) => !APP_PROPS.has(key) && !/^on[A-Z]/.test(key))
  ) as CompositionNode;

/**
 * The nodes as Isomer primitives, as they are with the given values: hidden and interactive nodes
 * are left out, and so are those whose data did not come back and containers left with nothing.
 */
const toCompositionNodes = (
  nodes: readonly IdentifiedNode[],
  inputs: CompositionInputs
): CompositionNode[] =>
  nodes.flatMap((node) => {
    if (INTERACTIVE_TYPES.has(node.type) || !isNodeVisible(node, inputs.state)) return [];
    const result = inputs.data[node.id];
    if (getNodeSource(node) && !result) return [];

    const resolved = interpolateText(resolveBoundProps(node, inputs.state), inputs.state);
    const primitive = withoutAppProps(result ? fillDataProps(resolved, result) : resolved);
    if (!isContainerNode(node)) return [primitive];

    const body = toCompositionNodes(getNodeChildren(node) as IdentifiedNode[], inputs);
    return body.length > 0 ? [{ ...primitive, body }] : [];
  });

/** The app as an Isomer composition, read-only, with its values and the data of its queries. */
export const toComposition = (
  document: AppDocument,
  inputs: CompositionInputs
): AppComposition => ({
  type: 'view',
  title: document.title,
  body: toCompositionNodes(withNodeIds(document.body), inputs),
});
