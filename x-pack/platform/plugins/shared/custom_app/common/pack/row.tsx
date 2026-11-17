/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { Fragment } from 'react';
import type { DefaultPackTypes, PrimitiveNode } from '@elastic/isomer-sdk';
import { definePrimitive, nodeAnchor, unresolvedBodyNodeSchema, z } from '@elastic/isomer-sdk';
import { classNames, isomerDistillery } from '@kbn/isomer-theme';
import type { StatNode } from './stat';

const schema = z.object({
  type: z.literal('row'),
  body: z.array(unresolvedBodyNodeSchema).min(1).describe('The content, left to right.'),
});

/** Content side by side, such as a few stats. */
export interface RowNode extends PrimitiveNode {
  type: 'row';
  body: readonly PrimitiveNode[];
}

const errors: StatNode = { type: 'stat', title: 'Errors', value: 1284 };
const services: StatNode = { type: 'stat', title: 'Services', value: 12 };
const example: RowNode = { type: 'row', body: [errors, services] };

const { handles } = isomerDistillery.createStyleModule(
  'customAppRow',
  ({ css, tokens: { size } }) => ({
    root: css`
      display: flex;
      flex-wrap: wrap;
      gap: ${size.m};
      margin: ${size.s} 0;

      & > * {
        flex: 1 1 0;
        min-width: 0;
      }
    `,
  })
);

export const row = definePrimitive<RowNode, DefaultPackTypes, typeof schema>({
  type: 'row',
  schema,
  schemaFor: (bodyNodeSchema) =>
    schema.extend({
      body: z.array(bodyNodeSchema).min(1).describe('The content, left to right.'),
    }),
  catalog: {
    type: 'row',
    purpose: 'Lays out its content side by side, such as a few stats or filters.',
    useWhen: ['A few short parts read better next to each other than one under the other.'],
    avoidWhen: ['The parts are long, or need a label. Use a `section`.'],
    example,
  },
  examples: [example],
  children: ({ body }) => body.map((node, index) => ({ node, path: `body[${index}]` })),
  renderers: {
    react: (node, { context, scope }) => (
      <div {...nodeAnchor(context, node)} className={classNames(context, handles.root)}>
        {node.body.map((child, index) => (
          <Fragment key={index}>{scope.renderReact(child, context)}</Fragment>
        ))}
      </div>
    ),
    text: ({ body }, { scope }) => body.map((child) => scope.renderText(child)).join('\n'),
    markdown: ({ body }, { scope }) => body.map((child) => scope.renderMarkdownContent(child)),
  },
});
