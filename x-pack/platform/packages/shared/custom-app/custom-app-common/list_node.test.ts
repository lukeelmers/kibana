/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { appDocumentSchema, getNodeTemplate, type AppNode } from './document_schema';
import { pruneUnusedValues, createNodeId } from './document_mutations';
import { collectSources, getNodeActions, getNodeSubtrees } from './node_tree';

const list = (overrides: Record<string, unknown> = {}) => ({
  type: 'list',
  id: 'rows',
  query: 'FROM x | KEEP id, title',
  template: { type: 'text', id: 'row_title', text: '{{row.title}}' },
  ...overrides,
});
const doc = (node: unknown, state: Record<string, unknown> = {}) => ({
  state,
  root: { type: 'stack', id: 'root', children: [node] },
});
const messagesOf = (document: unknown) => {
  const result = appDocumentSchema.safeParse(document);
  return result.success ? [] : result.error.issues.map(({ message }) => message);
};
const parsedList = (overrides: Record<string, unknown> = {}) =>
  (appDocumentSchema.parse(doc(list(overrides))).root as { children: AppNode[] }).children[0];

describe('a list', () => {
  it('draws a template for each row, which reads the row, and has nothing else to set', () => {
    const node = parsedList();
    expect(messagesOf(doc(list()))).toEqual([]);
    expect(node).toMatchObject({ onRowClick: [], rowActions: [] });
    expect(getNodeTemplate(node)).toMatchObject({ id: 'row_title' });
  });

  it('runs its query as a source, and not those of its template', () => {
    expect(collectSources(appDocumentSchema.parse(doc(list())).root)).toEqual({
      rows: { type: 'esql', query: 'FROM x | KEEP id, title' },
    });
  });

  it('needs a query or a source, as any component that shows data', () => {
    expect(messagesOf(doc(list({ query: undefined })))).toEqual([
      'Node "rows" shows data and needs a query or a source, and one of them only',
    ]);
  });

  it('holds its template among the subtrees, so ids stay unique across it', () => {
    const node = parsedList();
    expect(getNodeSubtrees(node).map(({ id }) => id)).toEqual(['row_title']);
    expect(
      messagesOf(
        doc({
          type: 'stack',
          id: 'wrap',
          children: [list(), { type: 'text', id: 'row_title', text: 'again' }],
        })
      )
    ).toEqual(['Duplicate node id "row_title"']);
  });

  it('refuses a template that fetches, sets or opens anything of its own', () => {
    expect(
      messagesOf(
        doc(
          list({
            template: {
              type: 'stack',
              id: 'row',
              children: [
                { type: 'stat', id: 'inner_stat', title: 'n', query: 'ROW a = 1' },
                { type: 'search', id: 'inner_search', label: 'q', bind: 'q' },
              ],
            },
          }),
          { q: { type: 'string', default: '' } }
        )
      )
    ).toEqual([
      'Node "inner_stat" is in the template of a list and shows data of its own; a template only shows its row',
      'Node "inner_search" is in the template of a list and is an input; a template only shows its row',
    ]);
  });

  it('takes a page size, an empty message and row actions', () => {
    expect(
      messagesOf(
        doc(
          list({
            pageSize: 5,
            emptyMessage: 'Nothing found',
            rowActions: [{ label: 'Open', icon: 'productAgent', onClick: [] }],
          })
        )
      )
    ).toEqual([]);
    expect(messagesOf(doc(list({ pageSize: 0 })))).not.toEqual([]);
    expect(
      messagesOf(doc(list({ rowActions: [{ label: 'Open', icon: 'not an icon', onClick: [] }] })))
    ).not.toEqual([]);
  });

  it('hands the clicked row to what a row click and a row action do', () => {
    const document = doc(
      list({
        onRowClick: [{ type: 'setState', key: 'picked', value: { fromColumn: 'id' } }],
        rowActions: [
          {
            label: 'Escalate',
            icon: 'casesApp',
            onClick: [
              {
                type: 'runWorkflow',
                workflow: 'escalate',
                inputs: { id: { fromColumn: 'id' } },
              },
            ],
          },
        ],
      }),
      { picked: { type: 'string', default: '' } }
    );
    expect(messagesOf(document)).toEqual([]);
    expect(
      getNodeActions(
        (appDocumentSchema.parse(document).root as { children: AppNode[] }).children[0]
      ).map(({ event }) => event)
    ).toEqual(['onRowClick', 'onRowClick']);
  });

  it('lets a button in its template hand on a column of its row', () => {
    expect(
      messagesOf(
        doc(
          list({
            template: {
              type: 'button',
              id: 'pick',
              label: 'Pick',
              onClick: [{ type: 'setState', key: 'picked', value: { fromColumn: 'id' } }],
            },
          }),
          { picked: { type: 'string', default: '' } }
        )
      )
    ).toEqual([]);
  });

  it('keeps a value used only in its template, and new ids clear of it', () => {
    const document = appDocumentSchema.parse(
      doc(
        list({
          template: {
            type: 'button',
            id: 'button-1',
            label: 'Pick',
            onClick: [{ type: 'setState', key: 'picked', value: { fromColumn: 'id' } }],
          },
        }),
        { picked: { type: 'string', default: '' } }
      )
    );
    expect(pruneUnusedValues(document).state).toHaveProperty('picked');
    expect(createNodeId(document, 'button')).toBe('button-2');
  });
});
