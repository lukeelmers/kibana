/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { type CustomContentState } from '@kbn/custom-content-common';
import type { GenericNode } from '@kbn/custom-app-registry';

/** An app as it is sent to be saved, which checks it against the components it knows. */
export interface NewAppDocument {
  title: string;
  state: Record<string, never>;
  body: GenericNode[];
}

/**
 * The app that a custom content panel is: a section with its template as text. It throws, with
 * what is wrong, when the panel has no template yet.
 */
export const customContentToDocument = (
  state: CustomContentState,
  title: string
): NewAppDocument => {
  if (!state.template) throw new Error('This panel has no content yet.');
  return {
    title,
    state: {},
    body: [{ type: 'section', title, children: [{ type: 'markdown', text: state.template }] }],
  };
};
