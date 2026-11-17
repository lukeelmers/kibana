/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { z, lazySchema } from '@kbn/zod/v4';
import { defineAction, type ActionOf } from '@kbn/custom-app-registry';
import {
  getStateType,
  listValueSchema,
  stateKeySchema,
  stateValueSchema,
} from '@kbn/custom-app-common';

export const setStateAction = defineAction({
  kind: 'action',
  id: 'state',
  version: 1,
  props: lazySchema(() =>
    z.object({
      state: z
        .record(
          stateKeySchema,
          z.union([stateValueSchema, listValueSchema, z.object({ fromInput: z.literal(true) })])
        )
        .describe(
          'The values of the app to set, each to a value, which a text can take from the clicked row as {{row.<column>}} or from another value as {{state.<key>}}.'
        ),
    })
  ),
  doc: {
    summary: 'Sets values of the app, which the components that read them follow.',
    whenToUse:
      'To remember a choice, such as a column of a clicked row, which queries then read as ?name.',
    example: { state: { service: '{{row.service}}' } },
  },
  validate: (action, { nodeId, event, state, checkText, issue }) => {
    Object.entries(action.state).forEach(([key, value]) => {
      if (!(key in state)) {
        issue(`Node "${nodeId}" sets unknown state key "${key}"`);
        return;
      }
      const type = getStateType(state[key]);

      if (Array.isArray(value)) {
        if (type !== 'list') issue(`Node "${nodeId}" sets state key "${key}" (${type}) to a list`);
      } else if (typeof value === 'object') {
        if (event !== 'onChange') {
          issue(`Node "${nodeId}": fromInput is only valid on input nodes`);
        }
      } else if (typeof value === 'string' && value.includes('{{')) {
        checkText(value).forEach((problem) =>
          issue(`Node "${nodeId}": the value of "${key}" ${problem}`)
        );
      } else if (typeof value !== type) {
        issue(`Node "${nodeId}" sets state key "${key}" (${type}) to a ${typeof value}`);
      }
    });
  },
});

declare module '@kbn/custom-app-registry' {
  interface ActionTypeMap {
    state: ActionOf<typeof setStateAction>;
  }
}
