/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { z, lazySchema } from '@kbn/zod/v4';
import { actionSchema, type ActionList } from '@kbn/custom-app-registry';
import { MAX_ACTIONS_PER_EVENT, MAX_LIST_ITEMS, MAX_STATE_STRING_LENGTH } from './constants';

/** A text, a number or a boolean, as a value of the app. */
export const stateValueSchema = lazySchema(() =>
  z.union([z.string().max(MAX_STATE_STRING_LENGTH), z.number().finite(), z.boolean()])
);

/** A list of texts, such as the usernames to look for. */
export const listValueSchema = lazySchema(() =>
  z.array(z.string().max(MAX_STATE_STRING_LENGTH)).max(MAX_LIST_ITEMS)
);

/**
 * A value of the app, declared by its default, so that a query that uses it always has a value. Its
 * type is that of the default: a text, a number, a boolean, or a list of texts.
 */
export const stateDefaultSchema = lazySchema(() => z.union([stateValueSchema, listValueSchema]));

export { actionSchema };

/** What an event can do: one of the actions that are registered, or a few in order. */
export const actionsSchema: z.ZodType<ActionList> = lazySchema(() =>
  z.union([actionSchema, z.array(actionSchema).max(MAX_ACTIONS_PER_EVENT)])
);
