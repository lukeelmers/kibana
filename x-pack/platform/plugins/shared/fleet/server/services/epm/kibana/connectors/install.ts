/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { Logger, SavedObject } from '@kbn/core/server';
import type { ManagedConnectorSpecsClient } from '@kbn/actions-plugin/server';

import { FleetError } from '../../../../errors';
import type {
  Installation,
  KibanaAssetReference,
  PackageInstallContext,
} from '../../../../../common/types';
import { KibanaAssetType, KibanaSavedObjectType } from '../../../../../common/types';
import { getPathParts } from '../../archive';

const CONNECTOR_FILE_EXTENSION = '.yml';

/** Owner recorded on the connector specs a package installs, so only that package can change them. */
export const getPackageConnectorOwner = (packageName: string) => `fleet:${packageName}`;

/** Matches `<pkgkey>/kibana/connector/<name>.yml`. The connector type id and version are in the YAML. */
export const isConnectorAssetPath = (path: string) => {
  const { service, type } = getPathParts(path);
  return (
    service === 'kibana' &&
    type === KibanaAssetType.connector &&
    path.endsWith(CONNECTOR_FILE_EXTENSION)
  );
};

/** Connector refs saved by the package, which the Kibana assets step would otherwise overwrite. */
export const getInstalledConnectorRefs = (
  installedPkg: SavedObject<Installation> | undefined
): KibanaAssetReference[] =>
  installedPkg?.attributes.installed_kibana?.filter(
    ({ type }) => type === KibanaSavedObjectType.connector
  ) ?? [];

/** Removes the given connector refs; failures are logged, or thrown when `strict` is set. */
export const uninstallConnectors = async ({
  client,
  refs,
  logger,
  strict = false,
}: {
  client: ManagedConnectorSpecsClient;
  refs: KibanaAssetReference[];
  logger: Logger;
  strict?: boolean;
}) => {
  const ids = refs
    .filter(({ type }) => type === KibanaSavedObjectType.connector)
    .map(({ id }) => id);
  if (!ids.length) return;
  try {
    await client.deleteSpecs(ids);
  } catch (error) {
    if (strict) throw error;
    logger.warn(`Failed to uninstall connectors ${ids.join(', ')}: ${error.message}`);
  }
};

export const installConnectors = async ({
  client,
  packageInstallContext,
  logger,
  previousRefs = [],
}: {
  client: ManagedConnectorSpecsClient;
  packageInstallContext: PackageInstallContext;
  logger: Logger;
  previousRefs?: KibanaAssetReference[];
}): Promise<KibanaAssetReference[]> => {
  const specs: Array<{ path: string; yaml: string }> = [];
  await packageInstallContext.archiveIterator.traverseEntries(async ({ path, buffer }) => {
    if (!buffer) {
      return;
    }
    specs.push({ path, yaml: buffer.toString('utf8') });
  }, isConnectorAssetPath);

  const previousIds = new Set(previousRefs.map(({ id }) => id));
  const installedIds: string[] = [];
  for (const { path, yaml } of specs) {
    try {
      const { id } = await client.upsertSpec(yaml);
      installedIds.push(id);
    } catch (error) {
      // The refs are only saved once every spec is installed, so connector types added by this
      // run would be orphaned. Connector types the package already had keep any version this run
      // stored, which stays active.
      await uninstallConnectors({
        client,
        refs: installedIds
          .filter((id) => !previousIds.has(id))
          .map((id) => ({ id, type: KibanaSavedObjectType.connector })),
        logger,
      });
      throw new FleetError(`Failed to install connector ${path}: ${error.message}`);
    }
  }

  const currentIds = new Set(installedIds);
  await uninstallConnectors({
    client,
    refs: previousRefs.filter(({ id }) => !currentIds.has(id)),
    logger,
  });

  return [...currentIds].map((id) => ({ id, type: KibanaSavedObjectType.connector }));
};
