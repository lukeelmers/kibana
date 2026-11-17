/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { registerDataAdapter } from '@kbn/custom-app-registry';
import type { Severity } from '@kbn/nightshift-investigations-plugin/common';
import { SEVERITY_DOT_COLOR } from '../severity';

const MAX_ROWS = 100;

const isSeverity = (value: unknown): value is Severity =>
  typeof value === 'string' && value in SEVERITY_DOT_COLOR;

const toCount = (value: unknown): number => Math.max(0, Math.round(Number(value) || 0));

/** Entities come as a list, or as one comma-joined string. */
const toEntities = (value: unknown): string[] | undefined => {
  const entities = Array.isArray(value)
    ? value.map(String)
    : typeof value === 'string'
    ? value.split(',').map((entity) => entity.trim())
    : [];
  return entities.length > 0 ? entities.filter(Boolean) : undefined;
};

/**
 * Lets a custom app fill the Nightshift primitives from an ES|QL query. An `investigation_list`
 * reads its columns by name, and keeps the other columns of each row for the actions of a click.
 * A `severity_tile` counts the first column of the first row, and a `page_header` the
 * investigations in progress the same way.
 */
export const registerNightshiftDataAdapters = (): void => {
  registerDataAdapter('investigation_list', {
    fills: ['rows'],
    from: ({ columns, rows }) => ({
      rows: rows.slice(0, MAX_ROWS).map((row) => {
        const record = Object.fromEntries(columns.map(({ name }, index) => [name, row[index]]));
        return {
          ...record,
          title: String(record.title ?? '').slice(0, 200),
          summary: typeof record.summary === 'string' ? record.summary.slice(0, 500) : undefined,
          created_at: String(record.created_at ?? ''),
          in_progress: record.in_progress === true || record.in_progress === 'true',
          severity: isSeverity(record.severity) ? record.severity : undefined,
          entities: toEntities(record.entities),
        };
      }),
    }),
  });
  registerDataAdapter('severity_tile', {
    fills: ['count'],
    from: ({ rows: [row = []] }) => ({ count: toCount(row[0]) }),
  });
  registerDataAdapter('page_header', {
    fills: ['in_progress_count'],
    from: ({ rows: [row = []] }) => ({ in_progress_count: toCount(row[0]) }),
  });
};
