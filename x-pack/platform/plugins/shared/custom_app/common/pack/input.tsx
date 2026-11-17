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

const schema = z.object({
  type: z.literal('input'),
  label: requiredString()
    .max(100)
    .describe('What to type, shown above the box, such as "Service".'),
  placeholder: z.string().max(100).optional().describe('A hint shown in the empty box.'),
});

/** A box to type a value of the app into, such as a search. */
export type InputNode = z.infer<typeof schema> & PrimitiveNode;

const example: InputNode = { type: 'input', label: 'Service', placeholder: 'Search services' };
const examples: InputNode[] = [example];

export const input = definePrimitive({
  type: 'input',
  schema,
  catalog: {
    type: 'input',
    purpose: 'A box to type a value into, which the queries of the app can use, such as a search.',
    useWhen: ['The reader filters what the app shows by text they type.'],
    avoidWhen: ['The value is one of a few known choices. Use a `select`.'],
    example,
  },
  examples,
  renderers: {
    react: (node, { context }) => (
      <label {...nodeAnchor(context, node)}>
        {node.label} <input type="text" placeholder={node.placeholder} readOnly />
      </label>
    ),
    text: ({ label }) => `${label}: ____`,
    markdown: ({ label }) => md.paragraph(md.strong(label), ': ____'),
  },
});
