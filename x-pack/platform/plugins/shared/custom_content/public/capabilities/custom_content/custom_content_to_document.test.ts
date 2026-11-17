/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { customContentToDocument } from './custom_content_to_document';

describe('customContentToDocument', () => {
  it('makes an app named by its title, whose one section shows the template', () => {
    expect(
      customContentToDocument({ esql_query: ['FROM status'], template: '<p>x</p>' }, 'Status')
    ).toEqual({
      title: 'Status',
      state: {},
      body: [
        { type: 'section', title: 'Status', children: [{ type: 'markdown', text: '<p>x</p>' }] },
      ],
    });
  });

  it('says so when the panel has no template yet', () => {
    expect(() => customContentToDocument({ esql_query: ['FROM logs'] }, 'Status')).toThrow(
      'This panel has no content yet.'
    );
  });
});
