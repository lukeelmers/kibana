/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { findReferences, resolveText } from '@kbn/custom-app-common';
import type { ActionHandler } from '@kbn/custom-app-registry';
import {
  getWorkflowRefLabel,
  type RunWorkflowAction,
} from '../../../common/custom_app/run_workflow/manifest';

type PlainValue = string | number | boolean | null;

const isPlainValue = (value: unknown): value is PlainValue =>
  value === null ||
  typeof value === 'string' ||
  typeof value === 'boolean' ||
  (typeof value === 'number' && Number.isFinite(value));

const toWorkflowInput = (value: unknown): PlainValue | readonly PlainValue[] | undefined => {
  if (isPlainValue(value)) return value;
  if (Array.isArray(value) && value.every(isPlainValue)) return value;
  return undefined;
};

export const runWorkflowHandler: ActionHandler<RunWorkflowAction> = (
  action,
  { input, state, drop, request }
) => {
  const { workflow } = action;
  const inputs: Record<string, PlainValue | readonly PlainValue[]> = {};
  // One input that cannot be had is reason enough not to run the workflow at all: it would be
  // handed less than it was written to be given.
  const missing = Object.entries(action.inputs ?? {}).find(([name, text]) => {
    const column = findReferences(text).find(
      ({ scope, key }) => scope === 'row' && !(input.row && key in input.row)
    );
    if (column) {
      drop(`Column "${column.key}" is not in the row`);
      return true;
    }

    const resolved = resolveText(text, { state, row: input.row });
    // A column the row has no value in, such as a severity not rated yet, leaves the input out.
    if (resolved === undefined) return false;
    const value = toWorkflowInput(resolved);
    if (value === undefined) {
      drop(`The input "${name}" of "${getWorkflowRefLabel(workflow)}" is not a plain value`);
      return true;
    }
    inputs[name] = value;
    return false;
  });
  if (!missing) request({ workflow, inputs });
};
