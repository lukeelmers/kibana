/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { BindingScope } from './bindings';

export type StateValue = string | number | boolean | readonly string[];

const FIELD = '[A-Za-z_@][A-Za-z0-9_.@-]*';

/**
 * Every reference a text may contain: a value of the app, `{{state.<key>}}`; a column of the row of a
 * list, `{{row.<column>}}`; a column of the first row of a declared query, `{{query.<id>.<column>}}`;
 * and the time it is now, `{{now}}`. Each can end with a filter, as in `{{now | greeting}}`.
 */
const ANY_REFERENCE_PATTERN = new RegExp(
  `\\{\\{\\s*(?:state\\.([A-Za-z_][A-Za-z0-9_]*)|row\\.(${FIELD})|query\\.([A-Za-z0-9_-]+)\\.(${FIELD})|(now))\\s*(?:\\|\\s*([A-Za-z_]+)\\s*)?\\}\\}`,
  'g'
);

interface Reference {
  state?: string;
  row?: string;
  query?: { id: string; field: string };
  now?: true;
  filter?: string;
}

const toReference = (match: RegExpMatchArray): Reference => {
  const [, state, row, queryId, queryField, now, filter] = match;
  return {
    ...(state !== undefined ? { state } : {}),
    ...(row !== undefined ? { row } : {}),
    ...(queryId !== undefined ? { query: { id: queryId, field: queryField } } : {}),
    ...(now !== undefined ? { now: true as const } : {}),
    ...(filter !== undefined ? { filter } : {}),
  };
};

const findReferences = (text: string): Reference[] =>
  Array.from(text.matchAll(ANY_REFERENCE_PATTERN), toReference);

/** Names of the state keys a text refers to. */
export const findStateReferences = (text: string): string[] =>
  findReferences(text).flatMap(({ state }) => (state === undefined ? [] : [state]));

/** The columns of the row of a list a text refers to. */
export const findRowReferences = (text: string): string[] =>
  findReferences(text).flatMap(({ row }) => (row === undefined ? [] : [row]));

/** The declared queries a text refers to, with the column it reads of each. */
export const findQueryReferences = (text: string): Array<{ id: string; field: string }> =>
  findReferences(text).flatMap(({ query }) => (query === undefined ? [] : [query]));

/** The filters a text applies to its references. */
export const findFilterReferences = (text: string): string[] =>
  findReferences(text).flatMap(({ filter }) => (filter === undefined ? [] : [filter]));

/** True when the text holds a `{{` that is not a valid reference. */
export const hasMalformedReference = (text: string): boolean =>
  text.replace(ANY_REFERENCE_PATTERN, '').includes('{{');

/** What a filter does to the value of a reference. */
export type TextFilter = (value: unknown) => string;

export interface InterpolationScope extends BindingScope {
  /** The time `{{now}}` is, which is the time it is when it is left out. */
  now?: Date;
  /** What each filter does. A filter that is not here leaves the value as it is. */
  filters?: Readonly<Record<string, TextFilter>>;
}

const toText = (value: unknown): string =>
  Array.isArray(value)
    ? value.join(', ')
    : value === null || value === undefined
    ? ''
    : typeof value === 'object'
    ? JSON.stringify(value)
    : String(value);

/**
 * Replaces each reference with its current value as plain text, a list as its values separated by
 * commas. A reference with no value is replaced with nothing.
 */
export const interpolate = (
  text: string,
  state: Readonly<Record<string, StateValue>>,
  scope: InterpolationScope = {}
): string =>
  text.replace(ANY_REFERENCE_PATTERN, (...args) => {
    const reference = toReference(args as unknown as RegExpMatchArray);
    const value = reference.now
      ? scope.now ?? new Date()
      : reference.state !== undefined
      ? state[reference.state]
      : reference.row !== undefined
      ? scope.row?.[reference.row]
      : reference.query
      ? scope.queries?.[reference.query.id]?.[reference.query.field]
      : undefined;
    const filter = reference.filter === undefined ? undefined : scope.filters?.[reference.filter];
    if (filter) return filter(value);
    return value instanceof Date ? value.toISOString() : toText(value);
  });
