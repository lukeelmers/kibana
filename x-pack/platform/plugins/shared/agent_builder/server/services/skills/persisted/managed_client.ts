/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { Logger } from '@kbn/logging';
import type { ElasticsearchClient } from '@kbn/core-elasticsearch-server';
import { createBadRequestError, skillCreateRequestSchema } from '@kbn/agent-builder-common';
import type { ManagedSkillsClient } from '@kbn/agent-builder-server/skills';
import { createClient } from './client';

/**
 * Writes the skills of one owner in one space with the internal user. Used by installers that run
 * without a user request, such as Fleet installing a package's `kibana/skill` assets.
 */
export const createManagedSkillsClient = ({
  space,
  managedBy,
  esClient,
  logger,
}: {
  space: string;
  managedBy: string;
  esClient: ElasticsearchClient;
  logger: Logger;
}): ManagedSkillsClient => {
  if (!managedBy) {
    throw createBadRequestError('A managed skill owner is required.');
  }
  const client = createClient({ space, esClient, logger });

  return {
    async upsert(skill) {
      const parsed = skillCreateRequestSchema.safeParse({
        ...skill,
        tool_ids: skill.tool_ids ?? [],
      });
      if (!parsed.success) {
        throw createBadRequestError(
          `Invalid skill '${skill.id}': ${parsed.error.issues
            .map(({ message }) => message)
            .join('; ')}`
        );
      }
      await client.upsertManaged(parsed.data, managedBy);
    },
    async delete(skillId) {
      await client.deleteManaged(skillId, managedBy);
    },
    async get(skillId) {
      const [skill] = await client.bulkGet([skillId]);
      if (!skill || skill.managed_by !== managedBy) {
        return undefined;
      }
      return {
        id: skill.id,
        name: skill.name,
        description: skill.description,
        content: skill.content,
        tool_ids: skill.tool_ids,
        referenced_content: skill.referenced_content,
      };
    },
  };
};
