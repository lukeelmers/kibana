/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { EuiFlexGroup, EuiFlexItem, EuiTitle } from '@elastic/eui';
import type { KibanaUiRenderer } from '@kbn/custom-app-registry';
import type { AppNode } from '@kbn/custom-app-common';

export const renderSection: KibanaUiRenderer<AppNode> = (node, env) => (
  <EuiFlexGroup direction="column" gutterSize="m" responsive={false} data-node-id={node.id}>
    <EuiFlexItem grow={false}>
      <EuiTitle size="xs">
        <h3>{String(node.title)}</h3>
      </EuiTitle>
    </EuiFlexItem>
    {(node.children ?? []).map((child) => (
      <EuiFlexItem key={child.id} grow={false}>
        {env.renderChild(child)}
      </EuiFlexItem>
    ))}
  </EuiFlexGroup>
);
