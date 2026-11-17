/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { ReactNode } from 'react';
import type { ActionList, CapabilityQueryResult, GenericNode } from '..';

export type KibanaUiStateValue = string | number | boolean | readonly string[];

/**
 * What a node of an app has beside its primitive's props: an id, a bound value, the nodes it holds
 * and the handlers of its events.
 */
export interface AppNodeProps {
  /** Given to every node that is drawn, from its place when it has none of its own. */
  id: string;
  bind?: string;
  children?: GenericNode[];
  [event: `on${string}`]: ActionList | undefined;
}

/** What a `kibana-ui` renderer is given beside its node. */
export interface KibanaUiEnv {
  /** The values of the app. */
  state: Readonly<Record<string, KibanaUiStateValue>>;
  setState: (key: string, value: KibanaUiStateValue) => void;
  /**
   * Runs a node's handlers, with the row or input that caused them, and the row of the node when
   * none is given. Returns what could not be done, with the reason. `onDone` is called once
   * everything was done, including what the person was asked to confirm.
   */
  dispatch: (
    handlers: ActionList,
    input?: { row?: Readonly<Record<string, unknown>>; input?: unknown },
    onDone?: () => void
  ) => string[];
  /** Runs an ES|QL query as the person who is looking, with the context and the values of the app. */
  runQuery: (query: string, signal: AbortSignal) => Promise<CapabilityQueryResult>;
  /** The row the node was opened with, as in a flyout. */
  row?: Readonly<Record<string, unknown>>;
  /** Renders a child node through the same dispatch, with a row of its own when one is given. */
  renderChild: (node: GenericNode, row?: Readonly<Record<string, unknown>>) => ReactNode;
}

export type KibanaUiRenderer<TNode> = (node: TNode, env: KibanaUiEnv) => ReactNode;
