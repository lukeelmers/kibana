/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

export type StateValue = string | number | boolean | readonly string[];

export type ReferenceScope = 'state' | 'row';

export interface Reference {
  scope: ReferenceScope;
  key: string;
}

/**
 * What text may refer to: `{{state.<key>}}`, a value of the app, or `{{row.<column>}}`, whose
 * name may have dots, as `service.name` does.
 */
const REFERENCE_PATTERN =
  /\{\{\s*(?:state\.([A-Za-z_][A-Za-z0-9_]*)|row\.([A-Za-z_@](?:[A-Za-z0-9_.@]*[A-Za-z0-9_@])?))\s*\}\}/g;

const toReference = (stateKey: string | undefined, column: string | undefined): Reference =>
  stateKey === undefined ? { scope: 'row', key: column ?? '' } : { scope: 'state', key: stateKey };

/** The references a text holds. */
export const findReferences = (text: string): Reference[] =>
  Array.from(text.matchAll(REFERENCE_PATTERN), ([, stateKey, column]) =>
    toReference(stateKey, column)
  );

/** True when the text holds a `{{` that is not a valid reference. */
export const hasMalformedReference = (text: string): boolean =>
  text.replace(REFERENCE_PATTERN, '').includes('{{');

export interface InterpolationScopes {
  state: Readonly<Record<string, StateValue>>;
  /** The row a row click or the flyout it opened has. Without one, `{{row.key}}` is left as it is. */
  row?: Readonly<Record<string, unknown>>;
}

const toText = (value: unknown): string =>
  // A list is shown as its values, one after the other.
  Array.isArray(value) ? value.join(', ') : String(value ?? '');

/**
 * Replaces each reference with its value as plain text, a list as its values separated by commas.
 * A key with no value is replaced with nothing.
 */
export const interpolate = (text: string, { state, row }: InterpolationScopes): string =>
  text.replace(REFERENCE_PATTERN, (match, stateKey?: string, column?: string) => {
    const { scope, key } = toReference(stateKey, column);
    if (scope === 'state') return toText(state[key]);
    return row ? toText(row[key]) : match;
  });

const ONE_REFERENCE = new RegExp(`^${REFERENCE_PATTERN.source}$`);

/**
 * The value a text stands for: the value itself, of its own type, when the text is one reference
 * and nothing else, and the text with its references replaced otherwise.
 */
export const resolveText = (text: string, scopes: InterpolationScopes): unknown => {
  const one = text.match(ONE_REFERENCE);
  if (!one) return interpolate(text, scopes);
  const { scope, key } = toReference(one[1], one[2]);
  return scope === 'state' ? scopes.state[key] : scopes.row?.[key];
};
