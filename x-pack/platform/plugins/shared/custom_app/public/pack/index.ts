/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { definePrimitivePack } from '@elastic/isomer-sdk';
import { withKibanaUi } from '@kbn/custom-app-registry';
import { row, stat } from '../../common/pack';
import { renderRow } from './kibana_ui/row';

/** The app pack for the browser, with the `kibana-ui` renderers that make it live. */
export const browserAppPack = definePrimitivePack({
  id: 'custom_app',
  primitives: [stat, withKibanaUi(row, renderRow)],
});
