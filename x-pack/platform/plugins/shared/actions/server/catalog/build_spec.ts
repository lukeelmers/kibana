/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type {
  ActionContext,
  AuthTypeDef,
  ConnectorMetadata,
  ConnectorSpec,
} from '@kbn/connector-specs';
import { authTypeSpecs } from '@kbn/connector-specs/server';
import { z } from '@kbn/zod/v4';
import { declarativeJsonSchemaToZod } from './json_schema';
import { executeDeclarativeRequest } from './runtime';
import type { DeclarativeConnectorSpec } from './types';

const registeredAuthTypeIds = new Set(Object.values(authTypeSpecs).map(({ id }) => id));

const buildAuthTypes = (connector: DeclarativeConnectorSpec): Array<string | AuthTypeDef> => {
  return connector.auth.types.map((authType) => {
    const authTypeId = typeof authType === 'string' ? authType : authType.type;
    if (!registeredAuthTypeIds.has(authTypeId)) {
      throw new Error(
        `Declarative connector "${connector.id}" uses auth type "${authTypeId}", which is not registered in this Kibana version.`
      );
    }
    if (typeof authType === 'string') return authType;
    const { prefix: _prefix, ...authTypeDefinition } = authType;
    return authTypeDefinition;
  });
};

export const buildConnectorSpec = (connector: DeclarativeConnectorSpec): ConnectorSpec => {
  const configSchema = declarativeJsonSchemaToZod(connector.config, 'config');
  if (!(configSchema instanceof z.ZodObject)) {
    throw new Error(`Declarative connector "${connector.id}" config must be an object schema.`);
  }
  const actions = Object.fromEntries(
    Object.entries(connector.actions).map(([actionId, action]) => [
      actionId,
      {
        description: action.description,
        isTool: action.isTool,
        scope: action.scope,
        input: declarativeJsonSchemaToZod(action.input, `actions.${actionId}.input`),
        handler: async (context: ActionContext, input: unknown) =>
          executeDeclarativeRequest({
            context,
            connector,
            request: action.request,
            input: input as Record<string, unknown>,
          }),
      },
    ])
  ) as ConnectorSpec['actions'];

  return {
    metadata: {
      ...connector.metadata,
      id: connector.id,
      supportedFeatureIds: connector.metadata
        .supportedFeatureIds as ConnectorMetadata['supportedFeatureIds'],
    },
    auth: {
      types: buildAuthTypes(connector),
    },
    schema: configSchema,
    actions,
    test: {
      enabled: true,
      description: connector.test.description,
      handler: async (context) =>
        executeDeclarativeRequest({
          context,
          connector,
          request: connector.test.request,
          input: {},
        }),
    },
  };
};
