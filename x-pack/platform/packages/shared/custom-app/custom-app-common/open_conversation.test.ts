/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { appDocumentSchema } from './document_schema';

const messagesOf = (document: unknown) => {
  const result = appDocumentSchema.safeParse(document);
  return result.success ? [] : result.error.issues.map(({ message }) => message);
};

const open = (conversationId: unknown) => [{ type: 'openConversation', conversationId }];

describe('opening a conversation', () => {
  it('takes a fixed id, a value of the app or a column of a declared query from a button', () => {
    expect(
      messagesOf({
        state: { picked: { type: 'string', default: '' } },
        queries: { latest: { query: 'FROM x | LIMIT 1' } },
        root: {
          type: 'stack',
          id: 'root',
          children: [
            { type: 'button', id: 'a', label: 'A', onClick: open('conversation-1') },
            { type: 'button', id: 'b', label: 'B', onClick: open({ $state: 'picked' }) },
            {
              type: 'button',
              id: 'c',
              label: 'C',
              onClick: open({ $query: 'latest', field: 'id' }),
            },
          ],
        },
      })
    ).toEqual([]);
  });

  it('takes a column of the row from a row click, and from the template of a list', () => {
    expect(
      messagesOf({
        root: {
          type: 'list',
          id: 'rows',
          query: 'FROM x',
          onRowClick: open({ $row: 'id' }),
          rowActions: [
            { label: 'Chat', icon: 'productAgent', onClick: open({ fromColumn: 'id' }) },
          ],
          template: { type: 'button', id: 'chat', label: 'Chat', onClick: open({ $row: 'id' }) },
        },
      })
    ).toEqual([]);
  });

  it('refuses what cannot be had where it is', () => {
    expect(
      messagesOf({
        root: {
          type: 'stack',
          id: 'root',
          children: [
            { type: 'button', id: 'a', label: 'A', onClick: open({ $row: 'id' }) },
            { type: 'button', id: 'b', label: 'B', onClick: open({ $state: 'nope' }) },
            { type: 'button', id: 'c', label: 'C', onClick: open({ $query: 'nope', field: 'id' }) },
          ],
        },
      })
    ).toEqual([
      'Node "a" opens the conversation of a column, which only a row click, a click on a chart or the template of a list has',
      'Node "b" opens the conversation of unknown state key "nope"',
      'Node "c" opens the conversation of unknown query "nope"',
    ]);
  });

  it('is not done as an input changes, which would open one for every key', () => {
    expect(
      messagesOf({
        state: { q: { type: 'string', default: '' } },
        root: { type: 'search', id: 's', label: 'Search', bind: 'q', onChange: open('c-1') },
      })
    ).toEqual([
      'Node "s" opens a conversation on onChange; it can only be opened by a button, a row click, a click on a chart or a form that is submitted',
    ]);
  });
});
