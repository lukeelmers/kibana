/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useMemo, type ReactNode } from 'react';
import { listActionUiProviders, type ActionUiHost } from '@kbn/custom-app-registry';
import { useOptionalDataLayer } from '../data/data_layer_context';

/**
 * Puts around the app what the actions that were registered need drawn, such as the dialog that
 * asks the person to confirm a workflow. Each is given where the app is and how to refresh it.
 */
export const ActionUiProviders = ({
  appId,
  workflows,
  children,
}: {
  appId?: string;
  workflows?: ActionUiHost['workflows'];
  children: ReactNode;
}) => {
  const layer = useOptionalDataLayer();
  const host = useMemo(
    () => ({ appId, workflows, refreshData: () => layer?.retry() }),
    [appId, workflows, layer]
  );

  return (
    <>
      {listActionUiProviders().reduceRight(
        (inner, [id, Provider]) => (
          <Provider key={id} host={host}>
            {inner}
          </Provider>
        ),
        <>{children}</>
      )}
    </>
  );
};
