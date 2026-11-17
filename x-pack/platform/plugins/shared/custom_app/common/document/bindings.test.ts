/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { isNodeVisible } from '@kbn/custom-app-common';
import { appDocumentSchema } from '@kbn/custom-app-common';

const doc = (body: unknown[], state: Record<string, unknown> = {}) => ({
  title: 'App',
  state,
  body,
});
const messagesOf = (document: unknown) => {
  const result = appDocumentSchema.safeParse(document);
  return result.success ? [] : result.error.issues.map(({ message }) => message);
};

describe('showing a component by a value', () => {
  const withRule = (rule: unknown, state: Record<string, unknown>) =>
    doc([{ type: 'header', id: 'h', text: 'x', visibleWhen: rule }], state);

  it('is allowed on every component, and a component with no rule is always shown', () => {
    expect(isNodeVisible({}, {})).toBe(true);
    expect(
      messagesOf(
        doc(
          [
            { type: 'table', id: 't', query: 'ROW a = 1', visibleWhen: { $state: 'on' } },
            { type: 'section', title: 'App', id: 's', visibleWhen: { $state: 'on' }, children: [] },
          ],
          { on: true }
        )
      )
    ).toEqual([]);
  });

  it('is shown while a true or false is true, or while a value is the one wanted', () => {
    expect(isNodeVisible({ visibleWhen: { $state: 'on' } }, { on: true })).toBe(true);
    expect(isNodeVisible({ visibleWhen: { $state: 'on' } }, { on: false })).toBe(false);
    expect(isNodeVisible({ visibleWhen: { $state: 'view', equals: 'a' } }, { view: 'a' })).toBe(
      true
    );
    expect(isNodeVisible({ visibleWhen: { $state: 'view', equals: 'a' } }, { view: 'b' })).toBe(
      false
    );
  });

  it.each([
    ['a key that does not exist', {}, 'Node "h" is shown by unknown state key "on"'],
    ['a text without a value to equal', { on: 'x' }, 'without "equals" it needs a boolean key'],
    ['a list', { on: [] }, 'is shown by state key "on", which is a list'],
  ])('is refused for %s', (_what, state, message) => {
    expect(messagesOf(withRule({ $state: 'on' }, state))[0]).toContain(message);
  });

  it('is refused when the value to equal is of another kind than the key', () => {
    expect(messagesOf(withRule({ $state: 'view', equals: 3 }, { view: 'a' }))[0]).toContain(
      'which is a number'
    );
  });
});
