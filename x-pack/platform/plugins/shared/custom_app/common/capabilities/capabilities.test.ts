/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { z } from '@kbn/zod/v4';
import { appDocumentSchema } from '@kbn/custom-app-common';
import { getInterpolatedText } from '@kbn/custom-app-common';
import { collectSources } from '@kbn/custom-app-common';
import { BUILTIN_CAPABILITIES, registerBuiltinCapabilities } from './manifests';
import {
  checkCapability,
  defineCapability,
  describeCapability,
  getCapability,
  registerCapability,
} from '@kbn/custom-app-registry';

const documentWith = (node: Record<string, unknown>) => ({
  title: 'App',
  state: {},
  body: [node],
});

describe('capabilities', () => {
  it('registers what ships with custom apps, once', () => {
    registerBuiltinCapabilities();
    registerBuiltinCapabilities();
    expect(getCapability('stat')).toBe(BUILTIN_CAPABILITIES.find(({ id }) => id === 'stat'));
  });

  it('does not take a second capability with the same id', () => {
    const other = defineCapability({ ...getCapability('header')!, version: 2 });
    expect(() => registerCapability(other)).toThrow('registered already');
  });

  it.each(BUILTIN_CAPABILITIES.map(({ id }) => id))('has nothing wrong with %s', (id) => {
    expect(checkCapability(getCapability(id)!)).toEqual([]);
  });

  it('finds what is wrong with a capability', () => {
    const broken = defineCapability({
      kind: 'component',
      id: 'Broken-One',
      version: 0,
      props: z.object({ text: z.string() }),
      doc: { summary: 'x', whenToUse: 'y', example: { type: 'other', id: 'a' } },
      interpolated: ['text'],
      migrations: { 3: (props) => props },
    });
    expect(checkCapability(broken)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('lowercase words'),
        expect.stringContaining('whole number'),
        expect.stringContaining('"text" has no description'),
        expect.stringContaining('migration from version 3'),
        expect.stringContaining('does not validate'),
        expect.stringContaining('must be of type "Broken-One"'),
      ])
    );
  });

  it('checks a primitive without the props its query fills', () => {
    const stat = {
      type: 'stat',
      id: 'errors',
      title: 'Errors',
      query: 'FROM logs-* | STATS n = COUNT(*)',
    };
    const parsed = appDocumentSchema.parse(documentWith(stat));
    expect(collectSources(parsed.body)).toEqual({
      errors: { type: 'esql', query: 'FROM logs-* | STATS n = COUNT(*)' },
    });
    expect(appDocumentSchema.safeParse(documentWith({ ...stat, query: undefined })).success).toBe(
      false
    );
    expect(appDocumentSchema.safeParse(documentWith({ ...stat, title: '' })).success).toBe(false);
  });

  it('takes the text that can use values from the manifest', () => {
    expect(
      getInterpolatedText({ type: 'header', id: 'title', text: 'Up {{state.region}}' })
    ).toEqual([{ prop: 'text', text: 'Up {{state.region}}' }]);
  });

  it('describes a capability for an LLM from its primitive', () => {
    expect(describeCapability(getCapability('stat')!)).toContain(
      '- stat { title, surfaces?, query }'
    );
  });

  it('takes a capability that another plugin registers, with no edit to the built-in ones', async () => {
    await jest.isolateModulesAsync(async () => {
      const { z: zod } = await import('@kbn/zod/v4');
      const registry = await import('@kbn/custom-app-registry');
      registry.registerCapability(
        registry.defineCapability({
          kind: 'component',
          id: 'gauge',
          version: 1,
          props: zod.object({ title: zod.string().describe('What it measures.') }),
          doc: {
            summary: 'A dial.',
            whenToUse: 'For a value in a range.',
            example: { type: 'gauge', id: 'load', title: 'Load' },
          },
        })
      );
      const { appDocumentSchema: schema } = await import('@kbn/custom-app-common');
      expect(
        schema.safeParse(documentWith({ type: 'gauge', id: 'load', title: 'Load' })).success
      ).toBe(true);
      expect(schema.safeParse(documentWith({ type: 'gauge', id: 'load' })).success).toBe(false);
    });
  });
});
