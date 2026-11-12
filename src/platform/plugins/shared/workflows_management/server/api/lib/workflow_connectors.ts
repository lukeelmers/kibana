/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { WorkflowsConnectorFeatureId } from '@kbn/actions-plugin/common/connector_feature_config';
import type {
  ActionsClient,
  PluginStartContract as ActionsPluginStartContract,
  IUnsecuredActionsClient,
} from '@kbn/actions-plugin/server';
import type { FindActionResult } from '@kbn/actions-plugin/server/types';
import { connectorSpecHasEvents, connectorsSpecs } from '@kbn/connector-specs';
import type { KibanaRequest } from '@kbn/core/server';
import { brandSpaceId } from '@kbn/core-spaces-common';
import type { PublicMethodsOf } from '@kbn/utility-types';
import type { ConnectorSubAction, ConnectorTypeInfo } from '@kbn/workflows';
import type {
  ConnectorInstanceConfig,
  GetAvailableConnectorsResponse,
} from '@kbn/workflows/types/v1';
import { z } from '@kbn/zod/v4';

import {
  CONNECTOR_SUB_ACTIONS_MAP,
  getConnectorSpecSubActions,
} from '../../../common/connector_sub_actions_map';

const eventConnectorTypeIds = new Set(
  Object.values(connectorsSpecs)
    .filter(connectorSpecHasEvents)
    .map((spec) => spec.metadata.id)
);

type ListedActionType = Awaited<ReturnType<PublicMethodsOf<ActionsClient>['listTypes']>>[number];
type GetConnectorSpec = ActionsPluginStartContract['getConnectorSpec'];

/**
 * Sub-actions of bundled connector types are known statically. Types registered at run time
 * (the connector catalog) carry their actions and params as JSON Schema from the live spec.
 */
const getSubActions = (
  actionTypeId: string,
  getConnectorSpec: GetConnectorSpec
): ConnectorSubAction[] => {
  const spec = getConnectorSpec(actionTypeId);
  if (CONNECTOR_SUB_ACTIONS_MAP[actionTypeId] || !spec) {
    return CONNECTOR_SUB_ACTIONS_MAP[actionTypeId];
  }
  return getConnectorSpecSubActions(spec).map((subAction) => ({
    ...subAction,
    inputSchema: z.toJSONSchema(spec.actions[subAction.name].input, {
      unrepresentable: 'any',
      io: 'input',
    }) as Record<string, unknown>,
  }));
};

const toConnectorTypeInfo = (
  actionType: ListedActionType,
  getConnectorSpec: GetConnectorSpec
): ConnectorTypeInfo => {
  const subActions = getSubActions(actionType.id, getConnectorSpec);
  return {
    actionTypeId: actionType.id,
    displayName: actionType.name,
    instances: [],
    enabled: actionType.enabled,
    enabledInConfig: actionType.enabledInConfig,
    enabledInLicense: actionType.enabledInLicense,
    minimumLicenseRequired: actionType.minimumLicenseRequired,
    ...(subActions && { subActions }),
  };
};

const getConnectorInstanceConfig = (
  connector: FindActionResult
): { config: ConnectorInstanceConfig } | undefined => {
  const taskType =
    connector.actionTypeId === '.inference'
      ? (connector.config?.taskType as string | undefined)
      : undefined;
  const selectedActions = Array.isArray(connector.config?.selectedActions)
    ? (connector.config?.selectedActions as string[])
    : undefined;

  if (taskType !== undefined || selectedActions !== undefined) {
    return {
      config: {
        ...(taskType !== undefined ? { taskType } : {}),
        ...(selectedActions !== undefined ? { selectedActions } : {}),
      },
    };
  }

  return undefined;
};

/**
 * Lists all available connector action types and their instances for the workflows feature.
 */
export const getAvailableConnectors = async (params: {
  getActionsClient: () => Promise<IUnsecuredActionsClient>;
  getActionsClientWithRequest: (request: KibanaRequest) => Promise<PublicMethodsOf<ActionsClient>>;
  getConnectorSpec: GetConnectorSpec;
  spaceId: string;
  request: KibanaRequest;
}): Promise<GetAvailableConnectorsResponse> => {
  const { getActionsClient, getActionsClientWithRequest, getConnectorSpec, spaceId, request } =
    params;
  const actionsClient = await getActionsClient();
  const actionsClientWithRequest = await getActionsClientWithRequest(request);

  const [connectors, actionTypes] = await Promise.all([
    actionsClient.getAll(brandSpaceId(spaceId)),
    actionsClientWithRequest.listTypes({
      featureId: WorkflowsConnectorFeatureId,
      includeSystemActionTypes: false,
    }),
  ]);

  const connectorTypes: Record<string, ConnectorTypeInfo> = {};

  actionTypes.forEach((actionType) => {
    connectorTypes[actionType.id] = toConnectorTypeInfo(actionType, getConnectorSpec);
  });

  const missingEventTypeIds = [...eventConnectorTypeIds].filter((id) => !connectorTypes[id]);
  if (missingEventTypeIds.length > 0) {
    const allActionTypes = await actionsClientWithRequest.listTypes({
      includeSystemActionTypes: false,
    });
    for (const actionType of allActionTypes) {
      if (missingEventTypeIds.includes(actionType.id)) {
        connectorTypes[actionType.id] = toConnectorTypeInfo(actionType, getConnectorSpec);
      }
    }
  }

  connectors.forEach((connector: FindActionResult) => {
    if (connectorTypes[connector.actionTypeId]) {
      connectorTypes[connector.actionTypeId].instances.push({
        id: connector.id,
        name: connector.name,
        isPreconfigured: connector.isPreconfigured,
        isDeprecated: connector.isDeprecated,
        ...getConnectorInstanceConfig(connector),
      });
    }
  });

  return { connectorTypes, totalConnectors: connectors.length };
};
