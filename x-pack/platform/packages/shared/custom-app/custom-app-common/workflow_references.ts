/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

/** The type of the saved object references that name the workflows an app runs. */
export const WORKFLOW_REFERENCE_TYPE = 'workflow';

export interface WorkflowReference {
  name: string;
  type: typeof WORKFLOW_REFERENCE_TYPE;
  id: string;
}

type JsonObject = Record<string, unknown>;

/** The props of a node that hold the actions it runs. */
const ACTION_PROPS = ['onClick', 'onRowClick', 'onSubmit', 'onChange'] as const;

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const mapNodeActions = (node: JsonObject, mapAction: (action: JsonObject) => JsonObject) => {
  const mapped: JsonObject = { ...node };
  for (const prop of ACTION_PROPS) {
    const actions = node[prop];
    if (Array.isArray(actions)) {
      mapped[prop] = actions.map((action) => (isObject(action) ? mapAction(action) : action));
    }
  }
  if (Array.isArray(node.children)) {
    mapped.children = node.children.map((child) =>
      isObject(child) ? mapNodeActions(child, mapAction) : child
    );
  }
  return mapped;
};

const mapDocumentActions = <Document extends { root: unknown }>(
  document: Document,
  mapAction: (action: JsonObject) => JsonObject
): Document =>
  isObject(document.root)
    ? { ...document, root: mapNodeActions(document.root, mapAction) }
    : document;

/**
 * Moves the id of the workflow of every `runWorkflow` action into a saved object reference, as a
 * dashboard does with its panels. The action keeps the name of its reference in `workflowRefName`,
 * so that the ids can be rewritten where saved objects are copied or imported.
 */
export const extractWorkflowReferences = <Document extends { root: unknown }>(
  document: Document
): { document: Document; references: WorkflowReference[] } => {
  const references: WorkflowReference[] = [];
  const extracted = mapDocumentActions(document, (action) => {
    if (action.type !== 'runWorkflow' || typeof action.workflow !== 'string' || !action.workflow) {
      return action;
    }
    const { workflow, ...rest } = action;
    const name = `workflow_${references.length}`;
    references.push({ name, type: WORKFLOW_REFERENCE_TYPE, id: workflow });
    return { ...rest, workflowRefName: name };
  });
  return { document: extracted, references };
};

/** Puts the ids of the workflows back in the actions, from the references of the saved object. */
export const injectWorkflowReferences = <Document extends { root: unknown }>(
  document: Document,
  references: ReadonlyArray<{ name: string; type: string; id: string }>
): Document =>
  mapDocumentActions(document, (action) => {
    if (action.type !== 'runWorkflow' || typeof action.workflowRefName !== 'string') {
      return action;
    }
    const { workflowRefName, ...rest } = action;
    const reference = references.find(
      ({ name, type }) => name === workflowRefName && type === WORKFLOW_REFERENCE_TYPE
    );
    if (!reference) {
      throw new Error(`Could not find reference "${workflowRefName}"`);
    }
    return { ...rest, workflow: reference.id };
  });
