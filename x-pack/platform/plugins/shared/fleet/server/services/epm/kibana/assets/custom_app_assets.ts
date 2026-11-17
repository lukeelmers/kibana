/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { firstValueFrom } from 'rxjs';

import { ENABLE_CUSTOM_APP_ASSETS_FLAG } from '../../../../../common/constants';
import { KibanaSavedObjectType } from '../../../../../common/types';
import { appContextService } from '../../../app_context';
import { getPathParts } from '../../archive';

import type { ArchiveAsset } from './install';

const CUSTOM_APP_FILE_EXTENSION = '.json';

export const isCustomAppAssetPath = (path: string) => {
  const { service, type } = getPathParts(path);
  return service === 'kibana' && type === 'custom_app';
};

export const isCustomAppAssetsFlagEnabled = async (): Promise<boolean> => {
  const featureFlags = appContextService.getFeatureFlags();
  if (!featureFlags) return false;
  return await firstValueFrom(featureFlags.getBooleanValue$(ENABLE_CUSTOM_APP_ASSETS_FLAG, false));
};

/**
 * Package files hold the app document only. The saved object id is the file name
 * (`kibana/custom_app/<id>.json`), and the package name is kept so the app can find its package.
 */
export const toCustomAppAsset = ({
  path,
  file,
  packageName,
}: {
  path: string;
  file: Record<string, unknown>;
  packageName: string;
}): ArchiveAsset => ({
  id: getPathParts(path).file.slice(0, -CUSTOM_APP_FILE_EXTENSION.length),
  type: KibanaSavedObjectType.customApp,
  attributes: { ...file, package: { name: packageName } },
  references: [],
});
