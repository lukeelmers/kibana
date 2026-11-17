/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { z } from '@kbn/zod/v4';
import type { CoreStart } from '@kbn/core/server';
import { StepCategory } from '@kbn/workflows';
import { createServerStepDefinition } from '@kbn/workflows-extensions/server';
import type { KibanaIsomerRuntime } from '@kbn/isomer';
import { addSpaceIdToPath } from '@kbn/core-spaces-common';
import { RENDER_SURFACES, renderApp } from '../routes/render_app';

const inputSchema = z.object({
  app: z.string().min(1).max(256).describe('The id of the saved custom app'),
  surface: z.enum(RENDER_SURFACES),
});

/** Renders a saved custom app, with its default values, for a workflow to post or store. */
export const renderAppStepDefinition = ({
  getCoreStart,
  getRuntime,
}: {
  getCoreStart: () => Promise<CoreStart>;
  getRuntime: () => Promise<KibanaIsomerRuntime>;
}) =>
  createServerStepDefinition({
    id: 'custom_app.render',
    label: 'Render custom app',
    category: StepCategory.Kibana,
    description: 'Renders a custom app read-only as Markdown or as Slack Block Kit blocks.',
    inputSchema,
    outputSchema: z.object({
      content: z
        .union([z.string(), z.array(z.looseObject({ type: z.string() }))])
        .describe('Markdown, or Slack Block Kit blocks'),
    }),
    handler: async (context) => {
      const {
        kibanaUrl,
        workflow: { spaceId },
      } = context.contextManager.getContext();
      const { app, surface } = inputSchema.parse(context.input);
      const coreStart = await getCoreStart();
      const content = await renderApp({
        id: app,
        surface,
        // The fake request carries no space, so the client is scoped to the workflow's.
        savedObjectsClient: coreStart.savedObjects
          .getScopedClient(context.contextManager.getFakeRequest())
          .asScopedToNamespace(spaceId),
        esClient: context.contextManager.getScopedEsClient(),
        runtime: await getRuntime(),
        baseUrl: addSpaceIdToPath(kibanaUrl, spaceId),
        logger: context.logger,
      });
      return { output: { content } };
    },
  });
