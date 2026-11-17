/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useState } from 'react';
import { EuiButton, EuiToolTip } from '@elastic/eui';
import type { AppNodeProps, KibanaUiEnv, KibanaUiRenderer } from '@kbn/custom-app-registry';
import type { ButtonNode } from '../../../common/pack';
import { useActionGate } from '../../actions/use_action_gate';
import { DroppedActions } from '../../components/dropped_actions';

type Node = ButtonNode & AppNodeProps;

/**
 * What a person presses to make something happen. It says why when it cannot be pressed: a button
 * that runs a workflow needs the privilege to, and the reason is shown as its tooltip.
 */
const ButtonView = ({ node, env }: { node: Node; env: KibanaUiEnv }) => {
  const [dropped, setDropped] = useState<string[]>([]);
  const onClick = node.onClick ?? [];
  const unavailableReason = useActionGate(onClick);

  return (
    <div data-node-id={node.id}>
      <EuiToolTip content={unavailableReason}>
        <EuiButton
          fill
          isDisabled={unavailableReason !== undefined}
          onClick={() => setDropped(env.dispatch(onClick))}
          data-test-subj="customAppButton"
        >
          {node.label}
        </EuiButton>
      </EuiToolTip>
      <DroppedActions reasons={dropped} onDismiss={() => setDropped([])} />
    </div>
  );
};

export const renderButton: KibanaUiRenderer<Node> = (node, env) => (
  <ButtonView node={node} env={env} />
);
