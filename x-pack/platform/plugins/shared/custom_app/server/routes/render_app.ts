/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { z, lazySchema } from '@kbn/zod/v4';
import type {
  ElasticsearchClient,
  IBasePath,
  IRouter,
  Logger,
  SavedObjectsClientContract,
} from '@kbn/core/server';
import type { Composition } from '@elastic/isomer-sdk';
import type { KibanaIsomerRuntime } from '@kbn/isomer';
import type { CapabilityQueryResult } from '@kbn/custom-app-registry';
import { getESQLQueryVariables } from '@kbn/esql-utils';
import {
  collectQueries,
  getStateDefaults,
  toComposition,
  type AppNode,
  type StateValue,
} from '@kbn/custom-app-common';
import { savedAppIdParamsSchema } from '../../common/saved_app_schema';
import { createSavedAppsService } from './saved_apps_service';
import { API_PATH, API_VERSION, AUTHZ_OPT_OUT, toErrorResponse } from './register_routes';

export const RENDER_SURFACES = ['markdown', 'slack'] as const;
type RenderSurface = (typeof RENDER_SURFACES)[number];

/** Markdown as a string, or Slack Block Kit blocks. */
type RenderedApp = string | Array<{ type: string }>;

interface DebugLogger {
  debug: (message: string) => void;
}

const renderQuerySchema = lazySchema(() => z.object({ surface: z.enum(RENDER_SURFACES) }));

/** The values a query refers to as `?key`, as its named parameters. */
const toParams = (query: string, state: Readonly<Record<string, StateValue>>) => {
  const names = getESQLQueryVariables(query);
  return Object.entries(state)
    .filter(([key]) => names.includes(key))
    .map(([key, value]) => ({ [key]: typeof value === 'object' ? [...value] : value }));
};

/** What each query returns, by the id of its node. One that fails is left out, and so is its node. */
const runQueries = async (
  body: readonly AppNode[],
  state: Readonly<Record<string, StateValue>>,
  esClient: ElasticsearchClient,
  logger: DebugLogger
): Promise<Record<string, CapabilityQueryResult>> => {
  const results = await Promise.all(
    Object.entries(collectQueries(body)).map(async ([id, query]) => {
      try {
        const { columns, values } = await esClient.esql.query({
          query,
          params: toParams(query, state),
        });
        return [[id, { columns, rows: values }]];
      } catch (error) {
        logger.debug(`Leaving out node ${id} of the rendered app: ${(error as Error).message}`);
        return [];
      }
    })
  );
  return Object.fromEntries(results.flat());
};

/** A saved app as it is with its default values, rendered read-only on a surface of the runtime. */
export const renderApp = async ({
  id,
  surface,
  savedObjectsClient,
  esClient,
  runtime,
  baseUrl,
  logger,
}: {
  id: string;
  surface: RenderSurface;
  savedObjectsClient: SavedObjectsClientContract;
  esClient: ElasticsearchClient;
  runtime: KibanaIsomerRuntime;
  /** Where the relative links of Slack blocks resolve. */
  baseUrl: string;
  logger: DebugLogger;
}): Promise<RenderedApp> => {
  const app = await createSavedAppsService(savedObjectsClient).get(id);
  const state = getStateDefaults(app.state);
  const data = await runQueries(app.body, state, esClient, logger);
  const composition = toComposition(app, { state, data }) as Composition;
  return surface === 'markdown'
    ? runtime.surfaces.markdown.render(composition)
    : [...runtime.surfaces.slack.render(composition, { baseUrl }).blocks];
};

export const registerRenderAppRoute = (
  router: IRouter,
  {
    getRuntime,
    basePath,
    logger,
  }: { getRuntime: () => Promise<KibanaIsomerRuntime>; basePath: IBasePath; logger: Logger }
) => {
  router.versioned
    .get({ path: `${API_PATH}/{id}/render`, access: 'internal', security: AUTHZ_OPT_OUT })
    .addVersion(
      {
        version: API_VERSION,
        validate: { request: { params: savedAppIdParamsSchema, query: renderQuerySchema } },
      },
      async (context, request, response) => {
        const core = await context.core;
        // Slack needs absolute links: to the public URL when one is set, in the space of the request.
        const origin = basePath.publicBaseUrl
          ? new URL(basePath.publicBaseUrl).origin
          : request.url.origin;
        try {
          const content = await renderApp({
            id: request.params.id,
            surface: request.query.surface,
            savedObjectsClient: core.savedObjects.client,
            esClient: core.elasticsearch.client.asCurrentUser,
            runtime: await getRuntime(),
            baseUrl: `${origin}${basePath.get(request)}`,
            logger,
          });
          return response.ok({ body: { content } });
        } catch (error) {
          return toErrorResponse(error, response);
        }
      }
    );
};
