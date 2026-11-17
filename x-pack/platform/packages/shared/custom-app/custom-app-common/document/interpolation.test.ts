/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { findReferences, hasMalformedReference, interpolate } from './interpolation';

describe('findReferences', () => {
  it('finds every referenced key, tolerating inner whitespace', () => {
    expect(findReferences('{{state.a}} and {{ row.service.name }} and {{state.a}}')).toEqual([
      { scope: 'state', key: 'a' },
      { scope: 'row', key: 'service.name' },
      { scope: 'state', key: 'a' },
    ]);
  });

  it('finds nothing in plain text', () => {
    expect(findReferences('no references here')).toEqual([]);
  });
});

describe('hasMalformedReference', () => {
  it.each(['{{state}}', '{{state.a.b}}', '{{ other.a }}', '{{state.a', 'x {{ state.1a }}'])(
    'flags %s',
    (text) => {
      expect(hasMalformedReference(text)).toBe(true);
    }
  );

  it.each(['plain', '{{state.a}}', '{{ state.a }} and {{state.b}}', 'a } b { c'])(
    'accepts %s',
    (text) => {
      expect(hasMalformedReference(text)).toBe(false);
    }
  );
});

describe('interpolate', () => {
  it('inserts values as text', () => {
    expect(
      interpolate('Service {{state.service}}: {{state.count}} ({{state.on}})', {
        state: {
          service: 'checkout',
          count: 3,
          on: true,
        },
      })
    ).toBe('Service checkout: 3 (true)');
  });

  it('inserts nothing for a key without a value', () => {
    expect(interpolate('[{{state.missing}}]', { state: {} })).toBe('[]');
  });

  it('does not re-interpret markup or references inside a value', () => {
    expect(
      interpolate('{{state.a}}', {
        state: { a: '<img src=x onerror=alert(1)> {{state.b}}', b: 'LEAK' },
      })
    ).toBe('<img src=x onerror=alert(1)> {{state.b}}');
  });

  it('keeps replacement tokens in a value literal', () => {
    expect(interpolate('[{{state.a}}]', { state: { a: "$& $1 $$ $'" } })).toBe("[$& $1 $$ $']");
  });

  it('leaves text without references untouched', () => {
    expect(interpolate('plain $& text', { state: { a: 'x' } })).toBe('plain $& text');
  });
});

describe('interpolating a list', () => {
  it('shows its values one after the other, separated by commas', () => {
    expect(interpolate('Users: {{state.users}}', { state: { users: ['alice', 'bob'] } })).toBe(
      'Users: alice, bob'
    );
  });

  it('shows an empty list as nothing', () => {
    expect(interpolate('Users: [{{state.users}}]', { state: { users: [] } })).toBe('Users: []');
  });
});
