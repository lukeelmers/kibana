/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { EuiFieldSearch } from '@elastic/eui';
import { definePrimitive, nodeAnchor, type PrimitiveNode, z } from '@elastic/isomer-sdk';
import { md } from '@elastic/isomer-sdk/markdown';
import { i18n } from '@kbn/i18n';

export const SEARCH_PLACEHOLDER = i18n.translate(
  'xpack.nightshift.isomer.investigationSearch.placeholder',
  { defaultMessage: 'Search' }
);

const schema = z.object({
  type: z.literal('investigation_search'),
  placeholder: z.string().max(100).optional().describe('A hint shown in the empty box.'),
});

export type InvestigationSearchNode = z.infer<typeof schema> & PrimitiveNode;

const example: InvestigationSearchNode = { type: 'investigation_search' };

export const investigationSearch = definePrimitive({
  type: 'investigation_search',
  schema,
  catalog: {
    type: 'investigation_search',
    purpose: 'The search box of a Nightshift page, whose text the queries of the page can use.',
    useWhen: ['The reader filters the investigations by text they type.'],
    avoidWhen: ['The page is not a Nightshift page. Use an `input`.'],
    example,
  },
  examples: [example],
  renderers: {
    react: (node, { context }) => (
      <EuiFieldSearch
        data-test-subj="nightshiftInvestigationSearchFieldSearch"
        {...nodeAnchor(context, node)}
        placeholder={node.placeholder ?? SEARCH_PLACEHOLDER}
        fullWidth
        compressed
        readOnly
      />
    ),
    text: ({ placeholder }) => `${placeholder ?? SEARCH_PLACEHOLDER}: ____`,
    markdown: ({ placeholder }) =>
      md.paragraph(md.strong(placeholder ?? SEARCH_PLACEHOLDER), ': ____'),
  },
});
