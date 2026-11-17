/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { EuiFlexGroup, EuiFlexItem, EuiIcon, EuiText, EuiTitle } from '@elastic/eui';
import { definePrimitive, nodeAnchor, type PrimitiveNode, z } from '@elastic/isomer-sdk';
import { md } from '@elastic/isomer-sdk/markdown';
import { getGreeting, getHeroTitle } from '../hero';

const schema = z.object({
  type: z.literal('page_header'),
  title: z
    .string()
    .max(150)
    .optional()
    .describe('The page title. Left out, it says whether investigations are underway.'),
  in_progress_count: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe('How many investigations are in progress, which the title follows.'),
  show_all_events: z
    .boolean()
    .optional()
    .describe('Whether the header links to all the significant events Nightshift detected.'),
});

export type PageHeaderNode = z.infer<typeof schema> & PrimitiveNode;

/** The title the header shows: its own, or what the investigations in progress say. */
const getPageHeaderTitle = ({ title, in_progress_count: count }: PageHeaderNode): string =>
  title ?? getHeroTitle({ isLoading: false, hasActiveInvestigations: (count ?? 0) > 0 });

const example: PageHeaderNode = {
  type: 'page_header',
  in_progress_count: 2,
  show_all_events: true,
};

const examples: PageHeaderNode[] = [example, { type: 'page_header', title: 'Investigations' }];

export const pageHeader = definePrimitive({
  type: 'page_header',
  schema,
  catalog: {
    type: 'page_header',
    purpose: 'The greeting and title at the top of a Nightshift page.',
    useWhen: ['A Nightshift page or report needs its title at the top.'],
    avoidWhen: ['The heading labels a part of the page. Use `header` or `section`.'],
    example,
  },
  examples,
  renderers: {
    react: (node, { context }) => (
      <EuiFlexGroup
        {...nodeAnchor(context, node)}
        alignItems="center"
        gutterSize="m"
        responsive={false}
      >
        <EuiFlexItem grow={false}>
          <EuiIcon type="moon" size="xl" color="primary" aria-hidden />
        </EuiFlexItem>
        <EuiFlexItem>
          <EuiText color="subdued" size="s">
            <p>{getGreeting()}</p>
          </EuiText>
          <EuiTitle size="m">
            <h2>{getPageHeaderTitle(node)}</h2>
          </EuiTitle>
        </EuiFlexItem>
      </EuiFlexGroup>
    ),
    text: (node) => getPageHeaderTitle(node),
    markdown: (node) => md.heading(1, getPageHeaderTitle(node)),
  },
});
