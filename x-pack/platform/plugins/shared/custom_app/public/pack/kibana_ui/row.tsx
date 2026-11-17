/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { EuiFlexGroup, EuiFlexItem } from '@elastic/eui';
import type { AppNodeProps, KibanaUiRenderer } from '@kbn/custom-app-registry';

export const renderRow: KibanaUiRenderer<AppNodeProps> = (node, env) => (
  <EuiFlexGroup gutterSize="m" wrap responsive={false} data-node-id={node.id}>
    {(node.children ?? []).map((child) => (
      <EuiFlexItem key={child.id}>{env.renderChild(child)}</EuiFlexItem>
    ))}
  </EuiFlexGroup>
);
