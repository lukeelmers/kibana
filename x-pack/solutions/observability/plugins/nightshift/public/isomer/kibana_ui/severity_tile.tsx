/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import type { AppNodeProps, KibanaUiRenderer } from '@kbn/custom-app-registry';
import { SeverityTile, type SeverityTileNode } from '../../../common/isomer';

export const renderSeverityTile: KibanaUiRenderer<SeverityTileNode & AppNodeProps> = (
  { id, severity, count, onClick },
  { dispatch }
) => (
  <SeverityTile
    severity={severity}
    count={count}
    isMuted={count === 0}
    onClick={onClick ? () => dispatch(onClick) : undefined}
    anchorProps={{ 'data-node-id': id }}
  />
);
