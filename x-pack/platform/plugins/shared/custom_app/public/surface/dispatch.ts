/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { ReactNode } from 'react';
import type { PrimitiveNode } from '@elastic/isomer-sdk';
import type { KibanaIsomerRuntime } from '@kbn/isomer';
import {
  getKibanaUiRenderer,
  type KibanaUiEnv,
  type KibanaUiRenderer,
  type SurfaceDefinition,
} from '@kbn/custom-app-registry';
import { getNodeSource, isNodeVisible, type AppNode } from '@kbn/custom-app-common';

export interface KibanaUiHost {
  surface: SurfaceDefinition<KibanaUiHost, ReactNode, unknown>;
  runtime: KibanaIsomerRuntime;
  /** `kibana-ui` renderers for primitives of other packs, by type. */
  renderers: Readonly<Record<string, KibanaUiRenderer<AppNode>>>;
  /** Renders a node once its query has filled the props it shows. */
  withData: (node: AppNode, render: (filled: AppNode) => ReactNode) => ReactNode;
  /** Resolves a Kibana path, such as one of a `link`, to a URL. */
  resolveKibanaPath?: (path: string) => string | undefined;
}

/**
 * Renders one node of an app: hidden by its `surfaces` allowlist or the app's `visibleWhen`, filled
 * by its query, then the primitive's `sanitize`, then its `kibana-ui` renderer, and otherwise the
 * surface's fallback.
 */
export const dispatchNode = (node: AppNode, env: KibanaUiEnv, host: KibanaUiHost): ReactNode => {
  const { surface } = host;
  const allowlist = (node as { surfaces?: readonly string[] }).surfaces;
  if (allowlist && !allowlist.includes(surface.visibleAs ?? surface.name)) return null;
  if (!isNodeVisible(node, env.state)) return null;
  return getNodeSource(node)
    ? host.withData(node, (filled) => renderPrimitive(filled, env, host))
    : renderPrimitive(node, env, host);
};

const renderPrimitive = (node: AppNode, env: KibanaUiEnv, host: KibanaUiHost): ReactNode => {
  const { surface, runtime, renderers } = host;
  const primitive = runtime.primitives.find(({ type }) => type === node.type);
  const sanitize = primitive?.sanitize as ((node: AppNode) => AppNode | null) | undefined;
  const sanitized = sanitize ? sanitize(node) : node;
  if (sanitized === null) return null;

  const renderer = renderers[node.type] ?? (primitive && getKibanaUiRenderer(primitive));
  return renderer
    ? renderer(sanitized as AppNode & PrimitiveNode, env)
    : surface.fallback(sanitized as PrimitiveNode, host);
};
