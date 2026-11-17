/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { z } from '@kbn/zod/v4';
import { getAction, listActions } from './capability_registry';
import type { Action, ActionList } from '.';

/** The id of the action an object is: its key that names a registered action. */
export const actionKind = (action: object): string | undefined =>
  Object.keys(action).find((key) => getAction(key) !== undefined);

/** The actions of an event, as a list, when it has a single one. */
export const toActionArray = (actions: ActionList): readonly Action[] =>
  Array.isArray(actions) ? actions : [actions as Action];

/** The schema of each action: its settings, and nothing else beside them. */
export const getActionSchemas = (): readonly z.ZodObject<z.ZodRawShape>[] =>
  listActions().map((action) =>
    action.props.strict()
  ) as unknown as readonly z.ZodObject<z.ZodRawShape>[];

/**
 * An action of any type, keyed by its id, such as { "flyout": "details" }. It is made when it is
 * first used, so that the actions are there. The key check is a preprocess so that the JSON
 * Schema shown to a model is still that of the actions.
 */
export const actionSchema: z.ZodType<Action> = z.lazy(
  () =>
    z.preprocess((action, ctx) => {
      if (
        typeof action === 'object' &&
        action !== null &&
        Object.keys(action).filter((key) => getAction(key)).length !== 1
      ) {
        ctx.addIssue({
          code: 'custom',
          message: `An action has exactly one of the keys ${listActions()
            .map(({ id }) => `"${id}"`)
            .join(', ')}`,
          // Keeps this message, not "Invalid input", when the action is in a list.
          continue: true,
        });
      }
      return action;
    }, z.union(getActionSchemas() as never)) as unknown as z.ZodType<Action>
);
