/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { screen } from '@testing-library/react';
import { appDocumentSchema } from '@kbn/custom-app-common';
import type { RunQuery } from '../data/data_layer';
import { renderApp } from '../components/test_utils';

const document = appDocumentSchema.parse({
  queries: { hero: { query: 'FROM x | STATS active = COUNT(*)' } },
  root: {
    type: 'stack',
    id: 'page',
    children: [
      { type: 'heading', id: 'count', text: '{{query.hero.active}} running' },
      {
        type: 'text',
        id: 'busy',
        text: 'Investigations are underway',
        visibleWhen: { $query: 'hero', field: 'active', gt: 0 },
      },
      {
        type: 'text',
        id: 'idle',
        text: 'All caught up',
        visibleWhen: { $query: 'hero', field: 'active', lte: 0 },
      },
    ],
  },
});

const answering =
  (active: number): RunQuery =>
  async () => ({ columns: [{ name: 'active', type: 'long' }], rows: [[active]] });

describe('declared queries', () => {
  it('are run for the app, and fill the text and the rules that read them', async () => {
    const runQuery = jest.fn(answering(2));
    await renderApp(document, runQuery);

    expect(runQuery).toHaveBeenCalledWith(
      'FROM x | STATS active = COUNT(*)',
      expect.anything(),
      expect.anything()
    );
    expect(await screen.findByText('2 running')).toBeInTheDocument();
    expect(screen.getByText('Investigations are underway')).toBeInTheDocument();
    expect(screen.queryByText('All caught up')).not.toBeInTheDocument();
  });

  it('show the other side of a rule when the row says so', async () => {
    await renderApp(document, answering(0));

    expect(await screen.findByText('All caught up')).toBeInTheDocument();
    expect(screen.queryByText('Investigations are underway')).not.toBeInTheDocument();
  });
});
