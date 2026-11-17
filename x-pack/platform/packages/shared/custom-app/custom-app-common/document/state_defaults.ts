/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { StateValue } from './interpolation';

export type StateType = 'string' | 'number' | 'boolean' | 'list';

/** The type of a value of the app, which is that of its default. */
export const getStateType = (value: StateValue): StateType =>
  Array.isArray(value) ? 'list' : (typeof value as StateType);

/** The value every state key starts with when a panel loads. */
export const getStateDefaults = (
  state: Readonly<Record<string, StateValue>>
): Record<string, StateValue> => ({ ...state });
