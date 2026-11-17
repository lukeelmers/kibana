/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import type { PrimitiveNode } from '@elastic/isomer-sdk';
import { definePrimitive, nodeAnchor, requiredString, z } from '@elastic/isomer-sdk';
import { md } from '@elastic/isomer-sdk/markdown';

export const optionSchema = z
  .object({
    value: z.string().max(1000).describe('What the option sets.'),
    label: z.string().max(100).optional().describe('What it shows, when not the value.'),
  })
  .strict();

const schema = z.object({
  type: z.literal('select'),
  label: requiredString().max(100).describe('What to choose, shown above it, such as "Region".'),
  options: z.array(optionSchema).max(50).default([]).describe('The choices, at most 50.'),
  multiple: z
    .boolean()
    .optional()
    .describe('Several options can be chosen, and the value it sets is a list.'),
});

/** A drop-down that sets a value of the app. */
export type SelectNode = z.infer<typeof schema> & PrimitiveNode;

const example: SelectNode = {
  type: 'select',
  label: 'Region',
  options: [{ value: '', label: 'All regions' }, { value: 'eu' }],
};
const examples: SelectNode[] = [example];

const labels = ({ options }: SelectNode) =>
  options.map(({ value, label }) => label ?? value).join(', ');

export const select = definePrimitive({
  type: 'select',
  schema,
  catalog: {
    type: 'select',
    purpose: 'A drop-down of choices, which the queries of the app can use, such as a region.',
    useWhen: ['The reader filters what the app shows by one of a few known values.'],
    avoidWhen: ['The value is free text. Use an `input`.'],
    example,
  },
  examples,
  renderers: {
    react: (node, { context }) => (
      <label {...nodeAnchor(context, node)}>
        {node.label}{' '}
        <select disabled>
          {node.options.map(({ value, label }) => (
            <option key={value} value={value}>
              {label ?? value}
            </option>
          ))}
        </select>
      </label>
    ),
    text: (node) => `${node.label}: ${labels(node)}`,
    markdown: (node) => md.paragraph(md.strong(node.label), `: ${labels(node)}`),
  },
});
