/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { __IntlProvider as IntlProvider } from '@kbn/i18n-react';
import { appDocumentSchema, valueFormatSchema, type ValueFormat } from '@kbn/custom-app-common';
import type { RunQuery } from '../data/data_layer';
import { greeting } from '../runtime/text_filters';
import { FormattedValue } from './formatted_value';
import { renderApp } from './test_utils';

const format = (value: unknown): ValueFormat => valueFormatSchema.parse(value);
const show = (value: unknown, written: unknown) =>
  render(
    <IntlProvider locale="en">
      <FormattedValue value={value} format={format(written)} />
    </IntlProvider>
  );

describe('FormattedValue', () => {
  it('says how long ago a time was', () => {
    show(new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), { type: 'relative_time' });
    expect(screen.getByTestId('customAppRelativeTime')).toHaveTextContent('2 hours ago');
  });

  it('shows a value that is not a time as it is', () => {
    show('soon', { type: 'relative_time' });
    expect(screen.getByText('soon')).toBeInTheDocument();
  });

  it('cuts a value to its lines, keeping the whole as its title', () => {
    show('A long summary', { type: 'truncate' });
    expect(screen.getByTestId('customAppTruncated')).toHaveAttribute('title', 'A long summary');
  });

  it('shows a badge in the colour its value maps to, or the one it has otherwise', () => {
    show('critical', { type: 'badge', colorMap: { critical: 'danger' } });
    expect(screen.getByTestId('customAppValueBadge')).toHaveTextContent('critical');
    expect(format({ type: 'badge' })).toEqual({ type: 'badge', colorMap: {}, color: 'default' });
    expect(() => format({ type: 'badge', colorMap: { x: 'purple' } })).toThrow();
  });

  it('splits a text into chips, and counts what is past the most', () => {
    show('web, api, db, cache', { type: 'chips', max: 3, dot: 'danger' });
    expect(screen.getAllByTestId('customAppChip').map((chip) => chip.textContent)).toEqual([
      'web',
      'api',
      'db',
    ]);
    expect(screen.getByTestId('customAppChipOverflow')).toHaveTextContent('+1');
  });

  it('shows no chips for an empty text', () => {
    show('', { type: 'chips' });
    expect(screen.queryByTestId('customAppChip')).not.toBeInTheDocument();
  });
});

describe('the greeting filter', () => {
  it.each([
    [9, 'Good morning'],
    [14, 'Good afternoon'],
    [21, 'Good evening'],
  ])('at %s is %s', (hour, expected) => {
    const date = new Date(2026, 10, 4, hour);
    expect(greeting(date)).toBe(expected);
  });
});

describe('a text with a variant or a format', () => {
  const runQuery: RunQuery = async () => ({ columns: [], rows: [] });

  it('is shown as the value it is, with a greeting for the time of day', async () => {
    const document = appDocumentSchema.parse({
      root: {
        type: 'stack',
        id: 'page',
        children: [
          { type: 'text', id: 'hello', text: '{{now | greeting}}!', variant: 'caption' },
          {
            type: 'text',
            id: 'chips',
            text: 'a, b',
            format: { type: 'chips' },
          },
          { type: 'text', id: 'md', text: '**bold**' },
        ],
      },
    });
    await renderApp(document, runQuery);

    expect(screen.getByText(/^Good (morning|afternoon|evening)!$/)).toBeInTheDocument();
    expect(screen.getAllByTestId('customAppChip')).toHaveLength(2);
    // Without either, it is Markdown as before.
    expect(screen.getByText('bold').tagName).toBe('STRONG');
  });

  it('formats the columns of a table and the fields of a key-value list', async () => {
    const document = appDocumentSchema.parse({
      root: {
        type: 'stack',
        id: 'page',
        children: [
          {
            type: 'table',
            id: 'table',
            query: 'FROM x',
            columns: [{ field: 'severity', format: { type: 'badge', colorMap: { high: 'risk' } } }],
          },
          {
            type: 'key_value',
            id: 'kv',
            query: 'FROM x',
            fields: [
              { field: 'entities', label: 'Impacted', format: { type: 'chips' } },
              'severity',
            ],
          },
        ],
      },
    });
    await renderApp(document, async () => ({
      columns: [
        { name: 'severity', type: 'keyword' },
        { name: 'entities', type: 'keyword' },
      ],
      rows: [['high', 'web, api']],
    }));

    expect(await screen.findByTestId('customAppValueBadge')).toHaveTextContent('high');
    expect(screen.getByText('Impacted')).toBeInTheDocument();
    expect(screen.getAllByTestId('customAppChip')).toHaveLength(2);
  });
});
