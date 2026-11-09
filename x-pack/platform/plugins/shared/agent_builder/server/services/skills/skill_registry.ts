/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { InternalSkillDefinition } from '@kbn/agent-builder-server/skills';
import type { ToolRegistry, AvailabilityContext } from '@kbn/agent-builder-server';
import {
  type PersistedSkillCreateRequest,
  type PersistedSkillUpdateRequest,
  createBadRequestError,
  createAgentBuilderError,
  AgentBuilderErrorCode,
  maxToolsPerSkill,
} from '@kbn/agent-builder-common';
import type { SkillRegistryListOptions } from '@kbn/agent-builder-server/runner';
import type { ReadonlySkillProvider, WritableSkillProvider } from './skill_provider';

const isUiSettingRequirementMet = (
  uiSettingRequired: string | { key: string; value: unknown },
  uiSettingValues: ReadonlyMap<string, unknown>
): boolean => {
  if (typeof uiSettingRequired === 'string') {
    return uiSettingValues.get(uiSettingRequired) === true;
  }

  if (typeof uiSettingRequired === 'object') {
    return uiSettingValues.get(uiSettingRequired.key) === uiSettingRequired.value;
  }

  return false;
};

/**
 * Validates that all provided tool IDs exist in the tool registry
 * and that the count does not exceed the per-skill limit.
 */
export const validateToolIds = async (
  toolIds: string[] | undefined,
  toolRegistry: ToolRegistry
): Promise<void> => {
  if (!toolIds || toolIds.length === 0) {
    return;
  }
  if (toolIds.length > maxToolsPerSkill) {
    throw createBadRequestError(
      `A skill can reference at most ${maxToolsPerSkill} tools, but ${toolIds.length} were provided.`
    );
  }
  const invalidIds: string[] = [];
  for (const toolId of toolIds) {
    const exists = await toolRegistry.has(toolId);
    if (!exists) {
      invalidIds.push(toolId);
    }
  }
  if (invalidIds.length > 0) {
    throw createBadRequestError(`Invalid tool IDs: ${invalidIds.join(', ')}`);
  }
};

/**
 * Replaces a built-in skill's text with a managed persisted skill of the same id.
 *
 * The package-shipped skill supplies the description and content, and its tools and referenced
 * content when it has any. Everything else, including the id, name, base path (so the skill
 * keeps its path in the skills filesystem), availability and inline tools, stays the built-in's:
 * a package can change what a skill says, not ship code.
 */
export const applySkillOverride = (
  builtin: InternalSkillDefinition,
  override: InternalSkillDefinition
): InternalSkillDefinition => {
  const hasOwnReferencedContent = override.referencedContentCount > 0;
  return {
    ...builtin,
    description: override.description,
    content: override.content,
    referencedContent: hasOwnReferencedContent
      ? override.referencedContent
      : builtin.referencedContent,
    referencedContentCount: hasOwnReferencedContent
      ? override.referencedContentCount
      : builtin.referencedContentCount,
    getRegistryTools: async () => {
      const toolIds = await override.getRegistryTools();
      return toolIds.length > 0 ? toolIds : builtin.getRegistryTools();
    },
    readonly: true,
    managed_by: override.managed_by,
  };
};

export interface SkillRegistry {
  has(skillId: string): Promise<boolean>;
  get(skillId: string): Promise<InternalSkillDefinition | undefined>;
  bulkGet(ids: string[]): Promise<Map<string, InternalSkillDefinition>>;
  list(options?: SkillRegistryListOptions): Promise<InternalSkillDefinition[]>;
  create(params: PersistedSkillCreateRequest): Promise<InternalSkillDefinition>;
  update(skillId: string, update: PersistedSkillUpdateRequest): Promise<InternalSkillDefinition>;
  delete(skillId: string): Promise<boolean>;
}

export const createSkillRegistry = ({
  builtinProvider,
  persistedProvider,
  toolRegistry,
  experimentalFeaturesEnabled,
  uiSettingValues = new Map(),
  availabilityContext,
}: {
  builtinProvider: ReadonlySkillProvider;
  persistedProvider: WritableSkillProvider;
  toolRegistry: ToolRegistry;
  experimentalFeaturesEnabled: boolean;
  uiSettingValues?: ReadonlyMap<string, unknown>;
  availabilityContext?: AvailabilityContext;
}): SkillRegistry => {
  const isVisible = (skill: InternalSkillDefinition): boolean => {
    if (skill.experimental && !experimentalFeaturesEnabled) {
      return false;
    }
    if (
      skill.uiSettingRequired &&
      !isUiSettingRequirementMet(skill.uiSettingRequired, uiSettingValues)
    ) {
      return false;
    }
    return true;
  };

  const isAvailable = async (skill: InternalSkillDefinition): Promise<boolean> => {
    if (!isVisible(skill)) {
      return false;
    }
    if (skill.isAvailable && availabilityContext) {
      const result = await skill.isAvailable(availabilityContext);
      return result.status === 'available';
    }
    return true;
  };

  const filterAvailable = async (
    skills: InternalSkillDefinition[]
  ): Promise<InternalSkillDefinition[]> => {
    const checks = await Promise.all(skills.map(isAvailable));
    return skills.filter((_, i) => checks[i]);
  };

  /**
   * The managed persisted skill that replaces a built-in skill with the same id, if any.
   * Unmanaged persisted skills never replace a built-in (they cannot be created with a built-in id).
   */
  const isOverride = (persisted: InternalSkillDefinition | undefined) =>
    persisted !== undefined && !!persisted.managed_by;

  const getVisible = async (skill: InternalSkillDefinition | undefined) =>
    skill && (await isAvailable(skill)) ? skill : undefined;

  return {
    async has(skillId) {
      // An override never changes whether a built-in skill is available.
      const builtinSkill = await builtinProvider.get(skillId);
      if (builtinSkill) {
        return isAvailable(builtinSkill);
      }
      const persistedSkill = await persistedProvider.get(skillId);
      if (persistedSkill) {
        return isAvailable(persistedSkill);
      }
      return false;
    },

    async get(skillId) {
      const builtin = await builtinProvider.get(skillId);
      if (builtin) {
        if (!(await isAvailable(builtin))) {
          return undefined;
        }
        const persisted = await persistedProvider.get(skillId);
        return isOverride(persisted) ? applySkillOverride(builtin, persisted!) : builtin;
      }
      return getVisible(await persistedProvider.get(skillId));
    },

    async bulkGet(ids) {
      const [builtinResult, persistedResult] = await Promise.all([
        builtinProvider.bulkGet(ids),
        persistedProvider.bulkGet(ids),
      ]);
      const result = new Map<string, InternalSkillDefinition>();
      for (const id of ids) {
        const builtin = builtinResult.get(id);
        const persisted = persistedResult.get(id);
        if (builtin) {
          if (await isAvailable(builtin)) {
            result.set(
              id,
              isOverride(persisted) ? applySkillOverride(builtin, persisted!) : builtin
            );
          }
        } else {
          const visible = await getVisible(persisted);
          if (visible) {
            result.set(id, visible);
          }
        }
      }
      return result;
    },

    async list(options) {
      const { type, includePlugins, includeHidden, ...listOptions } = options ?? {};
      // Persisted skills are always listed: they hold the overrides of built-in skills.
      const [builtinSkills, persistedSkills] = await Promise.all([
        type === 'persisted' ? [] : builtinProvider.list(listOptions),
        persistedProvider.list(listOptions),
      ]);
      const overrides = new Map(
        persistedSkills.filter((skill) => isOverride(skill)).map((skill) => [skill.id, skill])
      );
      const builtinIds = new Set(builtinSkills.map((skill) => skill.id));
      if (type === 'persisted') {
        // Built-ins are not listed then, but their overrides are still not skills of their own.
        for (const id of overrides.keys()) {
          if (await builtinProvider.has(id)) builtinIds.add(id);
        }
      }
      const builtinResults = builtinSkills.map((skill) => {
        const override = overrides.get(skill.id);
        return override ? applySkillOverride(skill, override) : skill;
      });
      // A persisted skill with a built-in id is listed once, as the (overridden) built-in.
      const persistedResults =
        type === 'built-in' ? [] : persistedSkills.filter((skill) => !builtinIds.has(skill.id));

      let results: InternalSkillDefinition[] =
        type === 'persisted'
          ? persistedResults
          : [...builtinResults, ...(type === 'built-in' ? [] : persistedResults)];
      if (!includePlugins) {
        results = results.filter((skill) => !skill.plugin_id);
      }
      if (!includeHidden) {
        results = results.filter((skill) => !skill.hidden);
      }
      return filterAvailable(results);
    },

    async create(params) {
      const existsInBuiltin = await builtinProvider.has(params.id);
      if (existsInBuiltin) {
        throw createAgentBuilderError(
          AgentBuilderErrorCode.badRequest,
          `Skill with id '${params.id}' already exists as a built-in skill.`,
          { statusCode: 409 }
        );
      }
      const existsInPersisted = await persistedProvider.has(params.id);
      if (existsInPersisted) {
        throw createAgentBuilderError(
          AgentBuilderErrorCode.badRequest,
          `Skill with id '${params.id}' already exists.`,
          { statusCode: 409 }
        );
      }
      await validateToolIds(params.tool_ids, toolRegistry);
      return persistedProvider.create(params);
    },

    async update(skillId, updateRequest) {
      const existsInBuiltin = await builtinProvider.has(skillId);
      if (existsInBuiltin) {
        throw createBadRequestError(`Skill '${skillId}' is read-only`);
      }
      await validateToolIds(updateRequest.tool_ids, toolRegistry);
      return persistedProvider.update(skillId, updateRequest);
    },

    async delete(skillId) {
      const existsInBuiltin = await builtinProvider.has(skillId);
      if (existsInBuiltin) {
        throw createBadRequestError(`Skill '${skillId}' is read-only`);
      }
      await persistedProvider.delete(skillId);
      return true;
    },
  };
};
