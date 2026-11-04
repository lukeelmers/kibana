/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { SavedObjectReference } from '@kbn/core/server';
import { extractWorkflowReferences, injectWorkflowReferences } from '@kbn/custom-app-common';

/**
 * The workflows an app runs are saved object references of the `custom_app` saved object, so that
 * an import, a copy to another space or a Fleet package can point them at other ids. The stored
 * document names each workflow by `workflowRefName`; the routes give and take real ids.
 */
export const extractReferences = <Attributes extends { document: { root: unknown } }>({
  attributes,
}: {
  attributes: Attributes;
}): { attributes: Attributes; references: SavedObjectReference[] } => {
  const { document, references } = extractWorkflowReferences(attributes.document);
  return { attributes: { ...attributes, document }, references };
};

export const injectReferences = <Attributes extends { document: { root: unknown } }>({
  attributes,
  references,
}: {
  attributes: Attributes;
  references: SavedObjectReference[];
}): Attributes => ({
  ...attributes,
  document: injectWorkflowReferences(attributes.document, references),
});
