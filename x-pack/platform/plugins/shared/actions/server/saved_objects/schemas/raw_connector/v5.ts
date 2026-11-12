/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { schema } from '@kbn/config-schema';
import { rawConnectorSchema as rawConnectorSchemaV4 } from './v4';

export const rawConnectorSchema = rawConnectorSchemaV4.extends({
  // Spec version the connector instance was created from. Absent on classic connectors and on
  // spec connectors created before pinning existed.
  specVersion: schema.maybe(schema.string({ maxLength: 16 })),
});
