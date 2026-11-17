/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useMemo, type ReactNode } from 'react';
import { useEuiTheme } from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import { KbnWarningCallout } from '@kbn/ui-callout';
import type { PrimitiveNode } from '@elastic/isomer-sdk';
import type { KibanaIsomerRuntime } from '@kbn/isomer';
import type { ComponentsRenderContext } from '@kbn/isomer-components';
import {
  defineSurface,
  KIBANA_UI_SURFACE,
  type KibanaUiEnv,
  type KibanaUiRenderer,
} from '@kbn/custom-app-registry';
import {
  fillDataProps,
  getInterpolatedText,
  interpolate,
  resolveBoundProps,
  type AppNode,
} from '@kbn/custom-app-common';
import { useActionRunner } from '../actions/use_action_runner';
import { DataState } from '../components/data_state';
import { useDataLayer } from '../data/data_layer_context';
import { useSource } from '../data/use_source';
import { useAppRuntime, useStateValues } from '../runtime/app_runtime_context';
import type { StateValues } from '../runtime/app_runtime';
import { dispatchNode, type KibanaUiHost } from './dispatch';

export interface KibanaUiSurface {
  render: (body: readonly AppNode[], env?: Pick<KibanaUiEnv, 'row'>) => ReactNode;
}

/** The props an app adds to a primitive, which the primitive's own renderers do not know. */
const APP_PROPS = new Set(['id', 'visibleWhen', 'query', 'source', 'bind', 'children']);

const withoutAppProps = (node: PrimitiveNode): PrimitiveNode =>
  Object.fromEntries(
    Object.entries(node).filter(([key]) => !APP_PROPS.has(key) && !/^on[A-Z]/.test(key))
  ) as PrimitiveNode;

/** The node with its bound props and its `{{state.key}}` text as the values are now. */
const resolveNode = (node: AppNode, state: StateValues): AppNode =>
  getInterpolatedText(node).reduce<AppNode>(
    (resolved, { prop, text }) => ({ ...resolved, [prop]: interpolate(text, state) }),
    resolveBoundProps(node, state)
  );

const UnsupportedNode = ({ node }: { node: { id?: unknown; type?: unknown } }) => (
  <KbnWarningCallout
    announceOnMount={false}
    size="s"
    title={i18n.translate('xpack.customApp.unsupportedNode.title', {
      defaultMessage: 'This component is not supported',
    })}
    data-node-id={typeof node.id === 'string' ? node.id : undefined}
  >
    <p>
      {i18n.translate('xpack.customApp.unsupportedNode.description', {
        defaultMessage: 'The component type "{type}" is unknown to this version of Kibana.',
        values: { type: String(node.type) },
      })}
    </p>
  </KbnWarningCallout>
);

/** A node that shows data: its query runs while it is shown, and fills its props when it returns. */
const DataNode = ({ node, render }: { node: AppNode; render: (filled: AppNode) => ReactNode }) => {
  const layer = useDataLayer();
  const source = useSource(node.id);
  return (
    <DataState state={source} onRetry={layer.retry}>
      {(data) => render(fillDataProps(node, data))}
    </DataState>
  );
};

/** A primitive with no `kibana-ui` renderer, drawn read-only by the runtime's `react` surface. */
const ReactFallback = ({ node, host }: { node: PrimitiveNode; host: KibanaUiHost }) => {
  const { colorMode } = useEuiTheme();
  if (!host.runtime.primitives.some(({ type }) => type === node.type)) {
    return <UnsupportedNode node={node} />;
  }
  const context: ComponentsRenderContext = { resolveKibanaPath: host.resolveKibanaPath };
  return (
    <div data-node-id={typeof node.id === 'string' ? node.id : undefined}>
      {host.runtime.surfaces.react.renderNode(withoutAppProps(node), {
        context,
        wrapper: { theme: colorMode === 'DARK' ? 'dark' : 'light' },
      })}
    </div>
  );
};

export const kibanaUiSurface = defineSurface<KibanaUiHost, ReactNode, KibanaUiSurface>({
  name: KIBANA_UI_SURFACE,
  // A node's allowlist cannot name this surface yet, so `react` stands in for it.
  visibleAs: 'react',
  fallback: (node, host) => <ReactFallback node={node} host={host} />,
  create: (host) => {
    const KibanaUiNode = ({ node, row }: { node: AppNode; row?: KibanaUiEnv['row'] }) => {
      const runtime = useAppRuntime();
      const state = useStateValues();
      const dispatch = useActionRunner(node.id);
      const resolved = useMemo(() => resolveNode(node, state), [node, state]);
      const env: KibanaUiEnv = {
        state,
        row,
        setState: (key, value) =>
          runtime.run([
            { type: 'setState', key, value: typeof value === 'object' ? [...value] : value },
          ]),
        dispatch,
        renderChild: (child) => <KibanaUiNode key={child.id} node={child as AppNode} row={row} />,
      };
      return <>{dispatchNode(resolved, env, host)}</>;
    };

    return {
      render: (body, { row } = {}) =>
        body.map((node) => <KibanaUiNode key={node.id} node={node} row={row} />),
    };
  },
});

/**
 * Renders the nodes of an app as Kibana UI: interactive where a primitive has a `kibana-ui`
 * renderer, read-only through the runtime's `react` surface otherwise. `renderers` adds
 * `kibana-ui` renderers for primitives of packs that do not have them.
 */
export const createKibanaUiSurface = (
  runtime: KibanaIsomerRuntime,
  {
    renderers = {},
    resolveKibanaPath,
  }: {
    renderers?: Readonly<Record<string, KibanaUiRenderer<AppNode>>>;
    resolveKibanaPath?: (path: string) => string | undefined;
  } = {}
): KibanaUiSurface =>
  kibanaUiSurface.create({
    surface: kibanaUiSurface,
    runtime,
    renderers,
    resolveKibanaPath,
    withData: (node, render) => <DataNode node={node} render={render} />,
  });
