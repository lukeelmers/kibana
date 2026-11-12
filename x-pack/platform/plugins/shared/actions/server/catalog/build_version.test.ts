/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { buildVersion } from './build_version';

const fixture = readFileSync(join(__dirname, '__fixtures__', 'abuseipdb_oob.yaml'), 'utf8');

describe('buildVersion', () => {
  it('validates action input with the converted JSON Schema', () => {
    const { spec } = buildVersion(fixture);
    const { input } = spec.actions!.checkIp;

    expect(input.parse({ ipAddress: '10.0.0.1' })).toEqual({
      ipAddress: '10.0.0.1',
      maxAgeInDays: 90,
    });
    expect(() => input.parse({ ipAddress: 'not-an-ip' })).toThrow();
  });

  it('rejects a definition without metadata', () => {
    const yaml = fixture.replace(/^metadata:\n(?: {2}.*\n)+/m, '');

    expect(() => buildVersion(yaml)).toThrow(/metadata/);
  });
});
