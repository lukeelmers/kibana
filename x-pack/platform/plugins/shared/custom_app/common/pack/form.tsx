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
import { optionSchema } from './select';

const fieldSchema = z
  .object({
    name: z
      .string()
      .regex(/^[A-Za-z_][A-Za-z0-9_]*$/)
      .max(64)
      .describe(
        'The value of the app the answer is put in when the form is submitted, and the input of a workflow that is given no inputs.'
      ),
    label: z.string().max(100).optional().describe('The question, when not the name.'),
    kind: z.enum(['text', 'select']).optional().describe('A text box, the default, or a select.'),
    options: z.array(optionSchema).max(50).optional().describe('The choices of a select.'),
    required: z.boolean().optional().describe('The form is not submitted while it is empty.'),
    value: z
      .string()
      .max(1000)
      .optional()
      .describe('The answer it starts with. It may use {{row.<column>}} or {{state.<key>}}.'),
  })
  .strict();

const schema = z.object({
  type: z.literal('form'),
  fields: z.array(fieldSchema).min(1).max(10).describe('The questions, in order. 1 to 10.'),
  submitLabel: requiredString().max(100).describe('The words on the submit button.'),
});

/** Questions whose answers go into values of the app when it is submitted. */
export type FormNode = z.infer<typeof schema> & PrimitiveNode;
export type FormField = FormNode['fields'][number];

const example: FormNode = {
  type: 'form',
  fields: [{ name: 'reason', label: 'Reason', required: true }],
  submitLabel: 'Send',
};
const examples: FormNode[] = [example];

const questions = ({ fields }: FormNode) => fields.map(({ name, label }) => label ?? name);

export const form = definePrimitive({
  type: 'form',
  schema,
  catalog: {
    type: 'form',
    purpose: 'Asks for answers, and acts on them only when it is submitted, such as a workflow.',
    useWhen: ['A workflow needs something the reader must write or choose, such as a reason.'],
    avoidWhen: ['The value filters what is shown as it changes. Use an `input` or a `select`.'],
    example,
  },
  examples,
  renderers: {
    react: (node, { context }) => (
      <ul {...nodeAnchor(context, node)}>
        {questions(node).map((question) => (
          <li key={question}>{question}</li>
        ))}
      </ul>
    ),
    text: (node) => `${questions(node).join(', ')} [${node.submitLabel}]`,
    markdown: (node) => md.list(questions(node).map((question) => md.paragraph(question))),
  },
});
