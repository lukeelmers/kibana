/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { definePrimitivePack } from '@elastic/isomer-sdk';
import { withKibanaUi } from '@kbn/custom-app-registry';
import { esqlEditor } from '../../../common/custom_app/esql_editor/manifest';
import { renderEsqlEditor } from './view';

/** The ES|QL pack for the browser, with the `kibana-ui` renderer that makes the editor live. */
export const browserEsqlPack = definePrimitivePack({
  id: 'esql',
  primitives: [withKibanaUi(esqlEditor, renderEsqlEditor)],
});
