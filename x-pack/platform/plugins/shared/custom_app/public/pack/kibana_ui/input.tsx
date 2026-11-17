/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { EuiFieldText, EuiFormRow } from '@elastic/eui';
import { MAX_STATE_STRING_LENGTH } from '@kbn/custom-app-common';
import { toActionArray, type AppNodeProps, type KibanaUiRenderer } from '@kbn/custom-app-registry';
import type { InputNode } from '../../../common/pack';

type Node = InputNode & AppNodeProps;

/** A box whose text is a value of the app: each change sets it, then runs the node's handlers. */
export const renderInput: KibanaUiRenderer<Node> = (node, env) => (
  <EuiFormRow label={node.label} data-node-id={node.id}>
    <EuiFieldText
      compressed
      value={String(env.state[node.bind ?? ''] ?? '')}
      placeholder={node.placeholder}
      maxLength={MAX_STATE_STRING_LENGTH}
      onChange={(event) =>
        env.dispatch(
          [
            { state: { [node.bind ?? '']: { fromInput: true } } },
            ...toActionArray(node.onChange ?? []),
          ],
          { input: event.target.value }
        )
      }
    />
  </EuiFormRow>
);
