/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { EuiHorizontalRule, EuiText } from '@elastic/eui';
import { definePrimitive, nodeAnchor, type PrimitiveNode, z } from '@elastic/isomer-sdk';
import { md } from '@elastic/isomer-sdk/markdown';
import { i18n } from '@kbn/i18n';
import {
  InvestigationRow,
  investigationRowMarkdown,
  investigationRowPropsSchema,
  investigationRowText,
} from './investigation_row';

const NO_INVESTIGATIONS = i18n.translate('xpack.nightshift.isomer.investigationList.empty', {
  defaultMessage: 'No investigations.',
});

const schema = z.object({
  type: z.literal('investigation_list'),
  rows: z
    .array(investigationRowPropsSchema)
    .max(100)
    .describe('The investigations, newest first. Each is an `investigation_row` without `type`.'),
});

export type InvestigationListNode = z.infer<typeof schema> & PrimitiveNode;

const example: InvestigationListNode = {
  type: 'investigation_list',
  rows: [
    {
      title: 'Error spike in the search service',
      created_at: '2026-11-17T15:30:00.000Z',
      in_progress: true,
    },
    {
      title: 'Checkout latency doubled on web-prod',
      summary: 'A cache change at 14:00 sent most reads to the database.',
      created_at: '2026-11-17T14:05:00.000Z',
      in_progress: false,
      severity: 'high',
      entities: ['checkout', 'payments'],
    },
  ],
};

const examples: InvestigationListNode[] = [example, { type: 'investigation_list', rows: [] }];

export const investigationList = definePrimitive({
  type: 'investigation_list',
  schema,
  catalog: {
    type: 'investigation_list',
    purpose: 'A list of Nightshift investigations, one compact row each.',
    useWhen: ['The message lists several investigations, such as the ones still open.'],
    avoidWhen: ['There is one investigation. Use `investigation_row`.'],
    example,
  },
  examples,
  renderers: {
    react: (node, { context }) => (
      <div {...nodeAnchor(context, node)}>
        {node.rows.length === 0 && (
          <EuiText size="s" color="subdued">
            <p>{NO_INVESTIGATIONS}</p>
          </EuiText>
        )}
        {node.rows.map((row, index) => (
          <React.Fragment key={index}>
            {index > 0 && <EuiHorizontalRule margin="none" />}
            <InvestigationRow {...row} />
          </React.Fragment>
        ))}
      </div>
    ),
    text: ({ rows }) =>
      rows.length > 0
        ? rows.map((row) => `- ${investigationRowText(row)}`).join('\n')
        : NO_INVESTIGATIONS,
    markdown: ({ rows }) =>
      rows.length > 0
        ? md.list(rows.map(investigationRowMarkdown))
        : md.paragraph(md.emphasis(NO_INVESTIGATIONS)),
  },
});
