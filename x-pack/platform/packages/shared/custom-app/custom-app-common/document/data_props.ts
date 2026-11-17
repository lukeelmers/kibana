/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { CapabilityQueryResult } from '@kbn/custom-app-registry';

/** How a primitive that shows data takes it: the props its query fills, and from what. */
export interface DataProps {
  fills: readonly string[];
  from: (result: CapabilityQueryResult, node: Record<string, unknown>) => Record<string, unknown>;
}

/** The rows a table shows; a note says how many more there were. */
const TABLE_MAX_ROWS = 100;
/** What a table node can hold at all: its columns, its rows, and its rows times its columns. */
const TABLE_COLUMN_LIMIT = 20;
const TABLE_ROW_LIMIT = 1000;
const TABLE_CELL_LIMIT = 10000;
const MAX_FIELDS = 10;

const toText = (value: unknown, max: number): string =>
  (Array.isArray(value)
    ? value.join(', ')
    : typeof value === 'object'
    ? JSON.stringify(value)
    : String(value)
  ).slice(0, max);

const toCell = (value: unknown, max = 500): string | number | null =>
  value === null || value === undefined
    ? null
    : typeof value === 'number' && Number.isFinite(value)
    ? value
    : toText(value, max);

export const DATA_PROPS: Readonly<Record<string, DataProps>> = {
  table: {
    // `columns` is filled too, and a column the node gives, by its label, says how to format it.
    fills: ['rows'],
    from: ({ columns: allColumns, rows }, node) => {
      const columns = allColumns.slice(0, TABLE_COLUMN_LIMIT);
      const given = (node.columns ?? []) as ReadonlyArray<{ label: string }>;
      const kept = Math.min(
        TABLE_ROW_LIMIT,
        Math.floor(TABLE_CELL_LIMIT / Math.max(columns.length, 1))
      );
      return {
        columns: columns.map(({ name }) => {
          const label = name.slice(0, 100);
          return { ...given.find((column) => column.label === label), label };
        }),
        rows: rows
          .slice(0, kept)
          .map((row) => row.slice(0, columns.length).map((cell) => toCell(cell))),
        maxRows: TABLE_MAX_ROWS,
        ...(rows.length > kept ? { totalRows: rows.length } : {}),
      };
    },
  },
  fields: {
    fills: ['items'],
    from: ({ columns, rows: [row = []] }) => ({
      items: columns.slice(0, MAX_FIELDS).map(({ name }, index) => {
        const value = row[index];
        return {
          label: name.slice(0, 100),
          value:
            typeof value === 'number' && Number.isFinite(value)
              ? { raw: value }
              : value === null || value === undefined || value === ''
              ? '—'
              : toText(value, 1000),
        };
      }),
    }),
  },
  stat: {
    fills: ['value'],
    from: ({ rows: [row = []] }) => ({ value: toCell(row[0], 100) }),
  },
};

/** The node with the props its query fills, from what the query returned. */
export const fillDataProps = <TNode extends { type: string }>(
  node: TNode,
  result: CapabilityQueryResult
): TNode => {
  const props = DATA_PROPS[node.type];
  return props ? { ...node, ...props.from(result, node as Record<string, unknown>) } : node;
};
