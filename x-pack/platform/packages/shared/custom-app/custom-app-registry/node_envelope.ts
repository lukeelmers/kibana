/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { z, lazySchema } from '@kbn/zod/v4';
import {
  MAX_ACTIONS_PER_EVENT,
  MAX_NODE_ID_LENGTH,
  MAX_QUERY_LENGTH,
  MAX_STATE_KEY_LENGTH,
  MAX_STATE_STRING_LENGTH,
  RESERVED_STATE_KEYS,
} from './constants';
import { actionSchema } from './action_schema';

/** The id of a node, which only a node that something refers to needs. */
export const nodeIdSchema = lazySchema(() =>
  z
    .string()
    .min(1)
    .max(MAX_NODE_ID_LENGTH)
    .regex(/^[A-Za-z0-9_-]+$/)
);

/** A valid ES|QL parameter name, so a state key can be used as `?key` in a query. */
export const stateKeySchema = lazySchema(() =>
  z
    .string()
    .max(MAX_STATE_KEY_LENGTH)
    .regex(/^[A-Za-z_][A-Za-z0-9_]*$/)
    .refine((key) => !RESERVED_STATE_KEYS.includes(key.toLowerCase()), {
      message: `Reserved by ES|QL for the time range: ${RESERVED_STATE_KEYS.join(', ')}`,
    })
);

/**
 * Whether a component is shown: when the key is true, or, with `equals`, when it is that value, such
 * as the option of a select. Left out, it is always shown.
 */
export const visibleWhenSchema = lazySchema(() =>
  z
    .object({
      $state: stateKeySchema,
      equals: z
        .union([z.string().max(MAX_STATE_STRING_LENGTH), z.number().finite(), z.boolean()])
        .optional(),
    })
    .optional()
);

export type VisibleWhen = NonNullable<z.output<typeof visibleWhenSchema>>;

/** The events a node can have handlers for, each the name of its property. */
export const NODE_EVENTS = ['onClick', 'onRowClick', 'onSubmit', 'onChange'] as const;

const handlers = (when: string) =>
  z
    .union([actionSchema, z.array(actionSchema).max(MAX_ACTIONS_PER_EVENT)])
    .optional()
    .describe(`The actions to run ${when}: one, or a list run in order.`);

/**
 * What an app adds to every primitive, whatever its type: an id where something refers to it, when
 * it is shown, the query that fills it, the value it sets and the handlers of its events. A
 * primitive's own property of the same name takes its place.
 */
export const getNodeEnvelope = () => ({
  id: nodeIdSchema
    .optional()
    .describe('Needed only where something refers to the component, as an action opens a flyout.'),
  visibleWhen: visibleWhenSchema,
  query: z
    .string()
    .min(1)
    .max(MAX_QUERY_LENGTH)
    .optional()
    .describe('An ES|QL query whose result fills the component.'),
  bind: stateKeySchema.optional().describe('The value of the app the component sets.'),
  onClick: handlers('when it is pressed'),
  onRowClick: handlers('when a row is clicked, with that row'),
  onSubmit: handlers('once the answers are in their values'),
  onChange: handlers('after it sets its value'),
});
