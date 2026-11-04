/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { extractWorkflowReferences, injectWorkflowReferences } from './workflow_references';

const document = {
  state: { host: { type: 'string', default: '' } },
  root: {
    type: 'stack',
    id: 'root',
    children: [
      {
        type: 'table',
        id: 'hosts',
        query: 'FROM hosts',
        onRowClick: [
          { type: 'setState', key: 'host', value: { fromColumn: 'host' } },
          { type: 'openFlyout', flyout: 'detail' },
        ],
      },
      {
        type: 'flyout',
        id: 'detail',
        title: 'Detail',
        children: [
          {
            type: 'button',
            id: 'isolate',
            label: 'Isolate',
            onClick: [
              {
                type: 'runWorkflow',
                workflow: 'isolate-host',
                inputs: { host: { fromState: 'host' } },
              },
              { type: 'closeFlyout' },
            ],
          },
          {
            type: 'form',
            id: 'note',
            fields: [],
            onSubmit: [{ type: 'runWorkflow', workflow: 'add-note', inputs: {} }],
          },
        ],
      },
    ],
  },
};

const flyoutChildren = (doc: typeof document) =>
  (doc.root.children[1] as { children: Array<{ onClick?: unknown[]; onSubmit?: unknown[] }> })
    .children;

describe('the references to the workflows of an app', () => {
  it('moves the id of each workflow an action runs into a reference', () => {
    const { document: extracted, references } = extractWorkflowReferences(document);

    expect(references).toEqual([
      { name: 'workflow_0', type: 'workflow', id: 'isolate-host' },
      { name: 'workflow_1', type: 'workflow', id: 'add-note' },
    ]);
    const [isolate, note] = flyoutChildren(extracted);
    expect(isolate.onClick).toEqual([
      {
        type: 'runWorkflow',
        workflowRefName: 'workflow_0',
        inputs: { host: { fromState: 'host' } },
      },
      { type: 'closeFlyout' },
    ]);
    expect(note.onSubmit).toEqual([
      { type: 'runWorkflow', workflowRefName: 'workflow_1', inputs: {} },
    ]);
  });

  it('leaves every other part of the document as it is, and does not change what it is given', () => {
    const before = JSON.stringify(document);
    const { document: extracted } = extractWorkflowReferences(document);

    expect(JSON.stringify(document)).toBe(before);
    expect(extracted.state).toEqual(document.state);
    expect(extracted.root.children[0]).toEqual(document.root.children[0]);
  });

  it('gives back the document it took the references from', () => {
    const { document: extracted, references } = extractWorkflowReferences(document);

    expect(injectWorkflowReferences(extracted, references)).toEqual(document);
  });

  it('reads the id a reference was given, such as one rewritten on import', () => {
    const { document: extracted, references } = extractWorkflowReferences(document);
    const moved = references.map((reference) => ({ ...reference, id: `space-a-${reference.id}` }));

    const [isolate] = flyoutChildren(injectWorkflowReferences(extracted, moved));
    expect(isolate.onClick?.[0]).toMatchObject({ workflow: 'space-a-isolate-host' });
  });

  it('leaves an action that still holds an id, as one saved before references did', () => {
    expect(injectWorkflowReferences(document, [])).toEqual(document);
  });

  it('finds the workflows run by the row actions of a list and by nodes in slots', () => {
    const listDocument = {
      root: {
        type: 'section',
        id: 'section',
        titleNode: {
          type: 'button',
          id: 'title_button',
          onClick: [{ type: 'runWorkflow', workflow: 'from-title', inputs: {} }],
        },
        children: [
          {
            type: 'list',
            id: 'list',
            query: 'FROM cases',
            onRowClick: [],
            rowActions: [
              {
                label: 'Create case',
                onClick: [{ type: 'runWorkflow', workflow: 'create-case', inputs: {} }],
              },
            ],
            template: {
              type: 'button',
              id: 'row_button',
              onClick: [{ type: 'runWorkflow', workflow: 'from-template', inputs: {} }],
            },
          },
        ],
      },
    };

    const { document: extracted, references } = extractWorkflowReferences(listDocument);

    expect(references.map(({ id }) => id)).toEqual(['from-title', 'create-case', 'from-template']);
    expect(JSON.stringify(extracted)).not.toContain('"workflow":');
    expect(injectWorkflowReferences(extracted, references)).toEqual(listDocument);
  });

  it('refuses a reference name that has no reference', () => {
    const { document: extracted } = extractWorkflowReferences(document);

    expect(() => injectWorkflowReferences(extracted, [])).toThrow(
      'Could not find reference "workflow_0"'
    );
  });
});
