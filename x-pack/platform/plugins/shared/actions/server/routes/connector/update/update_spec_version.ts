/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { schema } from '@kbn/config-schema';
import type { IRouter } from '@kbn/core/server';
import type { ILicenseState } from '../../../lib';
import { INTERNAL_BASE_ACTION_API_PATH } from '../../../../common';
import type { ActionsRequestHandlerContext } from '../../../types';
import { verifyAccessAndContext } from '../../verify_access_and_context';
import { transformConnectorResponseV1 } from '../common_transforms';
import { DEFAULT_ACTION_ROUTE_SECURITY } from '../../constants';
import { errorHandler } from '../error_handler';
import type { ActionsConfigurationUtilities } from '../../../actions_config';

export const updateConnectorSpecVersionRoute = (
  router: IRouter<ActionsRequestHandlerContext>,
  licenseState: ILicenseState,
  actionsConfigUtils: ActionsConfigurationUtilities
) => {
  router.post(
    {
      path: `${INTERNAL_BASE_ACTION_API_PATH}/connector/{id}/_spec_version`,
      security: DEFAULT_ACTION_ROUTE_SECURITY,
      options: {
        access: 'internal',
        summary: 'Update a connector to another spec version of its type',
      },
      validate: {
        params: schema.object({ id: schema.string() }),
        body: schema.object({
          spec_version: schema.string({ maxLength: 16 }),
        }),
      },
    },
    router.handleLegacyErrors(
      verifyAccessAndContext(licenseState, async function (context, req, res) {
        try {
          const actionsClient = (await context.actions).getActionsClient();
          return res.ok({
            body: transformConnectorResponseV1(
              await actionsClient.updateSpecVersion({
                id: req.params.id,
                specVersion: req.body.spec_version,
              }),
              { includeInboundEventsField: actionsConfigUtils.isInboundEventsEnabled() }
            ),
          });
        } catch (error) {
          return errorHandler(res, error);
        }
      })
    )
  );
};
