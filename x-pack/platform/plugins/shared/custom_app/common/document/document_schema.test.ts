/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import {
  appDocumentSchema,
  appDocumentShapeSchema,
  customAppStateSchema,
} from '@kbn/custom-app-common';
import { collectQueries, getNodeChildren } from '@kbn/custom-app-common';
import {
  MAX_FORM_FIELDS,
  MAX_NODE_COUNT,
  MAX_NODE_DEPTH,
  MAX_QUERY_LENGTH,
} from '@kbn/custom-app-common';

const stackOf = (id: string, children: unknown[] = []) => ({
  type: 'section',
  title: 'App',
  id,
  children,
});

const nestedStack = (depth: number): unknown =>
  depth === 1 ? stackOf('n1') : stackOf(`n${depth}`, [nestedStack(depth - 1)]);

describe('appDocumentSchema', () => {
  it('parses a nested document and applies defaults', () => {
    const result = appDocumentSchema.parse({
      root: stackOf('root', [
        { type: 'header', id: 'title', text: 'Hello' },
        { type: 'markdown', id: 'note', text: 'Heads up' },
      ]),
    });

    expect(result.state).toEqual({});
    expect(result.root).toEqual({
      type: 'section',
      title: 'App',
      id: 'root',
      children: [
        { type: 'header', id: 'title', text: 'Hello' },
        { type: 'markdown', id: 'note', text: 'Heads up' },
      ],
    });
  });

  it('rejects an unknown node type', () => {
    const result = appDocumentSchema.safeParse({ root: { type: 'sparkles', id: 'a' } });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown node type nested in a stack', () => {
    const result = appDocumentSchema.safeParse({
      root: stackOf('root', [{ type: 'sparkles', id: 'a' }]),
    });
    expect(result.success).toBe(false);
  });

  it('rejects duplicate node ids', () => {
    const result = appDocumentSchema.safeParse({
      root: stackOf('root', [
        { type: 'markdown', id: 'same', text: 'a' },
        { type: 'markdown', id: 'same', text: 'b' },
      ]),
    });
    expect(result.success ? [] : result.error.issues.map(({ message }) => message)).toContain(
      'Duplicate node id "same"'
    );
  });

  it('rejects ids with unsupported characters', () => {
    expect(
      appDocumentSchema.safeParse({ root: { type: 'markdown', id: 'has space', text: 'a' } })
        .success
    ).toBe(false);
  });

  it('accepts nesting at the depth limit and rejects one level beyond it', () => {
    expect(appDocumentSchema.safeParse({ root: nestedStack(MAX_NODE_DEPTH) }).success).toBe(true);
    expect(appDocumentSchema.safeParse({ root: nestedStack(MAX_NODE_DEPTH + 1) }).success).toBe(
      false
    );
  });

  it('rejects a document over the node limit', () => {
    const children = Array.from({ length: MAX_NODE_COUNT }, (_, index) => ({
      type: 'markdown',
      id: `t${index}`,
      text: 'a',
    }));
    // Stacks cap their own children, so spread them over several stacks.
    const chunks = Array.from({ length: Math.ceil(children.length / 40) }, (_, index) =>
      stackOf(`s${index}`, children.slice(index * 40, index * 40 + 40))
    );

    const result = appDocumentSchema.safeParse({ root: stackOf('root', chunks) });
    expect(result.success ? [] : result.error.issues.map(({ message }) => message)).toEqual([
      `A document may hold at most ${MAX_NODE_COUNT} nodes`,
    ]);
  });
});

describe('buttons and the workflows they run', () => {
  const buttonDocument = (actions: unknown[], state: Record<string, unknown> = {}) => ({
    state,
    root: { type: 'button', id: 'go', label: 'Isolate host', onClick: actions },
  });
  const run = (inputs: Record<string, unknown> = {}) => ({
    workflow: 'isolate-host',
    inputs,
  });
  const issuesOf = (document: unknown) =>
    JSON.stringify(appDocumentSchema.safeParse(document).error?.issues ?? []);

  it('is a label and what happens when it is pressed, which is nothing until it is told', () => {
    const result = appDocumentSchema.parse({
      root: { type: 'button', id: 'go', label: 'Go' },
    });

    expect(result.root).toEqual({ type: 'button', id: 'go', label: 'Go', onClick: [] });
  });

  it('needs something written on it', () => {
    expect(
      appDocumentSchema.safeParse({ root: { type: 'button', id: 'go', label: '' } }).success
    ).toBe(false);
    expect(appDocumentSchema.safeParse({ root: { type: 'button', id: 'go' } }).success).toBe(false);
  });

  it('runs a workflow by its id, handing it fixed values and values of the app', () => {
    const result = appDocumentSchema.safeParse(
      buttonDocument(
        [run({ reason: 'Suspicious', severity: 3, force: true, host: { fromState: 'host' } })],
        {
          host: { type: 'string', default: 'web-1' },
        }
      )
    );

    expect(result.success).toBe(true);
  });

  it('hands nothing when it is given nothing', () => {
    const parsed = appDocumentSchema.parse(buttonDocument([{ workflow: 'isolate-host' }]));

    expect(
      (parsed.root as unknown as { onClick: Array<{ inputs: object }> }).onClick[0].inputs
    ).toEqual({});
  });

  it('can be run by a row click, with a column of the row that was clicked', () => {
    const result = appDocumentSchema.safeParse({
      root: {
        type: 'table',
        id: 'hosts',
        query: 'FROM hosts',
        onRowClick: [run({ host: { fromColumn: 'host.name' } })],
      },
    });

    expect(result.success).toBe(true);
  });

  it('is refused with a column when a button runs it, as no row was clicked', () => {
    const text = issuesOf(buttonDocument([run({ host: { fromColumn: 'host.name' } })]));

    expect(text).toContain('takes a column, which only a row click has');
  });

  it('is refused with a value of the app that does not exist, naming it', () => {
    const text = issuesOf(buttonDocument([run({ host: { fromState: 'nope' } })]));

    expect(text).toContain('unknown state key \\"nope\\"');
  });

  it('names where the workflow of an action can be found, within a limit', () => {
    expect(appDocumentSchema.safeParse(buttonDocument([{ workflow: '' }])).success).toBe(false);
    expect(
      appDocumentSchema.safeParse(buttonDocument([{ workflow: 'x'.repeat(257) }])).success
    ).toBe(false);
  });

  it('hands over at most a few inputs, and each is named', () => {
    const tooMany = Object.fromEntries(Array.from({ length: 21 }, (_u, i) => [`input${i}`, 'x']));

    expect(appDocumentSchema.safeParse(buttonDocument([run(tooMany)])).success).toBe(false);
    expect(appDocumentSchema.safeParse(buttonDocument([run({ '': 'x' })])).success).toBe(false);
  });

  it('refuses something that is not a value: an object of another kind is not an input', () => {
    expect(
      appDocumentSchema.safeParse(buttonDocument([run({ host: { fromEverything: true } })])).success
    ).toBe(false);
  });

  it('is not a query, so it has nothing to run when the app loads', () => {
    const parsed = appDocumentSchema.parse(buttonDocument([run()]));

    expect(collectQueries(parsed.root)).toEqual({});
  });
});

describe('forms', () => {
  const reason = { name: 'reason', kind: 'text', label: 'Reason', required: true };
  const formDocument = (
    form: Record<string, unknown> = {},
    state: Record<string, unknown> = { reason: { type: 'string', default: '' } }
  ) => ({
    state,
    root: {
      type: 'form',
      id: 'escalate',
      submitLabel: 'Escalate',
      fields: [reason],
      ...form,
    },
  });
  const issuesOf = (document: unknown) =>
    JSON.stringify(appDocumentSchema.safeParse(document).error?.issues ?? []);

  it('is some fields and a label for submitting them, which does nothing until it is told', () => {
    const result = appDocumentSchema.parse(formDocument());

    expect(result.root).toEqual({
      type: 'form',
      id: 'escalate',
      submitLabel: 'Escalate',
      fields: [reason],
      onSubmit: [],
    });
  });

  it('asks in text, in long text or from a few choices', () => {
    const result = appDocumentSchema.safeParse(
      formDocument(
        {
          fields: [
            { name: 'reason', kind: 'text', label: 'Reason' },
            { name: 'details', kind: 'text', label: 'Details' },
            {
              name: 'urgency',
              kind: 'select',
              label: 'Urgency',
              options: [{ value: 'low' }, { value: 'high', label: 'High' }],
            },
          ],
        },
        {
          reason: { type: 'string', default: '' },
          details: { type: 'string', default: '' },
          urgency: { type: 'string', default: 'low' },
        }
      )
    );

    expect(result.success).toBe(true);
  });

  it('needs a field, a label on the submit button, and a kind it knows', () => {
    expect(appDocumentSchema.safeParse(formDocument({ fields: [] })).success).toBe(false);
    expect(appDocumentSchema.safeParse(formDocument({ submitLabel: '' })).success).toBe(false);
    expect(
      appDocumentSchema.safeParse(formDocument({ fields: [{ ...reason, kind: 'number' }] })).success
    ).toBe(false);
  });

  it('needs options for a choice', () => {
    expect(
      appDocumentSchema.safeParse(
        formDocument({ fields: [{ name: 'reason', kind: 'select', label: 'Reason', options: [] }] })
      ).success
    ).toBe(false);
  });

  it('asks only so much, as a form is not a page', () => {
    const many = Array.from({ length: MAX_FORM_FIELDS + 1 }, (_, index) => ({
      ...reason,
      name: `reason_${index}`,
    }));

    expect(appDocumentSchema.safeParse(formDocument({ fields: many })).success).toBe(false);
  });

  it('puts each answer in a value of the app that exists and is text', () => {
    expect(issuesOf(formDocument({}, {}))).toContain('binds unknown state key \\"reason\\"');
    expect(issuesOf(formDocument({}, { reason: { type: 'number', default: 1 } }))).toContain(
      'an input needs a string key'
    );
  });

  it('does not put two answers in one value', () => {
    expect(issuesOf(formDocument({ fields: [reason, { ...reason, label: 'Again' }] }))).toContain(
      'two fields that set'
    );
  });

  it('does not offer a choice twice', () => {
    expect(
      issuesOf(
        formDocument({
          fields: [
            {
              name: 'reason',
              kind: 'select',
              label: 'Urgency',
              options: [{ value: 'low' }, { value: 'low' }],
            },
          ],
        })
      )
    ).toContain('more than once');
  });

  it('runs a workflow when it is submitted, handing it what was answered', () => {
    const result = appDocumentSchema.safeParse(
      formDocument({
        onSubmit: [
          {
            workflow: 'escalate',
            inputs: { reason: { fromState: 'reason' } },
          },
        ],
      })
    );

    expect(result.success).toBe(true);
  });

  it('cannot hand a workflow a column, as there is no row to take it from', () => {
    expect(
      issuesOf(
        formDocument({
          onSubmit: [{ workflow: 'escalate', inputs: { id: { fromColumn: 'id' } } }],
        })
      )
    ).toContain('takes a column');
  });

  it('can set a value or open a flyout when it is submitted', () => {
    const result = appDocumentSchema.safeParse({
      state: { reason: { type: 'string', default: '' }, sent: { type: 'string', default: '' } },
      root: {
        type: 'section',
        title: 'App',
        id: 'root',
        children: [
          {
            type: 'form',
            id: 'escalate',
            submitLabel: 'Send',
            fields: [reason],
            onSubmit: [{ state: { sent: 'yes' } }, { flyout: 'thanks' }],
          },
          { type: 'flyout', id: 'thanks', title: 'Thanks', children: [] },
        ],
      },
    });

    expect(result.success).toBe(true);
  });

  it('is not given the value of an input, as there is none when it is submitted', () => {
    expect(
      issuesOf(
        formDocument({
          onSubmit: [{ state: { reason: { fromInput: true } } }],
        })
      )
    ).toContain('fromInput is only valid on input nodes');
  });
});

describe('the theme of a page', () => {
  const themed = (theme: unknown) => ({
    theme,
    root: { type: 'markdown', id: 't', text: 'x' },
  });

  it('is optional, and a page without one has none', () => {
    const result = appDocumentSchema.parse({ root: { type: 'markdown', id: 't', text: 'x' } });

    expect(result.theme).toBeUndefined();
  });

  it('is an accent, a shape, both or neither, from the lists', () => {
    expect(appDocumentSchema.parse(themed({ accent: 'purple' })).theme).toEqual({
      accent: 'purple',
    });
    expect(appDocumentSchema.parse(themed({ shape: 'soft' })).theme).toEqual({ shape: 'soft' });
    expect(appDocumentSchema.parse(themed({ accent: 'teal', shape: 'sharp' })).theme).toEqual({
      accent: 'teal',
      shape: 'sharp',
    });
    expect(appDocumentSchema.parse(themed({})).theme).toEqual({});
  });

  it.each([
    ['a colour of its own', { accent: '#ff0000' }],
    ['a colour name that is not offered', { accent: 'magenta' }],
    ['a shape that is not offered', { shape: 'round' }],
    ['a setting that does not exist', { font: 'serif' }],
  ])('is not %s', (_what, theme) => {
    const result = appDocumentSchema.safeParse(themed(theme));

    // An unknown setting is ignored by the schema; the others are refused.
    if ('font' in theme) {
      expect((result.success && result.data.theme) || {}).toEqual({});
    } else {
      expect(result.success).toBe(false);
    }
  });

  it('is kept by the shape of a document that an agent tool takes', () => {
    expect(appDocumentShapeSchema.parse(themed({ accent: 'pink', shape: 'soft' })).theme).toEqual({
      accent: 'pink',
      shape: 'soft',
    });
  });
});

describe('a theme whose accent follows a value of the app', () => {
  const followed = (state: Record<string, unknown>, theme: Record<string, unknown> = {}) => ({
    state,
    theme: { accent: { $state: 'look' }, ...theme },
    root: { type: 'markdown', id: 't', text: 'x' },
  });
  const messagesOf = (document: unknown) => {
    const result = appDocumentSchema.safeParse(document);
    return result.success ? [] : result.error.issues.map(({ message }) => message);
  };

  it('is accepted when the key is a string whose default is an accent', () => {
    expect(
      appDocumentSchema.parse(followed({ look: { type: 'string', default: 'teal' } })).theme
    ).toEqual({ accent: { $state: 'look' } });
  });

  it('is refused when the key does not exist', () => {
    expect(messagesOf(followed({}))).toEqual([
      'The theme reads "accent" from unknown state key "look"',
    ]);
  });

  it('is refused when the key is not a string', () => {
    expect(messagesOf(followed({ look: { type: 'number', default: 1 } }))[0]).toContain(
      'it needs a string key'
    );
  });

  it('is refused when the default is not an accent, so that the page never starts with none', () => {
    expect(messagesOf(followed({ look: { type: 'string', default: 'magenta' } }))[0]).toContain(
      'is not a value "accent" can have'
    );
  });
});

describe('queries and stat nodes', () => {
  const statDocument = (overrides: Record<string, unknown> = {}) => ({
    root: {
      type: 'stat',
      id: 'active',
      title: 'Active users',
      query: 'ROW active = 1284',
      ...overrides,
    },
  });

  it('parses a stat with its own query', () => {
    const result = appDocumentSchema.parse(statDocument());
    expect(result.root).toEqual({
      type: 'stat',
      id: 'active',
      title: 'Active users',
      query: 'ROW active = 1284',
    });
  });

  it('rejects a stat with no query, an empty one, or one over the length limit', () => {
    const withQuery = (query: unknown) =>
      appDocumentSchema.safeParse(statDocument({ query })).success;

    expect(withQuery(undefined)).toBe(false);
    expect(withQuery('')).toBe(false);
    expect(withQuery('x'.repeat(MAX_QUERY_LENGTH))).toBe(true);
    expect(withQuery('x'.repeat(MAX_QUERY_LENGTH + 1))).toBe(false);
  });

  it('gives every data component its own query, in a stack too', () => {
    const result = appDocumentSchema.safeParse({
      root: stackOf('root', [
        { type: 'stat', id: 's', title: 't', query: 'ROW a = 1' },
        { type: 'table', id: 'table', query: 'ROW b = 2' },
        { type: 'fields', id: 'facts', query: 'ROW c = 3' },
      ]),
    });
    expect(result.success).toBe(true);
  });

  it('reports structural issues first, then reference issues in document order', () => {
    expect(
      issuesOf({
        root: stackOf('root', [
          { type: 'markdown', id: 'dup', text: 'a' },
          { type: 'select', id: 'find', label: 'Find', bind: 'nope', options: [{ value: 'a' }] },
          { type: 'markdown', id: 'dup', text: 'b' },
        ]),
      })
    ).toEqual(['Duplicate node id "dup"', 'Node "find" binds unknown state key "nope"']);
  });
});

const issuesOf = (input: unknown): string[] => {
  const result = appDocumentSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map(({ message }) => message);
};

describe('state declarations', () => {
  const withState = (state: unknown) => ({
    state,
    root: { type: 'markdown', id: 'a', text: 'hi' },
  });

  it('parses typed state with defaults', () => {
    const result = appDocumentSchema.parse(
      withState({
        service: { type: 'string', default: 'checkout' },
        limit: { type: 'number', default: 10 },
        compact: { type: 'boolean', default: false },
      })
    );
    expect(result.state.limit).toEqual({ type: 'number', default: 10 });
  });

  it('requires a default that matches the declared type', () => {
    expect(issuesOf(withState({ a: { type: 'number', default: 'ten' } }))).not.toEqual([]);
    expect(issuesOf(withState({ a: { type: 'string' } }))).not.toEqual([]);
    expect(issuesOf(withState({ a: { type: 'number', default: Infinity } }))).not.toEqual([]);
  });

  it.each(['1abc', 'has space', 'a-b', 'a.b', '', 'x'.repeat(65)])(
    'rejects %p as a state key, since it cannot be an ES|QL parameter name',
    (key) => {
      expect(issuesOf(withState({ [key]: { type: 'string', default: '' } }))).not.toEqual([]);
    }
  );

  it.each(['_tstart', '_tend', '_TSTART'])('rejects the reserved key %s', (key) => {
    expect(issuesOf(withState({ [key]: { type: 'string', default: '' } }))).not.toEqual([]);
  });

  it('rejects an over-long default string and too many keys', () => {
    expect(issuesOf(withState({ a: { type: 'string', default: 'x'.repeat(1001) } }))).not.toEqual(
      []
    );

    const tooMany = Object.fromEntries(
      Array.from({ length: 21 }, (_, index) => [`k${index}`, { type: 'string', default: '' }])
    );
    expect(issuesOf(withState(tooMany))).toContain('A document may hold at most 20 state keys');
  });
});

describe('interpolation references', () => {
  const doc = (text: string) => ({
    state: { service: { type: 'string', default: 'checkout' } },
    root: { type: 'header', id: 'title', text },
  });

  it('accepts references to declared keys', () => {
    expect(issuesOf(doc('Service {{state.service}}'))).toEqual([]);
  });

  it('rejects a reference to an undeclared key', () => {
    expect(issuesOf(doc('Service {{state.sevrice}}'))).toEqual([
      'Node "title" refers to unknown state key "sevrice"',
    ]);
  });

  it('rejects anything that looks like a reference but is not one', () => {
    expect(issuesOf(doc('{{state.service.name}}'))).toEqual([
      'Node "title" has a malformed reference in "text"; use {{state.<key>}}',
    ]);
  });

  it('checks every interpolated prop, such as a callout body and a flyout title', () => {
    expect(
      issuesOf({
        root: {
          type: 'section',
          title: 'App',
          id: 'root',
          children: [
            { type: 'markdown', id: 'c', text: '{{state.nope}}' },
            { type: 'flyout', id: 'f', title: '{{state.nada}}', children: [] },
          ],
        },
      })
    ).toEqual([
      'Node "c" refers to unknown state key "nope"',
      'Node "f" refers to unknown state key "nada"',
    ]);
  });
});

describe('table, flyout and key_value nodes', () => {
  const tableDoc = (onRowClick: unknown, extra: Record<string, unknown> = {}) => ({
    state: {
      service: { type: 'string', default: '' },
      limit: { type: 'number', default: 1 },
    },
    root: {
      type: 'section',
      title: 'App',
      id: 'root',
      children: [
        { type: 'table', id: 'orders-table', query: 'FROM orders | LIMIT 10', onRowClick },
        { type: 'flyout', id: 'detail', title: 'Detail', children: [] },
      ],
    },
    ...extra,
  });

  it('parses a table with typed columns and a row click that fills state and opens a flyout', () => {
    const result = appDocumentSchema.parse(
      tableDoc([{ state: { service: { fromColumn: 'service.name' } } }, { flyout: 'detail' }])
    );
    const [table] = getNodeChildren(result.root);
    expect(table).toMatchObject({ type: 'table', query: 'FROM orders | LIMIT 10' });
  });

  it('takes a single action without a list', () => {
    expect(issuesOf(tableDoc({ flyout: 'detail' }))).toEqual([]);
  });

  it('defaults a table to no actions', () => {
    const result = appDocumentSchema.parse(tableDoc([]));
    const [table, flyout] = getNodeChildren(result.root);
    expect(table).toMatchObject({ onRowClick: [] });
    expect(flyout).toMatchObject({ children: [] });
  });

  it('finds a flyout nested inside another container', () => {
    const doc = tableDoc([{ flyout: 'inner' }]);
    (doc.root.children as unknown[]).push({
      type: 'section',
      title: 'App',
      id: 'wrap',
      children: [{ type: 'flyout', id: 'inner', title: 'Inner', children: [] }],
    });
    expect(issuesOf(doc)).toEqual([]);
  });

  it('rejects opening a node that does not exist or is not a flyout', () => {
    expect(issuesOf(tableDoc([{ flyout: 'nope' }]))).toEqual([
      'Node "orders-table" opens "nope", which is not a flyout',
    ]);
    expect(issuesOf(tableDoc([{ flyout: 'orders-table' }]))).toEqual([
      'Node "orders-table" opens "orders-table", which is not a flyout',
    ]);
  });

  it('rejects setting an undeclared state key', () => {
    expect(issuesOf(tableDoc([{ state: { ghost: 'x' } }]))).toEqual([
      'Node "orders-table" sets unknown state key "ghost"',
    ]);
  });

  it('rejects a literal that does not match the key type', () => {
    expect(issuesOf(tableDoc([{ state: { limit: 'ten' } }]))).toEqual([
      'Node "orders-table" sets state key "limit" (number) to a string',
    ]);
    expect(issuesOf(tableDoc([{ state: { limit: 5 } }]))).toEqual([]);
  });

  it('rejects fromInput on a table, where there is no input', () => {
    expect(issuesOf(tableDoc([{ state: { service: { fromInput: true } } }]))).toEqual([
      'Node "orders-table": fromInput is only valid on input nodes',
    ]);
  });

  it('rejects more than five actions on one event, and unknown action types', () => {
    const open = { flyout: 'detail' };
    expect(issuesOf(tableDoc(Array.from({ length: 6 }, () => open)))).not.toEqual([]);
    expect(issuesOf(tableDoc([{ type: 'runScript', code: 'alert(1)' }]))).not.toEqual([]);
    expect(issuesOf(tableDoc([{ flyout: 'detail', state: { limit: 5 } }]))).toEqual([
      'An action has exactly one of the keys "state", "flyout", "workflow"',
    ]);
  });

  it('validates flyout content like any other node', () => {
    expect(
      issuesOf({
        root: {
          type: 'flyout',
          id: 'f',
          title: 'Detail',
          children: [
            { type: 'select', id: 'find', label: 'Find', bind: 'ghost', options: [{ value: 'a' }] },
          ],
        },
      })
    ).toEqual(['Node "find" binds unknown state key "ghost"']);
  });
});

describe('customAppStateSchema', () => {
  const document = { root: { type: 'markdown', id: 'a', text: 'hi' } };

  it('requires the current version', () => {
    expect(customAppStateSchema.safeParse({ version: 1, document }).success).toBe(true);
    expect(customAppStateSchema.safeParse({ document }).success).toBe(false);
    expect(customAppStateSchema.safeParse({ version: 2, document }).success).toBe(false);
  });
});

describe('getNodeChildren', () => {
  it('returns children for a stack and none for leaf nodes', () => {
    const { root } = appDocumentSchema.parse({
      root: stackOf('root', [{ type: 'markdown', id: 'a', text: 'hi' }]),
    });
    expect(getNodeChildren(root)).toHaveLength(1);
    expect(getNodeChildren(getNodeChildren(root)[0])).toEqual([]);
  });
});
