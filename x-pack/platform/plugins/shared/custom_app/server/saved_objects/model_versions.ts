/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { SavedObjectsModelVersionMap } from '@kbn/core-saved-objects-server';
import { customAppAttributesSchemaV1, customAppAttributesSchemaV2 } from './schemas';

export const customAppModelVersions: SavedObjectsModelVersionMap = {
  '1': {
    changes: [],
    schemas: {
      forwardCompatibility: customAppAttributesSchemaV1.extendsDeep({ unknowns: 'ignore' }),
      create: customAppAttributesSchemaV1,
    },
  },
  // A document can declare queries. Nothing stored changes: an app without any is as it was.
  '2': {
    changes: [],
    schemas: {
      forwardCompatibility: customAppAttributesSchemaV2.extendsDeep({ unknowns: 'ignore' }),
      create: customAppAttributesSchemaV2,
    },
  },
};
