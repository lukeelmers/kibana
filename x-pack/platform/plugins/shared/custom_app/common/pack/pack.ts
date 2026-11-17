/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { definePrimitivePack } from '@elastic/isomer-sdk';
import { row } from './row';
import { stat } from './stat';

export const appPrimitives = [stat, row] as const;

/** The primitives custom apps add to Kibana's. */
export const appPack = definePrimitivePack({
  id: 'custom_app',
  primitives: appPrimitives,
});
