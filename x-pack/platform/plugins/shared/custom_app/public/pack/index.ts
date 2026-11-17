/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { definePrimitivePack } from '@elastic/isomer-sdk';
import { withKibanaUi } from '@kbn/custom-app-registry';
import { button, flyout, form, input, row, select, stat } from '../../common/pack';
import { renderButton } from './kibana_ui/button';
import { renderFlyout } from './kibana_ui/flyout';
import { renderForm } from './kibana_ui/form';
import { renderInput } from './kibana_ui/input';
import { renderRow } from './kibana_ui/row';
import { renderSelect } from './kibana_ui/select';

/** The app pack for the browser, with the `kibana-ui` renderers that make it live. */
export const browserAppPack = definePrimitivePack({
  id: 'custom_app',
  primitives: [
    stat,
    withKibanaUi(row, renderRow),
    withKibanaUi(form, renderForm),
    withKibanaUi(input, renderInput),
    withKibanaUi(select, renderSelect),
    withKibanaUi(button, renderButton),
    withKibanaUi(flyout, renderFlyout),
  ],
});
