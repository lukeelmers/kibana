/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { appDocumentSchema } from './document_schema';
import { collectDeclaredSources, collectSources } from './node_tree';

const messagesOf = (document: unknown) => {
  const result = appDocumentSchema.safeParse(document);
  return result.success ? [] : result.error.issues.map(({ message }) => message);
};

describe('a page header', () => {
  const header = (children: unknown[]) => ({
    root: { type: 'page_header', id: 'header', title: 'Investigations', eyebrow: 'Hi', children },
  });

  it('holds links and buttons', () => {
    expect(
      messagesOf(
        header([
          { type: 'link', id: 'l', label: 'All', to: { type: 'app', app: 'nightshift' } },
          { type: 'button', id: 'b', label: 'Go' },
        ])
      )
    ).toEqual([]);
  });

  it('holds nothing else', () => {
    expect(messagesOf(header([{ type: 'text', id: 't', text: 'x' }]))).toEqual([
      'Node "header" is a page header and holds only links and buttons, not "t" (text)',
    ]);
  });

  it('refuses a reference to something that does not exist in its title', () => {
    expect(
      messagesOf({ root: { type: 'page_header', id: 'h', title: '{{query.q.n}}', children: [] } })
    ).toEqual(['Node "h" refers to unknown query "q"']);
  });
});

describe('a source that is fetched again on its own', () => {
  it('says how often, for a component and for a declared query', () => {
    const document = appDocumentSchema.parse({
      queries: { hero: { query: 'ROW n = 1', refreshInterval: 30 } },
      root: {
        type: 'list',
        id: 'running',
        query: 'FROM x',
        refreshInterval: 10,
        template: { type: 'text', id: 'row', text: '{{row.title}}' },
      },
    });
    expect(collectSources(document.root)).toEqual({
      running: { type: 'esql', query: 'FROM x', refreshInterval: 10 },
    });
    expect(collectDeclaredSources(document)).toEqual({
      'query:hero': { type: 'esql', query: 'ROW n = 1', refreshInterval: 30 },
    });
  });

  it('is not fetched more often than every few seconds', () => {
    expect(
      messagesOf({
        root: { type: 'stat', id: 's', title: 'n', query: 'ROW n = 1', refreshInterval: 1 },
      })
    ).not.toEqual([]);
  });
});

describe('the width of a page', () => {
  it('is all of it, or that of a page of Kibana', () => {
    const root = { type: 'text', id: 't', text: 'x' };
    expect(messagesOf({ root, theme: { width: 'page' } })).toEqual([]);
    expect(messagesOf({ root, theme: { width: 1000 } })).not.toEqual([]);
  });
});
