/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { createContext, useContext, type ReactNode } from 'react';
import {
  EuiFlyout,
  EuiFlyoutBody,
  EuiFlyoutHeader,
  EuiTitle,
  useGeneratedHtmlId,
} from '@elastic/eui';
import { interpolate } from '@kbn/custom-app-common';
import {
  useAppRuntime,
  useFlyoutRow,
  useOpenFlyoutId,
  useStateValues,
} from '../runtime/app_runtime_context';

const CloseFlyoutContext = createContext<(() => void) | undefined>(undefined);

/** Closes the flyout the component is in, when it is in one. */
export const useCloseFlyout = () => useContext(CloseFlyoutContext);

interface FlyoutNodeProps {
  node: { id: string; title: string };
  /**
   * The node's children, rendered with the row of the row click that opened it, if one did. They
   * are only mounted while the flyout is open.
   */
  children: (row: Readonly<Record<string, unknown>> | undefined) => ReactNode;
}

/**
 * Renders nothing until an action opens it, so the sources its content reads are only run while
 * it is open.
 */
export const FlyoutNode = ({ node, children }: FlyoutNodeProps) => {
  const runtime = useAppRuntime();
  const openFlyoutId = useOpenFlyoutId();
  const row = useFlyoutRow();
  const state = useStateValues();
  const titleId = useGeneratedHtmlId({ prefix: 'customAppFlyoutTitle' });

  if (openFlyoutId !== node.id) return null;
  // Only this flyout: what its form ran may have opened another.
  const close = () => {
    if (runtime.openFlyoutId$.getValue() === node.id) runtime.openFlyoutId$.next(undefined);
  };

  return (
    <EuiFlyout ownFocus size="m" onClose={close} aria-labelledby={titleId} data-node-id={node.id}>
      <EuiFlyoutHeader hasBorder>
        <EuiTitle size="m">
          <h2 id={titleId}>{interpolate(node.title, { state, row: row ?? {} })}</h2>
        </EuiTitle>
      </EuiFlyoutHeader>
      <EuiFlyoutBody>
        <CloseFlyoutContext.Provider value={close}>{children(row)}</CloseFlyoutContext.Provider>
      </EuiFlyoutBody>
    </EuiFlyout>
  );
};
