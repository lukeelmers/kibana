/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { type ReactElement } from 'react';
import { act, render, type RenderResult } from '@testing-library/react';
import type { FetchContext } from '@kbn/presentation-publishing';
import { appDocumentSchema, collectSources, type AppDocument } from '@kbn/custom-app-common';
import { createKibanaIsomerRuntime } from '@kbn/isomer';
import { componentsPack } from '@kbn/isomer-components';
import { ActionUiProviders } from '../actions/action_ui_providers';
import { createDataLayer, type DataLayer, type RunCases, type RunQuery } from '../data/data_layer';
import { DataLayerContext } from '../data/data_layer_context';
import { createAppRuntime, type AppRuntime } from '../runtime/app_runtime';
import { AppRuntimeContext } from '../runtime/app_runtime_context';
import { AppFrame } from './app_frame';
import { browserAppPack } from '../pack';
import { KIBANA_UI_RENDERERS } from '../pack/kibana_ui';
import { createKibanaUiSurface } from '../surface/kibana_ui_surface';

const isomerRuntime = createKibanaIsomerRuntime({ packs: [componentsPack, browserAppPack] });
const surface = createKibanaUiSurface(isomerRuntime, { renderers: KIBANA_UI_RENDERERS });

/** Stands in for the isomer plugin's start contract, with the app pack registered. */
export const testIsomer = { getRuntime: async () => isomerRuntime };

export const emptyDocument = (state: unknown = {}): AppDocument =>
  appDocumentSchema.parse({ title: 'Test', state, body: [] });

/** Renders a node inside a runtime built from the given document's declared state. */
export const renderWithRuntime = (
  ui: ReactElement,
  document: AppDocument = emptyDocument()
): { runtime: AppRuntime } & ReturnType<typeof render> => {
  const runtime = createAppRuntime(document);
  return {
    runtime,
    ...render(
      <AppRuntimeContext.Provider value={runtime}>
        <ActionUiProviders>{ui}</ActionUiProviders>
      </AppRuntimeContext.Provider>
    ),
  };
};

/** The fetch context every test panel is refreshed with. */
const TEST_CONTEXT = { timeRange: { from: 'now-15m', to: 'now' } } as FetchContext;

/** Stands in for the ES|QL parser: finds `?name` and `??name`. */
const getParameterNames = (query: string) =>
  Array.from(query.matchAll(/\?\??([A-Za-z_]\w*)/g), ([, name]) => name);

/**
 * Renders a whole document the way the embeddable does: a runtime, a data layer fed by that
 * runtime's state, and the first fetch.
 */
export const renderApp = async (
  document: AppDocument,
  runQuery: RunQuery,
  runCases?: RunCases,
  /** Shows the app in the frame of a page, as a page does. */
  {
    framed = false,
  }: {
    framed?: boolean;
  } = {}
): Promise<{ runtime: AppRuntime; layer: DataLayer } & RenderResult> => {
  const runtime = createAppRuntime(document);
  const layer = createDataLayer({ runQuery, runCases, getParameterNames });
  layer.setSources(collectSources(document.body));
  runtime.state$.subscribe(layer.setState);

  const view = render(
    <AppRuntimeContext.Provider value={runtime}>
      <DataLayerContext.Provider value={layer}>
        <ActionUiProviders>
          {framed ? (
            <AppFrame>{surface.render(document.body)}</AppFrame>
          ) : (
            surface.render(document.body)
          )}
        </ActionUiProviders>
      </DataLayerContext.Provider>
    </AppRuntimeContext.Provider>
  );
  await act(async () => layer.refresh(TEST_CONTEXT));

  return { runtime, layer, ...view };
};
