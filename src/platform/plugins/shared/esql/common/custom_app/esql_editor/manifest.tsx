/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React from 'react';
import type { PrimitiveNode } from '@elastic/isomer-sdk';
import { definePrimitive, nodeAnchor, z } from '@elastic/isomer-sdk';
import { md } from '@elastic/isomer-sdk/markdown';
import { stateKeySchema } from '@kbn/custom-app-registry';
import { MAX_HEADING_LENGTH, MAX_QUERY_LENGTH } from '@kbn/custom-app-common';

const esqlEditorSchema = z.object({
  type: z.literal('esql_editor'),
  title: z
    .string()
    .max(MAX_HEADING_LENGTH)
    .optional()
    .describe('A heading above the editor. It may use {{state.key}}.'),
  query: z
    .string()
    .max(MAX_QUERY_LENGTH)
    .describe('The ES|QL query the editor starts with. People can change it.'),
  bind: stateKeySchema
    .optional()
    .describe(
      'A text value of the app that holds the query as it is written, so that an action can hand it to a workflow. It must be declared as a string.'
    ),
});

/** An ES|QL editor for the people using an app. */
export type EsqlEditorNode = z.infer<typeof esqlEditorSchema> & PrimitiveNode;

const example: EsqlEditorNode = {
  type: 'esql_editor',
  title: 'Explore the logs',
  query: 'FROM logs-* | LIMIT 10',
};

const examples: EsqlEditorNode[] = [
  example,
  { type: 'esql_editor', query: 'FROM logs-* | LIMIT 10', bind: 'query' },
];

export const esqlEditor = definePrimitive({
  type: 'esql_editor',
  schema: esqlEditorSchema,
  catalog: {
    type: 'esql_editor',
    purpose:
      'An ES|QL editor and a Run button, with a table of what the query returns, for people who write their own queries. The query runs as the person who is looking, with the period and the filters of the app, and the values of the app are offered to it as ?name. With "bind" the text is kept in a value of the app.',
    useWhen: ['The people using the app should write queries themselves.'],
    avoidWhen: ['The app fixes the query. Use `code` to show it, or `table` for what it returns.'],
    example,
  },
  examples,
  renderers: {
    react: (node, { context }) => (
      <div {...nodeAnchor(context, node)}>
        {node.title ? <h4>{node.title}</h4> : null}
        <pre>
          <code data-language="esql">{node.query}</code>
        </pre>
      </div>
    ),
    text: ({ title, query }) => (title ? `${title}\n\n${query}` : query),
    markdown: ({ title, query }) => [
      ...(title ? [md.heading(4, title)] : []),
      md.codeBlock(query, 'esql'),
    ],
  },
});
