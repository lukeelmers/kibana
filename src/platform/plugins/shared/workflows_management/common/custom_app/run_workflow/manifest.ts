/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import {
  MAX_STATE_STRING_LENGTH,
  MAX_WORKFLOW_ID_LENGTH,
  MAX_WORKFLOW_INPUT_NAME_LENGTH,
  MAX_WORKFLOW_INPUTS,
} from '@kbn/custom-app-common';
import { type ActionOf, defineAction } from '@kbn/custom-app-registry';
import { lazySchema, z } from '@kbn/zod/v4';

const WORKFLOW_EVENTS: readonly string[] = ['onClick', 'onRowClick', 'onChartClick', 'onSubmit'];

export const runWorkflowAction = defineAction({
  kind: 'action',
  id: 'workflow',
  version: 1,
  props: lazySchema(() =>
    z.object({
      workflow: z
        .union([
          z.string().min(1).max(MAX_WORKFLOW_ID_LENGTH),
          z.object({ id: z.string().min(1).max(MAX_WORKFLOW_ID_LENGTH) }).strict(),
        ])
        .describe(
          'The workflow: "<name>" for the file kibana/workflow/<name>.yml of the package the app is installed from, "<package>:<name>" for that file of another package, or { "id": "<id>" } for a workflow saved in the Workflows application. Only an app installed from a package can name workflows by file.'
        ),
      inputs: z
        .record(
          z.string().min(1).max(MAX_WORKFLOW_INPUT_NAME_LENGTH),
          z.string().max(MAX_STATE_STRING_LENGTH)
        )
        .refine((inputs) => Object.keys(inputs).length <= MAX_WORKFLOW_INPUTS, {
          message: `An action may hand at most ${MAX_WORKFLOW_INPUTS} inputs to a workflow`,
        })
        .optional()
        .describe(
          'What to hand to the workflow, by the name of each input: a text that may use {{row.<column>}} and {{state.<key>}}. A text that is one reference hands that value as it is. Left out on a form, the answers of the form, by name.'
        ),
    })
  ),
  doc: {
    summary:
      'Runs a workflow, as the person who pressed, once they have confirmed it. It can only be run by a button, a row click, a click on a chart or a form that is submitted.',
    whenToUse:
      'To do something that changes things: create a case, acknowledge an alert, send a message.',
    example: {
      workflow: { id: 'notify-on-call' },
      inputs: { service: '{{row.service}}' },
    },
  },
  validate: (action, { nodeId, event, checkText, issue }) => {
    if (!WORKFLOW_EVENTS.includes(event)) {
      issue(
        `Node "${nodeId}" runs a workflow on ${event}; a workflow can only be run by a button, a row click, a click on a chart or a form that is submitted`
      );
    }
    Object.entries(action.inputs ?? {}).forEach(([name, text]) => {
      checkText(text).forEach((problem) =>
        issue(`Node "${nodeId}": the input "${name}" of the workflow ${problem}`)
      );
    });
  },
});

export type WorkflowRef = string | { id: string };

/** How a reference to a workflow is shown: the name or the id it is written with. */
export const getWorkflowRefLabel = (workflow: WorkflowRef): string =>
  typeof workflow === 'string' ? workflow : workflow.id;

/**
 * The id of the workflow a reference names: `{ id }` is that id, and a name is looked up in what
 * the server resolved for the saved app. Undefined when it was not resolved.
 */
export const getWorkflowId = (
  { workflow }: { workflow: WorkflowRef },
  workflows: Readonly<Record<string, string | null>> = {}
): string | undefined =>
  typeof workflow === 'string' ? workflows[workflow] ?? undefined : workflow.id;

declare module '@kbn/custom-app-registry' {
  interface ActionTypeMap {
    workflow: ActionOf<typeof runWorkflowAction>;
  }
}

/** What the app is handed to run, with every input already resolved. */
export type RunWorkflowAction = ActionOf<typeof runWorkflowAction>;
