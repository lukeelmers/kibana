/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useEffect, useState } from 'react';
import { EuiSkeletonText } from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import { KbnDangerCallout } from '@kbn/ui-callout';
import type { AppNode } from '@kbn/custom-app-common';
import { KIBANA_UI_RENDERERS } from '../pack/kibana_ui';
import { getServices } from '../services';
import { createKibanaUiSurface, type KibanaUiSurface } from '../surface/kibana_ui_surface';

/** The nodes of an app, drawn through the `kibana-ui` surface once the Isomer runtime has loaded. */
export const AppBody = ({ root }: { root: AppNode }) => {
  const [surface, setSurface] = useState<KibanaUiSurface>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let mounted = true;
    const { core, isomer } = getServices();
    isomer.getRuntime().then(
      (runtime) => {
        if (!mounted) return;
        setSurface(
          createKibanaUiSurface(runtime, {
            renderers: KIBANA_UI_RENDERERS,
            resolveKibanaPath: (path) => core.http.basePath.prepend(path),
          })
        );
      },
      (reason) => mounted && setError(String(reason))
    );
    return () => {
      mounted = false;
    };
  }, []);

  if (error) {
    return (
      <KbnDangerCallout
        announceOnMount={false}
        size="s"
        title={i18n.translate('xpack.customApp.appBody.runtimeError', {
          defaultMessage: 'Unable to load the app',
        })}
        text={error}
      />
    );
  }
  return surface ? <>{surface.render([root])}</> : <EuiSkeletonText lines={3} isLoading />;
};
