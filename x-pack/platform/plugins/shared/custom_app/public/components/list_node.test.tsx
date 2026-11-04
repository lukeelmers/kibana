/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { appDocumentSchema } from '@kbn/custom-app-common';
import type { RunQuery } from '../data/data_layer';
import { renderApp } from './test_utils';

const rows = (count: number): RunQuery =>
  jest.fn(async () => ({
    columns: [
      { name: 'id', type: 'keyword' },
      { name: 'title', type: 'keyword' },
      { name: 'done', type: 'boolean' },
    ],
    rows: Array.from({ length: count }, (_, index) => [
      `id-${index}`,
      `Title ${index}`,
      index === 0,
    ]),
  }));

const document = (overrides: Record<string, unknown> = {}) =>
  appDocumentSchema.parse({
    state: { picked: { type: 'string', default: '' } },
    root: {
      type: 'stack',
      id: 'page',
      children: [
        {
          type: 'list',
          id: 'rows',
          query: 'FROM x',
          onRowClick: [{ type: 'setState', key: 'picked', value: { fromColumn: 'id' } }],
          template: {
            type: 'stack',
            id: 'row',
            spacing: 'tight',
            children: [
              { type: 'heading', id: 'row_title', text: '{{row.title}}' },
              { type: 'badge', id: 'row_done', text: 'Done', visibleWhen: { $row: 'done' } },
            ],
          },
          ...overrides,
        },
        { type: 'text', id: 'picked_text', text: 'Picked {{state.picked}}' },
      ],
    },
  });

describe('ListNode', () => {
  it('draws the template once for each row, with the row in scope', async () => {
    await renderApp(document(), rows(3));

    const drawn = await screen.findAllByTestId('customAppListRow');
    expect(drawn).toHaveLength(3);
    expect(within(drawn[1]).getByText('Title 1')).toBeInTheDocument();
    // A rule on a column of the row is decided for each row.
    expect(within(drawn[0]).getByText('Done')).toBeInTheDocument();
    expect(within(drawn[1]).queryByText('Done')).not.toBeInTheDocument();
  });

  it('runs the row click with the row, as a table does', async () => {
    await renderApp(document(), rows(3));

    const [, second] = await screen.findAllByTestId('customAppListRowButton');
    await userEvent.click(second);
    expect(await screen.findByText('Picked id-1')).toBeInTheDocument();
  });

  it('shows a page of rows and more on asking', async () => {
    await renderApp(document({ pageSize: 2 }), rows(5));

    expect(await screen.findAllByTestId('customAppListRow')).toHaveLength(2);
    await userEvent.click(screen.getByTestId('customAppListShowMore'));
    expect(screen.getAllByTestId('customAppListRow')).toHaveLength(4);
    await userEvent.click(screen.getByTestId('customAppListShowMore'));
    expect(screen.getAllByTestId('customAppListRow')).toHaveLength(5);
    expect(screen.queryByTestId('customAppListShowMore')).not.toBeInTheDocument();
  });

  it('says so when there are no rows, in its own words when it has them', async () => {
    await renderApp(document({ emptyMessage: 'Nothing to look at' }), rows(0));

    expect(await screen.findByTestId('customAppListEmpty')).toHaveTextContent('Nothing to look at');
  });

  it('shows the first row action as an icon, and the rest in a menu, each run with its row', async () => {
    await renderApp(
      document({
        onRowClick: [],
        rowActions: [
          {
            label: 'Pick',
            icon: 'check',
            onClick: [{ type: 'setState', key: 'picked', value: { fromColumn: 'id' } }],
          },
          {
            label: 'Pick the title',
            icon: 'pencil',
            onClick: [{ type: 'setState', key: 'picked', value: { fromColumn: 'title' } }],
          },
        ],
      }),
      rows(2)
    );

    const [first] = await screen.findAllByTestId('customAppListRowAction');
    await userEvent.click(first);
    expect(await screen.findByText('Picked id-0')).toBeInTheDocument();

    const [, secondMenu] = screen.getAllByTestId('customAppListRowMenu');
    await userEvent.click(secondMenu);
    await userEvent.click(await screen.findByText('Pick the title'));
    expect(await screen.findByText('Picked Title 1')).toBeInTheDocument();
    // Without a row click, a row is not a control of its own.
    expect(screen.queryByTestId('customAppListRowButton')).not.toBeInTheDocument();
  });
});
