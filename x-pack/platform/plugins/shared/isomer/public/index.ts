/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { IsomerPlugin } from './plugin';

export const plugin = () => new IsomerPlugin();

export type { IsomerPluginSetup, IsomerPluginStart } from './plugin';
export type { KibanaIsomerRuntime } from '@kbn/isomer';
