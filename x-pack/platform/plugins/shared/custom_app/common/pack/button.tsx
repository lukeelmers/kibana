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
  type: z.literal('button'),
  label: requiredString().max(100).describe('The words on the button, such as "Escalate".'),
});

/** A button that runs the app's handlers when it is pressed. */
export type ButtonNode = z.infer<typeof schema> & PrimitiveNode;

const example: ButtonNode = { type: 'button', label: 'Escalate' };
const examples: ButtonNode[] = [example];

export const button = definePrimitive({
  type: 'button',
  schema,
  catalog: {
    type: 'button',
    purpose: 'A button that does something when it is pressed, such as running a workflow.',
    useWhen: ['The reader can act from the app, such as to run a workflow or open a flyout.'],
    avoidWhen: ['It only goes to another page. Use a `link`.'],
    example,
  },
  examples,
  renderers: {
    react: (node, { context }) => (
      <button {...nodeAnchor(context, node)} type="button" disabled>
        {node.label}
      </button>
    ),
    text: ({ label }) => `[${label}]`,
    markdown: ({ label }) => md.paragraph(md.strong(label)),
  },
});
