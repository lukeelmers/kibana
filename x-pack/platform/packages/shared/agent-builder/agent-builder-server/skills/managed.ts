/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { SkillReferencedContent } from '@kbn/agent-builder-common';

/**
 * A skill written by an installer outside Agent Builder, such as a Fleet package.
 */
export interface ManagedSkill {
  id: string;
  name: string;
  description: string;
  content: string;
  /**
   * Tool ids from the tool registry. When the skill replaces a built-in skill and this is
   * empty or omitted, the built-in's registry tools are used.
   */
  tool_ids?: string[];
  referenced_content?: SkillReferencedContent[];
}

/**
 * Writes the skills of one owner (`managedBy`) in one space, without a user request.
 * For this PoC, any package may override any built-in skill id.
 */
export interface ManagedSkillsClient {
  /**
   * Creates the skill, or replaces it when it already belongs to this owner.
   * Throws when the input is invalid, or the id is used by a user skill or another owner.
   */
  upsert(skill: ManagedSkill): Promise<void>;
  /**
   * Deletes the skill when it belongs to this owner. Missing skills are ignored.
   */
  delete(skillId: string): Promise<void>;
  /**
   * Returns the skill when it belongs to this owner.
   */
  get(skillId: string): Promise<ManagedSkill | undefined>;
}
