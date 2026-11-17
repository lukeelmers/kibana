/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { EuiFlexGroup, EuiFlexItem } from '@elastic/eui';
import { getEbtProps } from '@kbn/ebt-click';
import type { Severity, SeverityCounts } from '@kbn/nightshift-investigations-plugin/common';
import { SEVERITY_OPTIONS } from '@kbn/significant-events-schema';
import { SeverityTile } from '../../../../common/isomer/severity_tile';
import { NIGHTSHIFT_EBT_ACTIONS, NIGHTSHIFT_EBT_ELEMENTS } from '../../../common/ebt_constants';

export interface InvestigationSeverityTilesProps {
  severityCounts: SeverityCounts;
  scrollableSeverities: ReadonlySet<Severity>;
  isLoading: boolean;
  onSeverityClick: (severity: Severity) => void;
}

export const InvestigationSeverityTiles = ({
  severityCounts,
  scrollableSeverities,
  isLoading,
  onSeverityClick,
}: InvestigationSeverityTilesProps): React.ReactElement => (
  <EuiFlexGroup gutterSize="m" responsive={false}>
    {SEVERITY_OPTIONS.map((severity) => {
      const isMuted = !scrollableSeverities.has(severity);

      return (
        <EuiFlexItem key={severity}>
          <SeverityTile
            severity={severity}
            count={severityCounts[severity]}
            isMuted={isMuted}
            isLoading={isLoading}
            onClick={isMuted ? undefined : () => onSeverityClick(severity)}
            {...(isMuted
              ? {}
              : getEbtProps({
                  action: NIGHTSHIFT_EBT_ACTIONS.VIEW_SEVERITY_INVESTIGATIONS,
                  element: NIGHTSHIFT_EBT_ELEMENTS.SEVERITY_TILES,
                  // The tier is the point of the click; the count rides on the page-view event.
                  detail: severity,
                }))}
          />
        </EuiFlexItem>
      );
    })}
  </EuiFlexGroup>
);
