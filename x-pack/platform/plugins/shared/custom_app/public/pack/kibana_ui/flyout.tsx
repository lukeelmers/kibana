/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { EuiFlexGroup, EuiFlexItem } from '@elastic/eui';
import type { AppNodeProps, KibanaUiRenderer } from '@kbn/custom-app-registry';
import type { FlyoutNode as Node } from '../../../common/pack';
import { FlyoutNode } from '../../components/flyout_node';

export const renderFlyout: KibanaUiRenderer<Node & AppNodeProps> = (node, env) => (
  <FlyoutNode node={node}>
    {(row) => (
      <EuiFlexGroup direction="column" gutterSize="m" responsive={false}>
        {(node.children ?? []).map((child) => (
          <EuiFlexItem key={child.id} grow={false}>
            {env.renderChild(child, row)}
          </EuiFlexItem>
        ))}
      </EuiFlexGroup>
    )}
  </FlyoutNode>
);
