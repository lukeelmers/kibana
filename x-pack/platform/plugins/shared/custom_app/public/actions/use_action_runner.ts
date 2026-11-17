/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { useCallback } from 'react';
import { useActionUis } from '@kbn/custom-app-registry';
import type { ActionList } from '@kbn/custom-app-common';
import type { ActionInput } from '../runtime/app_runtime';
import { useAppRuntime } from '../runtime/app_runtime_context';

/**
 * Runs the actions of a component. What changes the app happens at once; what an action asks the
 * app to do, such as a workflow, is put to the person first by the part of the action that is
 * drawn. Returns what could not be applied, with the reason.
 */
export const useActionRunner = (nodeId: string) => {
  const runtime = useAppRuntime();
  const uis = useActionUis();

  return useCallback(
    (actions: ActionList, input?: ActionInput, onDone?: () => void): string[] => {
      const { dropped, requests } = runtime.run(actions, input);
      const byAction = new Map<string, unknown[]>();
      requests.forEach(({ action, payload }) =>
        byAction.set(action, [...(byAction.get(action) ?? []), payload])
      );
      const done = Array.from(byAction, ([action, payloads]) =>
        uis[action] ? uis[action].request(payloads, nodeId) : Promise.resolve(false)
      );
      if (onDone && dropped.length === 0) {
        Promise.all(done).then((results) => results.every(Boolean) && onDone());
      }
      return dropped;
    },
    [runtime, uis, nodeId]
  );
};
