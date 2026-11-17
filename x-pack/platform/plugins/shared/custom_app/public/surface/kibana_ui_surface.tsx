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
  getCapability,
  KIBANA_UI_SURFACE,
  type KibanaUiEnv,
  type KibanaUiRenderer,
} from '@kbn/custom-app-registry';
import {
  fillDataProps,
  interpolate,
  resolveBoundProps,
  withNodeIds,
  type AppNode,
  type IdentifiedNode,
  type InterpolationScopes,
} from '@kbn/custom-app-common';
import { useActionRunner } from '../actions/use_action_runner';
import { DataState } from '../components/data_state';
import { useDataLayer, useOptionalDataLayer } from '../data/data_layer_context';
import { createRunEsqlQuery } from '../data/run_esql_query';
import { useSource } from '../data/use_source';
import { useAppRuntime, useStateValues } from '../runtime/app_runtime_context';
import { getServices } from '../services';
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

/** The node with its bound props and its `{{state.key}}` and `{{row.key}}` text as they are now. */
const resolveNode = (node: AppNode, scopes: InterpolationScopes): AppNode =>
  (getCapability(node.type)?.interpolated ?? []).reduce<AppNode>((resolved, prop) => {
    const text = (resolved as unknown as Record<string, unknown>)[prop];
    return typeof text === 'string' ? { ...resolved, [prop]: interpolate(text, scopes) } : resolved;
  }, resolveBoundProps(node, scopes.state));

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
const DataNode = ({
  node,
  render,
}: {
  node: IdentifiedNode;
  render: (filled: AppNode) => ReactNode;
}) => {
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
    const KibanaUiNode = ({ node, row }: { node: IdentifiedNode; row?: KibanaUiEnv['row'] }) => {
      const runtime = useAppRuntime();
      const state = useStateValues();
      const dispatch = useActionRunner(node.id);
      const layer = useOptionalDataLayer();
      const resolved = useMemo(() => resolveNode(node, { state, row }), [node, state, row]);
      const env: KibanaUiEnv = {
        state,
        row,
        // As it is, and not read as text that refers to values.
        setState: (key, value) =>
          runtime.run(
            { state: { [key]: { fromInput: true } } },
            { input: typeof value === 'object' ? [...value] : value }
          ),
        // A node in a flyout that a row click opened acts with that row.
        dispatch: (handlers, input, onDone) => dispatch(handlers, { row, ...input }, onDone),
        runQuery: (query, signal) => {
          const context = layer?.context$.getValue();
          if (!context)
            return Promise.reject(new Error('The page has not said what to look at yet'));
          const { core, search } = getServices();
          return createRunEsqlQuery({ search, http: core.http })(query, { context, state }, signal);
        },
        renderChild: (child, childRow) => (
          <KibanaUiNode key={child.id} node={child as IdentifiedNode} row={childRow ?? row} />
        ),
      };
      return <>{dispatchNode(resolved as IdentifiedNode, env, host)}</>;
    };

    return {
      render: (body, { row } = {}) =>
        withNodeIds(body).map((node) => <KibanaUiNode key={node.id} node={node} row={row} />),
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
