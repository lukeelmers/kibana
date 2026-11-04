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

const answering =
  (values: Record<string, unknown>): RunQuery =>
  async (query) => {
    const [, name] = query.match(/ROW (\w+)/) ?? [];
    return { columns: [{ name, type: 'long' }], rows: [[values[name]]] };
  };

describe('a stat with an icon', () => {
  const document = appDocumentSchema.parse({
    state: { picked: { type: 'string', default: '' } },
    root: {
      type: 'stack',
      id: 'page',
      children: [
        {
          type: 'stat',
          id: 'critical',
          title: 'Critical',
          query: 'ROW critical',
          icon: 'bolt',
          color: 'danger',
          onClick: [{ type: 'setState', key: 'picked', value: 'critical' }],
        },
        {
          type: 'stat',
          id: 'low',
          title: 'Low',
          query: 'ROW low',
          icon: 'data:image/svg+xml;base64,PHN2Zy8+',
        },
        { type: 'text', id: 'picked', text: 'Picked {{state.picked}}' },
      ],
    },
  });

  it('shows the value beside its icon, and runs its actions when clicked', async () => {
    await renderApp(document, answering({ critical: 3, low: 0 }));

    const [critical, low] = await screen.findAllByTestId('customAppStat');
    expect(critical).toHaveTextContent('3');
    expect(low).toHaveTextContent('0');
    expect(screen.getAllByTestId('customAppStatIcon')).toHaveLength(2);
    expect(screen.getByTestId('customAppIconMark')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Critical'));
    expect(await screen.findByText('Picked critical')).toBeInTheDocument();
  });
});

describe('an accordion of cards', () => {
  const document = appDocumentSchema.parse({
    queries: { counts: { query: 'ROW critical' } },
    root: {
      type: 'accordion',
      id: 'sections',
      variant: 'cards',
      children: [
        {
          type: 'section',
          id: 'critical',
          label: 'Critical',
          open: true,
          titleNode: {
            type: 'badge',
            id: 'critical_count',
            text: '{{query.counts.critical}}',
            color: 'danger',
          },
          children: [
            {
              type: 'list',
              id: 'rows',
              query: 'ROW critical',
              template: { type: 'text', id: 'row', text: 'Row {{row.critical}}' },
            },
          ],
        },
        {
          type: 'section',
          id: 'empty',
          label: 'Hidden',
          visibleWhen: { $query: 'counts', field: 'critical', equals: 0 },
          children: [{ type: 'text', id: 'never', text: 'never' }],
        },
      ],
    },
  });

  it('draws each section as a card, with its count beside the title and a flush list', async () => {
    await renderApp(document, answering({ critical: 3 }));

    const [card] = await screen.findAllByTestId('customAppAccordionCard');
    expect(within(card).getByText('Critical')).toBeInTheDocument();
    expect(await within(card).findByText('3')).toBeInTheDocument();
    expect(await within(card).findByText('Row 3')).toBeInTheDocument();
    // A section that is not to be shown is not drawn, title and all.
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
  });

  it('closes a section when its header is clicked', async () => {
    await renderApp(document, answering({ critical: 3 }));

    await screen.findByText('Row 3');
    await userEvent.click(screen.getByText('Critical'));
    expect(screen.getByText('Row 3')).not.toBeVisible();
  });
});

describe('a loading badge', () => {
  it('is shown as a status that is under way', async () => {
    await renderApp(
      appDocumentSchema.parse({
        root: { type: 'badge', id: 'b', text: 'In progress', loading: true },
      }),
      answering({})
    );
    expect(screen.getByTestId('customAppLoadingBadge')).toHaveTextContent('In progress');
  });
});
