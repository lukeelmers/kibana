/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import type { AppMountParameters, CoreStart } from '@kbn/core/public';
import { App } from './app';
import { getServices } from '../services';
import { createSavedAppsClient } from './saved_apps_client';

export const renderApp = (
  core: CoreStart,
  { element, history, onAppLeave }: AppMountParameters,
  onAppsChanged: () => void = () => {}
) => {
  const { agentBuilder, embeddable } = getServices();
  const client = createSavedAppsClient(core.http);
  // The side navigation lists some apps, so it is told when one is created, changed or deleted.
  const notifying =
    <Args extends unknown[], Result>(call: (...args: Args) => Promise<Result>) =>
    async (...args: Args) => {
      const result = await call(...args);
      onAppsChanged();
      return result;
    };
  const root = createRoot(element);
  root.render(
    core.rendering.addContext(
      <App
        history={history}
        client={{
          ...client,
          create: notifying(client.create),
          update: notifying(client.update),
          remove: notifying(client.remove),
        }}
        chrome={core.chrome}
        notifications={core.notifications}
        onAppLeave={onAppLeave}
        stateTransfer={embeddable.getStateTransfer()}
        canWriteDashboards={core.application.capabilities.dashboard_v2?.showWriteControls === true}
        canSave={core.application.capabilities.customApp?.save === true}
        featureFlags={core.featureFlags}
        agentBuilder={agentBuilder}
      />
    )
  );

  return () => root.unmount();
};
