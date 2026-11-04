/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { appDocumentSchema, valueFormatSchema } from './document_schema';

const doc = (node: unknown) => ({ root: { type: 'stack', id: 'root', children: [node] } });
const isValid = (node: unknown) => appDocumentSchema.safeParse(doc(node)).success;

describe('value formats', () => {
  it('fill in what is left out', () => {
    expect(valueFormatSchema.parse({ type: 'truncate' })).toEqual({ type: 'truncate', lines: 1 });
    expect(valueFormatSchema.parse({ type: 'chips' })).toEqual({
      type: 'chips',
      separator: ',',
      color: 'hollow',
    });
  });

  it('are a short list', () => {
    expect(valueFormatSchema.safeParse({ type: 'sparkline' }).success).toBe(false);
    expect(valueFormatSchema.safeParse({ type: 'truncate', lines: 11 }).success).toBe(false);
    expect(valueFormatSchema.safeParse({ type: 'chips', dot: 'purple' }).success).toBe(false);
  });

  it('can be given to a text, with a variant, to a column of a table and to a field', () => {
    expect(
      isValid({
        type: 'text',
        id: 't',
        text: '{{state.x}}',
        variant: 'caption',
        format: { type: 'relative_time' },
      })
    ).toBe(false); // unknown state key, reported as before
    expect(isValid({ type: 'text', id: 't', text: 'x', variant: 'emphasis' })).toBe(true);
    expect(isValid({ type: 'text', id: 't', text: 'x', variant: 'shout' })).toBe(false);
    expect(
      isValid({
        type: 'table',
        id: 't',
        query: 'ROW a = 1',
        columns: [{ field: 'a', format: { type: 'badge', colorMap: { '1': 'risk' } } }],
      })
    ).toBe(true);
    expect(
      isValid({
        type: 'key_value',
        id: 'k',
        query: 'ROW a = 1',
        fields: ['a', { field: 'b', label: 'B', format: { type: 'truncate', lines: 2 } }],
      })
    ).toBe(true);
  });
});
