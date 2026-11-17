/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { Fragment } from 'react';
import type { DefaultPackTypes, PrimitiveNode } from '@elastic/isomer-sdk';
import {
  definePrimitive,
  nodeAnchor,
  requiredString,
  unresolvedBodyNodeSchema,
  z,
} from '@elastic/isomer-sdk';
import { md } from '@elastic/isomer-sdk/markdown';
import type { StatNode } from './stat';

const schema = z.object({
  type: z.literal('flyout'),
  title: requiredString().max(150).describe('The title of the panel.'),
  body: z.array(unresolvedBodyNodeSchema).min(1).describe('The content of the panel, in order.'),
});

/** A side panel that a handler opens, with detail that takes no room until it is asked for. */
export interface FlyoutNode extends PrimitiveNode {
  type: 'flyout';
  title: string;
  body: readonly PrimitiveNode[];
}

const detail: StatNode = { type: 'stat', title: 'Errors', value: 12 };
const example: FlyoutNode = { type: 'flyout', title: 'checkout', body: [detail] };

export const flyout = definePrimitive<FlyoutNode, DefaultPackTypes, typeof schema>({
  type: 'flyout',
  schema,
  schemaFor: (bodyNodeSchema) =>
    schema.extend({
      body: z.array(bodyNodeSchema).min(1).describe('The content of the panel, in order.'),
    }),
  catalog: {
    type: 'flyout',
    purpose: 'A side panel that a button or a row click opens, with the detail of one thing.',
    useWhen: ['Detail should take no room on the page until it is asked for.'],
    avoidWhen: ['The content is always worth showing. Use a `section`.'],
    example,
  },
  examples: [example],
  children: ({ body }) => body.map((node, index) => ({ node, path: `body[${index}]` })),
  renderers: {
    react: (node, { context, scope }) => (
      <aside {...nodeAnchor(context, node)}>
        <h3>{node.title}</h3>
        {node.body.map((child, index) => (
          <Fragment key={index}>{scope.renderReact(child, context)}</Fragment>
        ))}
      </aside>
    ),
    text: ({ title, body }, { scope }) =>
      [title, ...body.map((child) => scope.renderText(child))].join('\n'),
    markdown: ({ title, body }, { scope }) => [
      md.heading(3, title),
      ...body.map((child) => scope.renderMarkdownContent(child)),
    ],
  },
});
