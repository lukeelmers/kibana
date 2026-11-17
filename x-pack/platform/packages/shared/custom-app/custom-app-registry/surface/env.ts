/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { ReactNode } from 'react';
import type { Action, GenericNode } from '..';

export type KibanaUiStateValue = string | number | boolean | readonly string[];

/**
 * What a node of an app has beside its primitive's props: an id, a bound value, the nodes it holds
 * and the handlers of its events.
 */
export interface AppNodeProps {
  id: string;
  bind?: string;
  children?: GenericNode[];
  [event: `on${string}`]: readonly Action[] | undefined;
}

/** What a `kibana-ui` renderer is given beside its node. */
export interface KibanaUiEnv {
  /** The values of the app. */
  state: Readonly<Record<string, KibanaUiStateValue>>;
  setState: (key: string, value: KibanaUiStateValue) => void;
  /**
   * Runs a node's handlers, with the row or input that caused them. Returns what could not be
   * done, with the reason.
   */
  dispatch: (
    handlers: readonly Action[],
    input?: { row?: Readonly<Record<string, unknown>>; input?: unknown }
  ) => string[];
  /** The row the node was opened with, as in a flyout. */
  row?: Readonly<Record<string, unknown>>;
  /** Renders a child node through the same dispatch. */
  renderChild: (node: GenericNode) => ReactNode;
}

export type KibanaUiRenderer<TNode> = (node: TNode, env: KibanaUiEnv) => ReactNode;
