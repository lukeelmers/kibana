/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { KibanaUiRenderer } from '@kbn/custom-app-registry';
import type { AppNode } from '@kbn/custom-app-common';
import { renderSection } from './section';
import { renderTable } from './table';

/** `kibana-ui` renderers for primitives of Kibana's components pack, by type. */
export const KIBANA_UI_RENDERERS: Readonly<Record<string, KibanaUiRenderer<AppNode>>> = {
  section: renderSection,
  table: renderTable as unknown as KibanaUiRenderer<AppNode>,
};
