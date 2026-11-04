/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { SavedObjectReference } from '@kbn/core/server';
import { extractWorkflowReferences, injectWorkflowReferences } from '@kbn/custom-app-common';

/** Stores the workflows an app runs as references, which Fleet points at the ids it installs. */
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
