/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { getDocumentIssues } from '@kbn/custom-app-common';

const stack = (children: unknown[]) => ({ type: 'section', title: 'App', id: 'root', children });

describe('getDocumentIssues', () => {
  it('finds nothing wrong with a valid document', () => {
    expect(getDocumentIssues({ root: stack([{ type: 'markdown', id: 'a', text: 'hi' }]) })).toEqual(
      []
    );
  });

  it('tags a reference problem with the node it is about', () => {
    expect(
      getDocumentIssues({
        root: stack([
          { type: 'select', id: 'find', label: 'Find', bind: 'missing', options: [{ value: 'a' }] },
        ]),
      })
    ).toEqual([{ message: 'Node "find" binds unknown state key "missing"', nodeId: 'find' }]);
  });

  it('tags a duplicate id, and a bad binding, with the node', () => {
    const issues = getDocumentIssues({
      state: { n: { type: 'number', default: 1 } },
      root: stack([
        { type: 'markdown', id: 'a', text: 'x' },
        { type: 'markdown', id: 'a', text: 'y' },
        { type: 'select', id: 'find', label: 'Find', bind: 'n', options: [{ value: 'a' }] },
      ]),
    });

    expect(issues.map(({ nodeId }) => nodeId)).toEqual(['a', 'find']);
  });

  it('finds the node and field of a structural problem from the path', () => {
    const issues = getDocumentIssues({
      root: stack([{ type: 'stat', id: 'users', title: 't', query: '' }]),
    });

    expect(issues).toHaveLength(1);
    expect(issues[0].nodeId).toBe('users');
    expect(issues[0].message).toMatch(/^Node "users", query: /);
  });

  it('reports a problem with no node, such as one in the state', () => {
    const issues = getDocumentIssues({
      state: { '1bad': { type: 'string', default: '' } },
      root: { type: 'markdown', id: 'a', text: 'x' },
    });

    expect(issues).toHaveLength(1);
    expect(issues[0].nodeId).toBeUndefined();
  });

  it('reports a document that is not an object at all', () => {
    expect(getDocumentIssues(null).length).toBeGreaterThan(0);
  });
});
