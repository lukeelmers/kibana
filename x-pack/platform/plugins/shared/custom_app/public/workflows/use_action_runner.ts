/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { useCallback, useEffect, useRef } from 'react';
import type { Action } from '@kbn/custom-app-common';
import type { ActionInput } from '../runtime/app_runtime';
import { useAppRuntime } from '../runtime/app_runtime_context';
import { useBindingScope } from '../runtime/binding_scope';
import { getServices } from '../services';
import { useWorkflowRunner } from './workflow_runner';

/**
 * Opens a conversation in Agent Builder's details flyout, closing the one this component opened
 * before. Without Agent Builder there is nothing to open it in, and it says so to the console.
 */
const useConversationOpener = () => {
  const close = useRef<(() => void) | undefined>();
  useEffect(() => () => close.current?.(), []);

  return useCallback((conversationId: string) => {
    const { agentBuilder } = getServices();
    if (!agentBuilder) {
      // eslint-disable-next-line no-console
      console.warn(
        `A custom app asked to open the conversation "${conversationId}", but Agent Builder is not available`
      );
      return;
    }
    close.current?.();
    close.current = undefined;
    void agentBuilder
      .openConversationDetails({
        conversationId,
        onClose: () => {
          close.current = undefined;
        },
      })
      .then((closeFlyout) => {
        close.current = closeFlyout;
      });
  }, []);
};

/**
 * Runs the actions of a component. What changes the app happens at once; a workflow an action asks
 * for is put to the user first. Returns what could not be applied, with the reason.
 */
export const useActionRunner = (nodeId: string) => {
  const runtime = useAppRuntime();
  const runner = useWorkflowRunner();
  const { queries } = useBindingScope();
  const openConversation = useConversationOpener();

  return useCallback(
    (actions: readonly Action[], input?: ActionInput): string[] => {
      const { dropped, workflows, conversations } = runtime.run(actions, { queries, ...input });
      if (workflows.length > 0) runner.request(workflows, nodeId);
      conversations.forEach(openConversation);
      return dropped;
    },
    [runtime, runner, nodeId, queries, openConversation]
  );
};
