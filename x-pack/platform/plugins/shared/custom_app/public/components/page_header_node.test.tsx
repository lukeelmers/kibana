/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { screen, within } from '@testing-library/react';
import { appDocumentSchema } from '@kbn/custom-app-common';
import type { RunQuery } from '../data/data_layer';
import { setServices } from '../services';
import { renderApp } from './test_utils';

const runQuery: RunQuery = async () => ({
  columns: [{ name: 'headline', type: 'keyword' }],
  rows: [["You're all caught up"]],
});

describe('a page header', () => {
  beforeAll(() => {
    setServices(
      {
        application: {
          getUrlForApp: (app: string, { path }: { path?: string } = {}) =>
            `/app/${app}${path ?? ''}`,
          navigateToApp: jest.fn(),
          capabilities: { navLinks: { nightshift: true } },
        },
      } as never,
      jest.fn() as never,
      {} as never,
      {} as never,
      {} as never,
      undefined
    );
  });

  it('shows its icon, its line above the title, the title and its links as quiet buttons', async () => {
    await renderApp(
      appDocumentSchema.parse({
        queries: { hero: { query: 'FROM x' } },
        root: {
          type: 'page_header',
          id: 'header',
          icon: 'data:image/svg+xml;base64,PHN2Zy8+',
          eyebrow: '{{now | greeting}}!',
          title: '{{query.hero.headline}}',
          children: [
            {
              type: 'link',
              id: 'all_events',
              label: 'Show all events',
              to: { type: 'app', app: 'nightshift', path: '/detections/events' },
            },
          ],
        },
      }),
      runQuery
    );

    const header = screen.getByTestId('customAppPageHeader');
    expect(within(header).getByTestId('customAppIconMark')).toBeInTheDocument();
    expect(within(header).getByText(/^Good (morning|afternoon|evening)!$/)).toBeInTheDocument();
    expect(await within(header).findByRole('heading')).toHaveTextContent("You're all caught up");
    const link = within(header).getByTestId('customAppLink');
    expect(link.tagName).toBe('A');
    expect(link).toHaveTextContent('Show all events');
  });
});
