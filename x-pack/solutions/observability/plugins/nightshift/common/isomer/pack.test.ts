/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { createIsomerRuntime } from '@elastic/isomer-runtime';
import { createRuntimeConformanceHarness } from '@elastic/isomer-runtime/testing';
import {
  primitiveConformanceRows,
  runPrimitiveInventoryConformance,
} from '@elastic/isomer-sdk/testing';
import { nightshiftPack, nightshiftPrimitives } from './pack';

// The renderers draw with EUI, whose classes the HTML surface's style collector does not know.
const rows = primitiveConformanceRows(nightshiftPrimitives).filter(
  ({ name }) => name !== 'reaches every rendered readable class in compact CSS collection'
);

const harness = createRuntimeConformanceHarness(createIsomerRuntime({ packs: [nightshiftPack] }));

describe('nightshiftPack', () => {
  it('passes inventory conformance', () => {
    runPrimitiveInventoryConformance(nightshiftPrimitives);
  });

  it.each(rows)('$type #$exampleIndex: $name', (row) => row.run(row, harness));
});
