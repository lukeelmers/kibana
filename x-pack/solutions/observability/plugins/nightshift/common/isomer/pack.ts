/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { definePrimitivePack } from '@elastic/isomer-sdk';
import { investigationList } from './investigation_list';
import { investigationRow } from './investigation_row';
import { investigationSearch } from './investigation_search';
import { pageHeader } from './page_header';
import { severityTile } from './severity_tile';

export const nightshiftPrimitives = [
  pageHeader,
  severityTile,
  investigationRow,
  investigationList,
  investigationSearch,
] as const;

/** Nightshift's investigation primitives. */
export const nightshiftPack = definePrimitivePack({
  id: 'nightshift',
  primitives: nightshiftPrimitives,
});
