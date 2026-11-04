/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { appDocumentSchema } from '@kbn/custom-app-common';
import type { RunQuery } from '../data/data_layer';
import { createAppRuntime } from '../runtime/app_runtime';
import { setServices } from '../services';
import { renderApp } from '../components/test_utils';

const setAgentBuilder = (agentBuilder: unknown) =>
  setServices(
    {} as never,
    jest.fn() as never,
    {} as never,
    {} as never,
    {} as never,
    agentBuilder as never
  );

const runQuery: RunQuery = async () => ({
  columns: [
    { name: 'id', type: 'keyword' },
    { name: 'title', type: 'keyword' },
  ],
  rows: [
    ['conversation-1', 'First'],
    ['conversation-2', 'Second'],
  ],
});

const document = appDocumentSchema.parse({
  root: {
    type: 'list',
    id: 'rows',
    query: 'FROM x',
    onRowClick: [{ type: 'openConversation', conversationId: { $row: 'id' } }],
    template: { type: 'text', id: 'row', text: '{{row.title}}' },
  },
});

describe('the openConversation action', () => {
  it('resolves the id it is given, from a value, a row or a declared query', () => {
    const runtime = createAppRuntime(
      appDocumentSchema.parse({
        state: { picked: { type: 'string', default: 'from-state' } },
        root: { type: 'text', id: 't', text: '' },
      })
    );

    expect(
      runtime.run([
        { type: 'openConversation', conversationId: 'fixed' },
        { type: 'openConversation', conversationId: { $state: 'picked' } },
      ]).conversations
    ).toEqual(['fixed', 'from-state']);
    expect(
      runtime.run([{ type: 'openConversation', conversationId: { fromColumn: 'id' } }], {
        row: { id: 'from-row' },
      }).conversations
    ).toEqual(['from-row']);
    expect(
      runtime.run([{ type: 'openConversation', conversationId: { $query: 'q', field: 'id' } }], {
        queries: { q: { id: 'from-query' } },
      }).conversations
    ).toEqual(['from-query']);
    expect(runtime.run([{ type: 'openConversation', conversationId: { $row: 'id' } }], {})).toEqual(
      { dropped: ['There is no conversation to open'], workflows: [], conversations: [] }
    );
  });

  it("opens the clicked row's conversation in Agent Builder, closing the one before", async () => {
    const close = jest.fn();
    const openConversationDetails = jest.fn().mockResolvedValue(close);
    setAgentBuilder({ openConversationDetails });
    await renderApp(document, runQuery);

    const [first, second] = await screen.findAllByTestId('customAppListRowButton');
    await userEvent.click(first);
    expect(openConversationDetails).toHaveBeenLastCalledWith(
      expect.objectContaining({ conversationId: 'conversation-1' })
    );
    await userEvent.click(second);
    expect(close).toHaveBeenCalledTimes(1);
    expect(openConversationDetails).toHaveBeenLastCalledWith(
      expect.objectContaining({ conversationId: 'conversation-2' })
    );
  });

  it('does nothing but say so when Agent Builder is not there', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    setAgentBuilder(undefined);
    await renderApp(document, runQuery);

    const [first] = await screen.findAllByTestId('customAppListRowButton');
    await userEvent.click(first);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('conversation-1'));
    warn.mockRestore();
  });
});
