/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { appDocumentSchema, type AppNode } from './document_schema';
import { collectSources, getNodeActions, getNodeSubtrees } from './node_tree';

const doc = (node: unknown, extra: Record<string, unknown> = {}) => ({
  ...extra,
  root: { type: 'stack', id: 'root', children: [node] },
});
const messagesOf = (document: unknown) => {
  const result = appDocumentSchema.safeParse(document);
  return result.success ? [] : result.error.issues.map(({ message }) => message);
};
const first = (document: unknown) =>
  (appDocumentSchema.parse(document).root as { children: AppNode[] }).children[0];

const MARK = 'data:image/svg+xml;base64,PHN2Zy8+';

describe('a stat', () => {
  it('takes an icon, by name or as an SVG of its own, a colour and a click', () => {
    const stat = {
      type: 'stat',
      id: 's',
      title: 'Critical',
      query: 'ROW n = 3',
      icon: 'bolt',
      color: 'danger',
      onClick: [{ type: 'setState', key: 'picked', value: 'critical' }],
    };
    const state = { state: { picked: { type: 'string', default: '' } } };
    expect(messagesOf(doc(stat, state))).toEqual([]);
    expect(messagesOf(doc({ ...stat, icon: MARK }, state))).toEqual([]);
    expect(getNodeActions(first(doc(stat, state)))).toEqual([
      { event: 'onClick', actions: stat.onClick },
    ]);
  });

  it('is as it was without them', () => {
    const plain = first(doc({ type: 'stat', id: 's', title: 'n', query: 'ROW n = 1' }));
    expect(plain).not.toHaveProperty('onClick');
    expect(getNodeActions(plain)).toEqual([]);
  });

  it.each([
    ['an icon that is neither a name nor an SVG', { icon: 'https://example.com/icon.svg' }],
    ['an image that is not an SVG', { icon: 'data:image/png;base64,AAAA' }],
    ['a colour of its own', { color: '#ff0000' }],
  ])('refuses %s', (_what, props) => {
    expect(
      messagesOf(doc({ type: 'stat', id: 's', title: 'n', query: 'ROW n = 1', ...props }))
    ).not.toEqual([]);
  });
});

describe('a section with a node beside its title', () => {
  const accordion = (titleNode: unknown) => ({
    type: 'accordion',
    id: 'sections',
    variant: 'cards',
    children: [
      {
        type: 'section',
        id: 'critical',
        label: 'Critical',
        titleNode,
        children: [{ type: 'text', id: 'body', text: 'x' }],
      },
    ],
  });

  it('holds it as a slot, checked as the rest of the document is', () => {
    const queries = { queries: { counts: { query: 'ROW critical = 3' } } };
    expect(
      messagesOf(
        doc(
          accordion({
            type: 'badge',
            id: 'count',
            text: '{{query.counts.critical}}',
            color: 'danger',
          }),
          queries
        )
      )
    ).toEqual([]);
    expect(messagesOf(doc(accordion({ type: 'badge', id: 'body', text: 'x' }), queries))).toEqual([
      'Duplicate node id "body"',
    ]);
    const section = (
      first(doc(accordion({ type: 'badge', id: 'count', text: 'x' }))) as {
        children: AppNode[];
      }
    ).children[0];
    expect(getNodeSubtrees(section).map(({ id }) => id)).toEqual(['body', 'count']);
  });

  it('runs the query of what is beside the title, as it is shown', () => {
    const root = appDocumentSchema.parse(
      doc(accordion({ type: 'stat', id: 'count', title: 'n', query: 'ROW n = 1' }))
    ).root;
    expect(collectSources(root)).toEqual({ count: { type: 'esql', query: 'ROW n = 1' } });
  });

  it('refuses an accordion variant it does not know', () => {
    expect(messagesOf(doc({ ...accordion(undefined), variant: 'tiles' }))).not.toEqual([]);
  });
});

describe('a badge', () => {
  it('can be shown as something that is still under way', () => {
    expect(messagesOf(doc({ type: 'badge', id: 'b', text: 'In progress', loading: true }))).toEqual(
      []
    );
  });

  it('takes the colours of severity', () => {
    expect(messagesOf(doc({ type: 'badge', id: 'b', text: 'High', color: 'risk' }))).toEqual([]);
    expect(messagesOf(doc({ type: 'badge', id: 'b', text: 'Low', color: 'neutral' }))).toEqual([]);
  });
});
