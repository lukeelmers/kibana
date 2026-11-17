/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type {
  CoreSetup,
  CoreStart,
  Logger,
  Plugin,
  PluginInitializerContext,
} from '@kbn/core/server';
import type { AgentBuilderPluginSetup } from '@kbn/agent-builder-server';
import type { EmbeddableSetup } from '@kbn/embeddable-plugin/server';
import type { FeaturesPluginSetup } from '@kbn/features-plugin/server';
import type { IsomerPluginSetup, IsomerPluginStart } from '@kbn/isomer-plugin/server';
import type { WorkflowsExtensionsServerPluginSetup } from '@kbn/workflows-extensions/server';
import { CUSTOM_APP_EMBEDDABLE_TYPE } from '@kbn/custom-app-common';
import { createCustomAppContextAttachmentType } from './attachment_types/custom_app_context';
import {
  registerBuiltinCapabilities,
  registerPackPrimitives,
} from '../common/capabilities/manifests';
import { customAppFeature } from './feature';
import { registerSavedAppRoutes } from './routes/register_routes';
import { registerRenderAppRoute } from './routes/render_app';
import { customAppSavedObjectType } from './saved_objects';
import { customAppEmbeddableSchema } from './embeddable/schemas';
import { getTransforms } from './embeddable/transforms/get_transforms';
import { customAppCreationSkill } from './skills/custom_app_creation_skill';
import { createCreateCustomAppTool } from './tools/create_custom_app_tool';
import { createUpdateCustomAppTool } from './tools/update_custom_app_tool';
import { renderAppStepDefinition } from './workflow_steps/render_app_step';

interface SetupDeps {
  embeddable: EmbeddableSetup;
  features: FeaturesPluginSetup;
  isomer: IsomerPluginSetup;
  agentBuilder?: AgentBuilderPluginSetup;
  workflowsExtensions?: WorkflowsExtensionsServerPluginSetup;
}

interface StartDeps {
  isomer: IsomerPluginStart;
}

export class CustomAppPlugin implements Plugin<void, void, SetupDeps, StartDeps> {
  private readonly logger: Logger;

  constructor(initializerContext: PluginInitializerContext) {
    this.logger = initializerContext.logger.get();
  }

  setup(
    core: CoreSetup<StartDeps>,
    { embeddable, features, isomer, agentBuilder, workflowsExtensions }: SetupDeps
  ) {
    const getCoreStart = async () => (await core.getStartServices())[0];
    const getRuntime = async () => (await core.getStartServices())[1].isomer.getRuntime();

    // Registered unconditionally: the saved objects check can only vouch for what it can see.
    core.savedObjects.registerType(customAppSavedObjectType);
    features.registerKibanaFeature(customAppFeature);
    registerBuiltinCapabilities();
    isomer.registerPack(() => import('../common/pack').then(({ appPack }) => appPack));
    const router = core.http.createRouter();
    registerSavedAppRoutes(router);
    registerRenderAppRoute(router, {
      getRuntime,
      basePath: core.http.basePath,
      logger: this.logger,
    });

    embeddable.registerEmbeddableServerDefinition(CUSTOM_APP_EMBEDDABLE_TYPE, {
      title: 'Custom app',
      getSchema: () => customAppEmbeddableSchema,
      getTransforms,
    });

    if (agentBuilder) {
      // The casts are the same ones custom_content needs: the registry's types are wider than
      // the definitions' own.
      agentBuilder.attachments.registerType(
        createCustomAppContextAttachmentType() as Parameters<
          typeof agentBuilder.attachments.registerType
        >[0]
      );
      agentBuilder.tools.register(
        createUpdateCustomAppTool() as Parameters<typeof agentBuilder.tools.register>[0]
      );
      agentBuilder.tools.register(
        createCreateCustomAppTool() as Parameters<typeof agentBuilder.tools.register>[0]
      );
      agentBuilder.skills.register(customAppCreationSkill);
    }

    workflowsExtensions?.registerStepDefinition(
      renderAppStepDefinition({ getCoreStart, getRuntime })
    );
  }

  start(_core: CoreStart, { isomer }: StartDeps) {
    // Documents are checked against the primitives of every pack, those of other plugins too.
    isomer.getRuntime().then(
      ({ primitives }) => registerPackPrimitives(primitives),
      (error) => this.logger.error(`Could not load the Isomer runtime: ${error}`)
    );
  }
}
