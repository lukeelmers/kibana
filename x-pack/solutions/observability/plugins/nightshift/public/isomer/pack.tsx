/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { definePrimitivePack } from '@elastic/isomer-sdk';
import type { CoreStart } from '@kbn/core/public';
import { NIGHTSHIFT_APP_ID } from '@kbn/deeplinks-observability';
import { KibanaContextProvider } from '@kbn/kibana-react-plugin/public';
import { withKibanaUi } from '@kbn/custom-app-registry';
import {
  investigationList,
  investigationRow,
  investigationSearch,
  pageHeader,
  severityTile,
} from '../../common/isomer';
import type { NightshiftStartDependencies } from '../types';
import { renderInvestigationList } from './kibana_ui/investigation_list';
import { renderInvestigationSearch } from './kibana_ui/investigation_search';
import { createPageHeaderRenderer } from './kibana_ui/page_header';
import { renderSeverityTile } from './kibana_ui/severity_tile';

export { registerNightshiftDataAdapters } from '../../common/isomer/data_adapters';

/**
 * The Nightshift pack for the browser, with `kibana-ui` renderers that draw the primitives as the
 * Nightshift page does, with the components of the page and the services they read.
 */
export const createBrowserNightshiftPack = (
  core: CoreStart,
  plugins: NightshiftStartDependencies
) => {
  const services = { ...core, ...plugins };
  return definePrimitivePack({
    id: 'nightshift',
    primitives: [
      withKibanaUi(
        pageHeader,
        createPageHeaderRenderer(
          core.application.getUrlForApp(NIGHTSHIFT_APP_ID, { path: '/detections/events' })
        )
      ),
      withKibanaUi(severityTile, renderSeverityTile),
      investigationRow,
      withKibanaUi(investigationList, (node, env) => (
        <KibanaContextProvider services={services}>
          {renderInvestigationList(node, env)}
        </KibanaContextProvider>
      )),
      withKibanaUi(investigationSearch, renderInvestigationSearch),
    ],
  });
};
