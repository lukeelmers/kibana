/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import Boom from '@hapi/boom';
import type { ActionsClientContext } from '../../../../actions_client';
import { ConnectorAuditAction, connectorAuditEvent } from '../../../../lib/audit_events';
import { validateConfig, validateSecrets } from '../../../../lib';
import type { RawAction } from '../../../../types';
import type { Connector } from '../../types';
import { get } from '../get';

export interface UpdateSpecVersionParams {
  context: ActionsClientContext;
  id: string;
  specVersion: string;
}

/**
 * Moves a connector to another stored spec version of its type, once its stored config and
 * secrets validate against that version. Connectors otherwise stay on the version they were
 * created with.
 */
export async function updateSpecVersion({
  context,
  id,
  specVersion,
}: UpdateSpecVersionParams): Promise<Connector> {
  await context.authorization.ensureAuthorized({ operation: 'update' });

  const spaceId = context.spaceId ?? context.spaces?.getSpaceId(context.request);
  const { attributes, references, version } =
    await context.encryptedSavedObjectsClient.getDecryptedAsInternalUser<RawAction>(
      'action',
      id,
      spaceId && spaceId !== 'default' ? { namespace: spaceId } : {}
    );
  const actionType = context.actionTypeRegistry.get(attributes.actionTypeId);
  if (!actionType.specVersions?.hasVersion(specVersion)) {
    throw Boom.badRequest(
      `Spec version "${specVersion}" of connector type "${actionType.id}" is not installed`
    );
  }

  const validatorServices = {
    configurationUtilities: context.actionTypeRegistry.getUtils(),
    specVersion,
  };
  try {
    validateConfig(actionType, attributes.config, validatorServices);
    validateSecrets(actionType, attributes.secrets, validatorServices);
  } catch (error) {
    throw Boom.badRequest(
      `Connector "${id}" is not compatible with spec version "${specVersion}": ${error.message}`
    );
  }

  context.auditLogger?.log(
    connectorAuditEvent({
      action: ConnectorAuditAction.UPDATE,
      savedObject: { type: 'action', id },
      outcome: 'unknown',
    })
  );
  // Rewritten whole because `specVersion` is part of the encryption AAD
  await context.unsecuredSavedObjectsClient.create<RawAction>(
    'action',
    { ...attributes, specVersion },
    { id, overwrite: true, references, version }
  );

  return get({ context, id });
}
