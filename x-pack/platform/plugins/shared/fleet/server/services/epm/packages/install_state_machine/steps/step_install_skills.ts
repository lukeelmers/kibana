/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { firstValueFrom } from 'rxjs';

import { DEFAULT_SPACE_ID } from '@kbn/core-spaces-common';

import { ENABLE_SKILL_ASSETS_FLAG } from '../../../../../../common/constants';

import { KibanaSavedObjectType } from '../../../../../../common/types';
import { appContextService } from '../../../../app_context';
import { withPackageSpan } from '../../utils';
import type { InstallContext } from '../_state_machine_package_install';
import { saveKibanaAssetsRefs } from '../../install';
import {
  getInstalledSkillRefs,
  getPackageSkillOwner,
  installSkills,
  isSkillAssetPath,
} from '../../../kibana/skills/install';

const isSkillAssetsFlagEnabled = async (): Promise<boolean> => {
  const featureFlags = appContextService.getFeatureFlags();
  if (!featureFlags) return false;
  return await firstValueFrom(featureFlags.getBooleanValue$(ENABLE_SKILL_ASSETS_FLAG, false));
};

/**
 * Installs `kibana/skill/<id>/SKILL.md` assets as Agent Builder skills, in the install space and,
 * on a primary-space upgrade, in every additional space (like the workflows step).
 */
export const stepInstallSkills = async (
  context: Pick<
    InstallContext,
    'logger' | 'savedObjectsClient' | 'packageInstallContext' | 'spaceId' | 'installedPkg'
  >
) => {
  const { logger, savedObjectsClient, packageInstallContext, spaceId, installedPkg } = context;

  const installAsAdditionalSpace = installedPkg
    ? (installedPkg.attributes.installed_kibana_space_id ?? DEFAULT_SPACE_ID) !== spaceId
    : false;
  const { name: pkgName } = packageInstallContext.packageInfo;

  const hasSkillAssets = packageInstallContext.paths.some(isSkillAssetPath);
  const primarySpaceId = installedPkg?.attributes.installed_kibana_space_id ?? DEFAULT_SPACE_ID;
  const additionalSpaceIds =
    installedPkg && !installAsAdditionalSpace
      ? Object.keys(installedPkg.attributes.additional_spaces_installed_kibana ?? {}).filter(
          (additionalSpaceId) => additionalSpaceId !== primarySpaceId
        )
      : [];
  const targets = [
    { targetSpaceId: spaceId, asAdditionalSpace: installAsAdditionalSpace },
    ...additionalSpaceIds.map((targetSpaceId) => ({ targetSpaceId, asAdditionalSpace: true })),
  ].map((target) => ({
    ...target,
    previousRefs: getInstalledSkillRefs(
      installedPkg,
      target.targetSpaceId,
      target.asAdditionalSpace
    ),
  }));

  if (!hasSkillAssets && targets.every(({ previousRefs }) => !previousRefs.length)) {
    return;
  }

  const skills = (await isSkillAssetsFlagEnabled())
    ? appContextService.getAgentBuilderSkills()
    : undefined;
  if (!skills) {
    // Like workflows: when Agent Builder is disabled or fleet.enableSkillAssets is off, skip the
    // skills entirely, with no deferred refs and nothing shown in the Assets tab.
    logger.warn('Agent Builder skills are not available, skipping skill assets installation');
    return;
  }

  await withPackageSpan('Install skills', async () => {
    for (const { targetSpaceId, asAdditionalSpace, previousRefs } of targets) {
      if (!hasSkillAssets && !previousRefs.length) continue;
      const assetRefs = await installSkills({
        client: skills.getManagedClient({
          spaceId: targetSpaceId,
          managedBy: getPackageSkillOwner(pkgName),
        }),
        packageInstallContext,
        logger,
        previousRefs,
      });
      await saveKibanaAssetsRefs(
        savedObjectsClient,
        pkgName,
        assetRefs,
        targetSpaceId,
        asAdditionalSpace,
        true,
        [KibanaSavedObjectType.skill]
      );
    }
  });
};
