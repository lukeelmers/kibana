/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import type { PrimitiveNode } from '@elastic/isomer-sdk';
import {
  definePrimitive,
  formatDisplayValue,
  nodeAnchor,
  requiredString,
  z,
} from '@elastic/isomer-sdk';
import { md } from '@elastic/isomer-sdk/markdown';
import { classNames, isomerDistillery } from '@kbn/isomer-theme';

const schema = z.object({
  type: z.literal('stat'),
  title: requiredString().max(150).describe('What the value is, shown under it, such as "Errors".'),
  value: z
    .union([z.number(), z.string().max(100), z.null()])
    .describe('The value: a number, or a short text. Null when there is none.'),
});

/** One figure with its label, such as a total. */
export type StatNode = z.infer<typeof schema> & PrimitiveNode;

const display = ({ value }: StatNode): string =>
  typeof value === 'number' ? formatDisplayValue({ raw: value }) : value ?? '—';

const example: StatNode = { type: 'stat', title: 'Errors', value: 1284 };
const examples: StatNode[] = [example, { type: 'stat', title: 'Status', value: 'Healthy' }];

const { handles } = isomerDistillery.createStyleModule(
  'customAppStat',
  ({ css, tokens: { border, color, font, size } }) => ({
    root: css`
      margin: ${size.s} 0;
      padding: ${size.m};
      border: ${border.width.thin} solid ${color.border.subdued};
      border-radius: ${border.radius.panel};
    `,
    value: css`
      margin: 0;
      color: ${color.text.heading};
      font-size: ${font.size.xl};
      font-weight: ${font.weight.bold};
      line-height: ${font.lineHeight.xl};
    `,
    title: css`
      margin: 0;
      color: ${color.text.subdued};
      font-size: ${font.size.s};
      line-height: ${font.lineHeight.s};
    `,
  })
);

export const stat = definePrimitive({
  type: 'stat',
  schema,
  catalog: {
    type: 'stat',
    purpose: 'One figure with a label under it, such as a total or a count.',
    useWhen: ['A single number answers the question.'],
    avoidWhen: ['The figure has rows behind it the reader needs. Use a `table`.'],
    example,
  },
  examples,
  renderers: {
    react: (node, { context }) => (
      <div {...nodeAnchor(context, node)} className={classNames(context, handles.root)}>
        <p className={classNames(context, handles.value)}>{display(node)}</p>
        <p className={classNames(context, handles.title)}>{node.title}</p>
      </div>
    ),
    text: (node) => `${node.title}: ${display(node)}`,
    markdown: (node) => md.paragraph(md.strong(node.title), `: ${display(node)}`),
  },
});
