/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { type ReactNode } from 'react';
import { z, lazySchema } from '@kbn/zod/v4';
import {
  ActionUiBridge,
  defineAction,
  registerAction,
  type Action,
  type ActionHandler,
  type ActionUiApi,
} from '@kbn/custom-app-registry';
import { findReferences, resolveText } from '@kbn/custom-app-common';

/**
 * Stands in, in tests, for the `workflow` action that the Workflows plugin registers, which this
 * plugin cannot import: it is another plugin, and it is not a dependency. It has the same settings,
 * the same rules about where it may run, and hands over what it resolves in the same way, so that
 * what the app does with a workflow can be tried here. The real one has its own tests. It also
 * stands in for the dialog that asks to confirm it: a double that tests set, and read.
 */
const standIn = defineAction({
  kind: 'action',
  id: 'workflow',
  version: 1,
  props: lazySchema(() =>
    z.object({
      workflow: z.union([z.string().min(1).max(200), z.object({ id: z.string().min(1) }).strict()]),
      inputs: z
        .record(z.string().min(1).max(100), z.string().max(1000))
        .refine((inputs) => Object.keys(inputs).length <= 20)
        .optional(),
    })
  ),
  doc: { summary: 'Runs a workflow.', whenToUse: 'In tests.', example: { workflow: 'w' } },
  validate: (action, { nodeId, event, checkText, issue }) => {
    if (!['onClick', 'onRowClick', 'onChartClick', 'onSubmit'].includes(event)) {
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

const workflowId = ({ workflow }: { workflow: string | { id: string } }): string =>
  typeof workflow === 'string' ? workflow : workflow.id;

const handler: ActionHandler<{
  workflow: string | { id: string };
  inputs?: Record<string, string>;
}> = (action, { input, state, drop, request }) => {
  const workflow = workflowId(action);
  const inputs: Record<string, unknown> = {};
  const missing = Object.entries(action.inputs ?? {}).find(([name, text]) => {
    const column = findReferences(text).find(
      ({ scope, key }) => scope === 'row' && !(input.row && key in input.row)
    );
    if (column) {
      drop(`Column "${column.key}" is not in the row`);
      return true;
    }
    const resolved = resolveText(text, { state, row: input.row });
    const isPlain = (value: unknown) =>
      value === null || ['string', 'boolean', 'number'].includes(typeof value);
    if (!isPlain(resolved) && !(Array.isArray(resolved) && resolved.every(isPlain))) {
      drop(`The input "${name}" of "${workflow}" is not a plain value`);
      return true;
    }
    inputs[name] = resolved;
    return false;
  });
  if (!missing) request({ workflow, inputs });
};

/** What the tests set, and read, in place of the real dialog and the Workflows API. */
export const mockWorkflowRunner: {
  availability: { canRun: true } | { canRun: false; reason: string };
  statuses: Record<string, 'found' | 'missing' | 'unknown'>;
  track: jest.Mock;
  request: jest.Mock;
} = { availability: { canRun: true }, statuses: {}, track: jest.fn(), request: jest.fn() };

const ids = (actions: readonly Action[]): string[] =>
  actions.flatMap((action) => {
    const { workflow } = action as { workflow?: string | { id: string } };
    return workflow === undefined ? [] : [workflowId({ workflow })];
  });

const api: ActionUiApi = {
  request: (payloads, nodeId) =>
    Promise.resolve(mockWorkflowRunner.request(payloads, nodeId) !== false),
  watch: (actions) => {
    if (mockWorkflowRunner.availability.canRun) mockWorkflowRunner.track(ids(actions));
  },
  gate: (actions) => {
    const { availability, statuses } = mockWorkflowRunner;
    if (!availability.canRun) return availability.reason;
    const missing = ids(actions).find((id) => id !== '' && statuses[id] === 'missing');
    return missing === undefined
      ? undefined
      : `The workflow "${missing}" has not been saved yet. Save it in the Workflows application and this will work.`;
  },
};

const StandInUi = ({ children }: { host: unknown; children: ReactNode }) => (
  <ActionUiBridge actionId="workflow" api={api}>
    {children}
  </ActionUiBridge>
);

export const registerRunWorkflowStandIn = (): void =>
  registerAction(standIn, handler as ActionHandler, StandInUi);
