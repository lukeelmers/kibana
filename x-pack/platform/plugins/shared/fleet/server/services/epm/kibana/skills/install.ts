/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { Logger, SavedObject } from '@kbn/core/server';
import type { ManagedSkill, ManagedSkillsClient } from '@kbn/agent-builder-server';
import { splitFrontmatter } from '@kbn/agent-builder-skill-loader';

import { FleetError } from '../../../../errors';
import type {
  Installation,
  KibanaAssetReference,
  PackageInstallContext,
} from '../../../../../common/types';
import { KibanaSavedObjectType } from '../../../../../common/types';

const SKILL_FILE_NAME = 'SKILL.md';

/** Owner recorded on the skills a package installs, so only that package can change them. */
export const getPackageSkillOwner = (packageName: string) => `fleet:${packageName}`;

/**
 * Matches `<pkgkey>/kibana/skill/<skill id>/SKILL.md`, the layout Agent Builder plugins use for
 * skills (`skills/<name>/SKILL.md`). The directory name is the skill id.
 */
export const isSkillAssetPath = (path: string) => {
  const parts = path.split('/');
  return (
    parts.length === 5 &&
    parts[1] === 'kibana' &&
    parts[2] === KibanaSavedObjectType.skill &&
    parts[4] === SKILL_FILE_NAME
  );
};

/** Skill refs saved for the given space, which the Kibana assets step would otherwise overwrite. */
export const getInstalledSkillRefs = (
  installedPkg: SavedObject<Installation> | undefined,
  spaceId: string,
  installAsAdditionalSpace: boolean
): KibanaAssetReference[] =>
  (installAsAdditionalSpace
    ? installedPkg?.attributes.additional_spaces_installed_kibana?.[spaceId]
    : installedPkg?.attributes.installed_kibana
  )?.filter(({ type }) => type === KibanaSavedObjectType.skill) ?? [];

const toToolIds = (allowedTools: unknown): string[] | undefined => {
  if (typeof allowedTools === 'string') {
    return allowedTools
      .split(',')
      .map((tool) => tool.trim())
      .filter((tool) => tool.length > 0);
  }
  if (Array.isArray(allowedTools) && allowedTools.every((tool) => typeof tool === 'string')) {
    return allowedTools;
  }
  return undefined;
};

/**
 * Reads a `SKILL.md` file: frontmatter `name`, `description` and optional `allowed-tools`
 * (comma-separated or a list, as in Agent Builder plugins), and the markdown body as content.
 * The full input validation happens in Agent Builder when the skill is written.
 */
export const parseSkillAsset = (path: string, buffer: Buffer): ManagedSkill => {
  const id = path.split('/')[3];
  const { frontmatter, body, error } = splitFrontmatter(buffer.toString('utf8'));
  if (!frontmatter) {
    throw new FleetError(
      `Skill asset ${path} must start with YAML frontmatter${error ? `: ${error}` : ''}`
    );
  }
  const { name, description, 'allowed-tools': allowedTools } = frontmatter;
  if (typeof name !== 'string' || typeof description !== 'string') {
    throw new FleetError(`Skill asset ${path} needs a name and a description in its frontmatter`);
  }
  const toolIds = toToolIds(allowedTools);
  if (allowedTools !== undefined && toolIds === undefined) {
    throw new FleetError(`Skill asset ${path} has an invalid allowed-tools value`);
  }
  return { id, name, description, content: body, ...(toolIds ? { tool_ids: toolIds } : {}) };
};

/** Removes the given skill refs; failures are logged, or thrown when `strict` is set. */
export const uninstallSkills = async ({
  client,
  refs,
  logger,
  strict = false,
}: {
  client: ManagedSkillsClient;
  refs: KibanaAssetReference[];
  logger: Logger;
  strict?: boolean;
}) => {
  for (const { id } of refs.filter(({ type }) => type === KibanaSavedObjectType.skill)) {
    try {
      await client.delete(id);
    } catch (error) {
      if (strict) throw error;
      logger.warn(`Failed to uninstall skill ${id}: ${error.message}`);
    }
  }
};

/**
 * Writes the package's skills for one space. An upgrade rewrites each skill in place and removes
 * skills the new version no longer ships.
 */
export const installSkills = async ({
  client,
  packageInstallContext,
  logger,
  previousRefs = [],
}: {
  client: ManagedSkillsClient;
  packageInstallContext: PackageInstallContext;
  logger: Logger;
  previousRefs?: KibanaAssetReference[];
}): Promise<KibanaAssetReference[]> => {
  const skills: ManagedSkill[] = [];
  await packageInstallContext.archiveIterator.traverseEntries(async ({ path, buffer }) => {
    if (!buffer) {
      return;
    }
    skills.push(parseSkillAsset(path, buffer));
  }, isSkillAssetPath);

  const previousIds = new Set(previousRefs.map(({ id }) => id));
  const installedNewIds: string[] = [];
  for (const skill of skills) {
    try {
      await client.upsert(skill);
      if (!previousIds.has(skill.id)) {
        installedNewIds.push(skill.id);
      }
    } catch (error) {
      // The refs are only saved once every skill is installed, so skills created by this run
      // would be orphaned. In-place updates of already-installed skills are left as-is.
      await uninstallSkills({
        client,
        refs: installedNewIds.map((id) => ({ id, type: KibanaSavedObjectType.skill })),
        logger,
      });
      throw new FleetError(`Failed to install skill ${skill.id}: ${error.message}`);
    }
  }

  const refs = skills.map(({ id }) => ({ id, type: KibanaSavedObjectType.skill }));
  const currentIds = new Set(refs.map(({ id }) => id));
  await uninstallSkills({
    client,
    refs: previousRefs.filter(({ id }) => !currentIds.has(id)),
    logger,
  });

  return refs;
};
