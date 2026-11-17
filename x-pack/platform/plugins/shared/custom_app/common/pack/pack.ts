/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { definePrimitivePack } from '@elastic/isomer-sdk';
import { button } from './button';
import { flyout } from './flyout';
import { form } from './form';
import { input } from './input';
import { row } from './row';
import { select } from './select';
import { stat } from './stat';

/** The primitives custom apps add to Kibana's. */
export const appPack = definePrimitivePack({
  id: 'custom_app',
  primitives: [stat, row, form, input, select, button, flyout],
});
