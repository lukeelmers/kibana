/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import {
  getBoundSignature,
  isNodeVisible,
  passesRule,
  resolveBoundProps,
  type VisibleWhen,
} from './bindings';
import { appDocumentSchema, type AppNode } from './document_schema';
import {
  findFilterReferences,
  findQueryReferences,
  findRowReferences,
  hasMalformedReference,
  interpolate,
} from './interpolation';
import { collectDeclaredSources } from './node_tree';

const doc = (
  children: unknown[],
  {
    state = {},
    queries,
  }: { state?: Record<string, unknown>; queries?: Record<string, unknown> } = {}
) => ({
  state,
  ...(queries ? { queries } : {}),
  root: { type: 'stack', id: 'root', children },
});
const messagesOf = (document: unknown) => {
  const result = appDocumentSchema.safeParse(document);
  return result.success ? [] : result.error.issues.map(({ message }) => message);
};
const nodeOf = (document: unknown, index = 0) =>
  (appDocumentSchema.parse(document).root as { children: AppNode[] }).children[index];

const COUNTS = { counts: { query: 'FROM x | STATS critical = COUNT(*)' } };

describe('declared queries', () => {
  it('are optional, and a document without them is as it was', () => {
    const parsed = appDocumentSchema.parse(doc([]));
    expect(parsed).not.toHaveProperty('queries');
  });

  it('are sources of their own, named so that no component can have the same id', () => {
    expect(collectDeclaredSources(appDocumentSchema.parse(doc([], { queries: COUNTS })))).toEqual({
      'query:counts': { type: 'esql', query: 'FROM x | STATS critical = COUNT(*)' },
    });
  });

  it('refuse an id that is not written as a node id is', () => {
    expect(messagesOf(doc([], { queries: { 'a.b': { query: 'ROW a = 1' } } }))).not.toEqual([]);
  });
});

describe('a reference to a declared query', () => {
  it('can be what a property reads', () => {
    const badge = nodeOf(
      doc([{ type: 'badge', id: 'b', text: 'x', color: { $query: 'counts', field: 'color' } }], {
        queries: COUNTS,
      })
    );

    expect(
      resolveBoundProps(badge, {}, { queries: { counts: { color: 'danger' } } })
    ).toMatchObject({ color: 'danger' });
    // Until the query has a row, it is what the property is when nothing is written.
    expect(resolveBoundProps(badge, {}, {})).toMatchObject({ color: 'default' });
    expect(getBoundSignature(badge, {}, { queries: { counts: { color: 'danger' } } })).toContain(
      'danger'
    );
  });

  it('is refused when the query is not declared', () => {
    expect(
      messagesOf(
        doc([{ type: 'badge', id: 'b', text: 'x', color: { $query: 'nope', field: 'color' } }])
      )
    ).toEqual(['Node "b" reads "color" from unknown query "nope"']);
  });

  it('is filled into text, and refused there too when the query is not declared', () => {
    expect(
      interpolate(
        '{{query.counts.critical}} critical',
        {},
        { queries: { counts: { critical: 3 } } }
      )
    ).toBe('3 critical');
    expect(findQueryReferences('{{query.counts.critical}}')).toEqual([
      { id: 'counts', field: 'critical' },
    ]);
    expect(messagesOf(doc([{ type: 'text', id: 't', text: '{{query.nope.n}}' }]))).toEqual([
      'Node "t" refers to unknown query "nope"',
    ]);
    expect(
      messagesOf(doc([{ type: 'text', id: 't', text: '{{query.counts.n}}' }], { queries: COUNTS }))
    ).toEqual([]);
  });
});

describe('a reference to a row', () => {
  it('reads the column of the row it is drawn for', () => {
    expect(interpolate('{{row.title}}', {}, { row: { title: 'Disk full' } })).toBe('Disk full');
    expect(interpolate('{{ row.a.b }}', {}, { row: { 'a.b': 1 } })).toBe('1');
    expect(findRowReferences('{{row.title}} {{state.q}}')).toEqual(['title']);
  });

  it('is refused outside the template of a list, in a property and in text', () => {
    expect(
      messagesOf(doc([{ type: 'badge', id: 'b', text: 'x', color: { $row: 'color' } }]))
    ).toEqual([
      'Node "b" reads "color" from the column "color" of a row, which only the template of a list has',
    ]);
    expect(messagesOf(doc([{ type: 'text', id: 't', text: '{{row.title}}' }]))).toEqual([
      'Node "t" refers to a column of a row in "text", which only the template of a list has',
    ]);
  });
});

describe('references in text', () => {
  it.each(['{{now}}', '{{now | greeting}}', '{{ row.x | greeting }}', '{{query.q.n}}'])(
    'accepts %s',
    (text) => expect(hasMalformedReference(text)).toBe(false)
  );

  it.each(['{{query.q}}', '{{row}}', '{{now |}}', '{{ later }}'])('flags %s', (text) =>
    expect(hasMalformedReference(text)).toBe(true)
  );

  it('applies a filter it is given, and leaves the value as it is without one', () => {
    const now = new Date('2026-11-04T09:00:00Z');
    expect(
      interpolate('{{now | greeting}}', {}, { now, filters: { greeting: () => 'Good morning' } })
    ).toBe('Good morning');
    expect(interpolate('{{now}}', {}, { now })).toBe('2026-11-04T09:00:00.000Z');
    expect(findFilterReferences('{{now | greeting}} {{state.a}}')).toEqual(['greeting']);
  });

  it('refuses a filter that is not one of the known ones', () => {
    expect(messagesOf(doc([{ type: 'text', id: 't', text: '{{now | shout}}' }]))).toEqual([
      'Node "t" uses the unknown filter "shout" in "text"; it is one of greeting',
    ]);
  });
});

describe('visibleWhen', () => {
  it.each([
    [{ equals: 'a' }, 'a', true],
    [{ notEquals: 'a' }, 'b', true],
    [{ notEquals: 'a' }, 'a', false],
    [{ gt: 0 }, 1, true],
    [{ gt: 0 }, 0, false],
    [{ gt: 0 }, '2', true],
    [{ gte: 2 }, 2, true],
    [{ lt: 2 }, 1, true],
    [{ lte: 2 }, 3, false],
    [{ gt: 0 }, null, false],
    [{ isEmpty: true }, '', true],
    [{ isEmpty: true }, null, true],
    [{ isEmpty: true }, [], true],
    [{ isNotEmpty: true }, 'x', true],
    [{ isNotEmpty: true }, undefined, false],
    [{}, true, true],
    [{}, 'true', false],
  ])('%j passes %j: %s', (operators, value, expected) => {
    expect(passesRule({ $state: 'k', ...operators } as VisibleWhen, value)).toBe(expected);
  });

  it('reads a declared query and a row, as well as a value of the app', () => {
    expect(
      isNodeVisible(
        { visibleWhen: { $query: 'counts', field: 'critical', gt: 0 } },
        {},
        { queries: { counts: { critical: 3 } } }
      )
    ).toBe(true);
    expect(isNodeVisible({ visibleWhen: { $query: 'counts', field: 'critical', gt: 0 } }, {})).toBe(
      false
    );
    expect(
      isNodeVisible({ visibleWhen: { $row: 'in_progress' } }, {}, { row: { in_progress: true } })
    ).toBe(true);
  });

  it('keeps how a value of the app was compared', () => {
    expect(
      messagesOf(
        doc([{ type: 'text', id: 't', text: 'x', visibleWhen: { $state: 'n', gt: 1 } }], {
          state: { n: { type: 'number', default: 0 } },
        })
      )
    ).toEqual([]);
    expect(
      messagesOf(
        doc([{ type: 'text', id: 't', text: 'x', visibleWhen: { $state: 's', gt: 1 } }], {
          state: { s: { type: 'string', default: '' } },
        })
      )
    ).toEqual([
      'Node "t" is shown when state key "s" (string) is compared with gt, which needs a number key',
    ]);
    expect(
      messagesOf(
        doc([{ type: 'text', id: 't', text: 'x', visibleWhen: { $state: 's', isEmpty: true } }], {
          state: { s: { type: 'string', default: '' } },
        })
      )
    ).toEqual([]);
    expect(
      messagesOf(
        doc([{ type: 'text', id: 't', text: 'x', visibleWhen: { $state: 's', notEquals: 1 } }], {
          state: { s: { type: 'string', default: '' } },
        })
      )
    ).toEqual([
      'Node "t" is shown when state key "s" (string) does not equal 1, which is a number',
    ]);
  });

  it('compares in one way only', () => {
    expect(
      messagesOf(
        doc([{ type: 'text', id: 't', text: 'x', visibleWhen: { $state: 'n', gt: 1, lt: 3 } }], {
          state: { n: { type: 'number', default: 0 } },
        })
      )
    ).toEqual(['Node "t" is shown by a rule with gt and lt; a rule compares in one way only']);
  });

  it('refuses a query that is not declared, and a row outside a list', () => {
    expect(
      messagesOf(
        doc([{ type: 'text', id: 't', text: 'x', visibleWhen: { $query: 'q', field: 'n', gt: 0 } }])
      )
    ).toEqual(['Node "t" reads "visibleWhen" from unknown query "q"']);
    expect(
      messagesOf(doc([{ type: 'text', id: 't', text: 'x', visibleWhen: { $row: 'done' } }]))
    ).toEqual([
      'Node "t" reads "visibleWhen" from the column "done" of a row, which only the template of a list has',
    ]);
  });
});
