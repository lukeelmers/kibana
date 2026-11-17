/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import type { AppNodeProps, KibanaUiRenderer } from '@kbn/custom-app-registry';
import type { PageHeaderNode } from '../../../common/isomer';
import { NightshiftHeader } from '../../app/header';

/** The Nightshift page's own header, with its link to all events when the node asks for it. */
export const createPageHeaderRenderer =
  (showAllEventsHref: string): KibanaUiRenderer<PageHeaderNode & AppNodeProps> =>
  ({ id, title, in_progress_count: inProgressCount = 0, show_all_events: showAllEvents }) =>
    (
      <div data-node-id={id}>
        <NightshiftHeader
          title={title}
          hasActiveInvestigations={inProgressCount > 0}
          showAllEventsHref={showAllEvents ? showAllEventsHref : undefined}
        />
      </div>
    );
