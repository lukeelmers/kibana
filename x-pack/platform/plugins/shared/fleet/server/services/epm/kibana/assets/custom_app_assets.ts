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
import {
  getPackageWorkflowId,
  isWorkflowAssetPath,
  WORKFLOW_FILE_EXTENSION,
} from '../workflows/install';

import type { ArchiveAsset } from './install';

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
 * Package files name workflows by file name (`kibana/workflow/<name>.yml` is `<name>`), but Fleet
 * installs them under a space-specific id. Rewrites every `workflow` reference of a custom app that
 * names a workflow file of the same package to the id it is installed under in `spaceId`. Other
 * references are left as they are.
 */
export const resolveCustomAppWorkflowReferences = ({
  asset,
  packagePaths,
  packageName,
  spaceId,
}: {
  asset: ArchiveAsset;
  packagePaths: string[];
  packageName: string;
  spaceId: string;
}): ArchiveAsset => {
  const workflowIds = new Map<string, string>();
  for (const path of packagePaths.filter(isWorkflowAssetPath)) {
    const name = getPathParts(path).file.slice(0, -WORKFLOW_FILE_EXTENSION.length);
    const workflowId = getPackageWorkflowId({ spaceId, packageName, path });
    if (workflowId) {
      workflowIds.set(name, workflowId);
    }
  }
  if (workflowIds.size === 0 || !asset.references?.length) {
    return asset;
  }
  return {
    ...asset,
    references: asset.references.map((reference) => {
      const workflowId =
        reference.type === KibanaSavedObjectType.workflow
          ? workflowIds.get(reference.id)
          : undefined;
      return workflowId ? { ...reference, id: workflowId } : reference;
    }),
  };
};
