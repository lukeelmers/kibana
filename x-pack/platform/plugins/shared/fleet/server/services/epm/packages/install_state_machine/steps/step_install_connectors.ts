/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { firstValueFrom } from 'rxjs';

import { DEFAULT_SPACE_ID } from '@kbn/core-spaces-common';

import { ENABLE_CONNECTOR_ASSETS_FLAG } from '../../../../../../common/constants';

import { KibanaSavedObjectType } from '../../../../../../common/types';
import { appContextService } from '../../../../app_context';
import { withPackageSpan } from '../../utils';
import type { InstallContext } from '../_state_machine_package_install';
import { saveKibanaAssetsRefs } from '../../install';
import {
  getInstalledConnectorRefs,
  getPackageConnectorOwner,
  installConnectors,
  isConnectorAssetPath,
} from '../../../kibana/connectors/install';

const isConnectorAssetsFlagEnabled = async (): Promise<boolean> => {
  const featureFlags = appContextService.getFeatureFlags();
  if (!featureFlags) return false;
  return await firstValueFrom(featureFlags.getBooleanValue$(ENABLE_CONNECTOR_ASSETS_FLAG, false));
};

/**
 * Installs `kibana/connector/<name>.yml` assets as connector types. Connector types are global,
 * so installing the package's Kibana assets into an additional space does not reinstall them.
 */
export const stepInstallConnectors = async (
  context: Pick<
    InstallContext,
    'logger' | 'savedObjectsClient' | 'packageInstallContext' | 'spaceId' | 'installedPkg'
  >
) => {
  const { logger, savedObjectsClient, packageInstallContext, spaceId, installedPkg } = context;

  const primarySpaceId = installedPkg?.attributes.installed_kibana_space_id ?? DEFAULT_SPACE_ID;
  if (installedPkg && primarySpaceId !== spaceId) {
    return;
  }
  const { name: pkgName } = packageInstallContext.packageInfo;
  const hasConnectorAssets = packageInstallContext.paths.some(isConnectorAssetPath);
  const previousRefs = getInstalledConnectorRefs(installedPkg);
  if (!hasConnectorAssets && !previousRefs.length) {
    return;
  }

  const catalog = (await isConnectorAssetsFlagEnabled())
    ? appContextService.getConnectorCatalog()
    : undefined;
  if (!catalog) {
    logger.warn('The connector catalog is not available, skipping connector assets installation');
    return;
  }

  await withPackageSpan('Install connectors', async () => {
    const assetRefs = await installConnectors({
      client: catalog.getManagedClient({ managedBy: getPackageConnectorOwner(pkgName) }),
      packageInstallContext,
      logger,
      previousRefs,
    });
    await saveKibanaAssetsRefs(savedObjectsClient, pkgName, assetRefs, spaceId, false, true, [
      KibanaSavedObjectType.connector,
    ]);
  });
};
