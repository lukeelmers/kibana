/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { appDocumentSchema } from '@kbn/custom-app-common';
import {
  collectQueries,
  getNodeActions,
  getNodeBindings,
  getNodeQuery,
  isEmptyDocument,
} from '@kbn/custom-app-common';

const app = (body: unknown[], state: Record<string, unknown> = {}) =>
  appDocumentSchema.parse({ title: 'App', state, body });

const { body } = app([
  { type: 'stat', id: 'users-stat', title: 'Users', query: 'FROM users | STATS COUNT(*)' },
  { type: 'header', id: 'title', text: 'Hi' },
  { type: 'table', id: 'orders-table', query: 'FROM orders' },
  {
    type: 'flyout',
    id: 'detail',
    title: 'Detail',
    children: [{ type: 'fields', id: 'facts', query: 'FROM orders | WHERE id == ?id' }],
  },
]);

describe('collectQueries', () => {
  it('finds the query of every data component, wherever it is, by the id of its component', () => {
    expect(collectQueries(body)).toEqual({
      'users-stat': 'FROM users | STATS COUNT(*)',
      'orders-table': 'FROM orders',
      facts: 'FROM orders | WHERE id == ?id',
    });
  });

  it('finds nothing in a document with no data components', () => {
    expect(collectQueries(app([{ type: 'markdown', id: 'a', text: 'hi' }]).body)).toEqual({});
  });

  it('keeps two components with the same query apart', () => {
    const twins = app([
      { type: 'stat', id: 'a', title: 'A', query: 'ROW 1' },
      { type: 'table', id: 'b', query: 'ROW 1' },
    ]);

    expect(collectQueries(twins.body)).toEqual({ a: 'ROW 1', b: 'ROW 1' });
  });
});

describe('getNodeQuery', () => {
  it('returns the query of a data component and nothing for the others', () => {
    const [stat, heading, table] = body;

    expect(getNodeQuery(stat)).toBe('FROM users | STATS COUNT(*)');
    expect(getNodeQuery(table)).toBe('FROM orders');
    expect(getNodeQuery(heading)).toBeUndefined();
  });
});

describe('isEmptyDocument', () => {
  it('is true for an app with nothing in it, which is how a new app starts', () => {
    expect(isEmptyDocument(app([]))).toBe(true);
  });

  it('is false once there is a component, whatever it is', () => {
    expect(isEmptyDocument(app([{ type: 'markdown', id: 't', text: 'x' }]))).toBe(false);
  });

  it('is false for a flyout with nothing in it, which is a component and not a blank app', () => {
    expect(isEmptyDocument(app([{ type: 'flyout', id: 'f', title: 'x', children: [] }]))).toBe(
      false
    );
  });
});

describe('getNodeActions of a button', () => {
  it('is what happens when it is pressed', () => {
    const action = { workflow: 'isolate' };
    const [button] = app([{ type: 'button', id: 'go', label: 'Go', onClick: [action] }]).body;

    expect(getNodeActions(button)).toEqual([{ event: 'onClick', actions: [action] }]);
  });
});

describe('forms in the tree', () => {
  const [form] = app(
    [
      {
        type: 'form',
        id: 'ask',
        submitLabel: 'Send',
        fields: [
          { name: 'a', kind: 'text', label: 'A' },
          { name: 'b', kind: 'text', label: 'B' },
        ],
        onSubmit: [{ state: { a: 'x' } }],
      },
    ],
    { a: '', b: '' }
  ).body;

  it('binds a value for each of its fields', () => {
    expect(getNodeBindings(form)).toEqual(['a', 'b']);
  });

  it('binds the value of an input, and nothing for what has none', () => {
    expect(
      getNodeBindings({ type: 'select', id: 's', label: 'S', bind: 'q', options: [{ value: 'a' }] })
    ).toEqual(['q']);
    expect(getNodeBindings({ type: 'header', id: 'h', text: 'H' })).toEqual([]);
  });

  it('runs its actions when it is submitted', () => {
    expect(getNodeActions(form)).toEqual([{ event: 'onSubmit', actions: [{ state: { a: 'x' } }] }]);
  });
});
