/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { ManagedWorkflowDefinition, ManagedWorkflowTemplateValues } from '../types';

export const FLEET_PACKAGE_WORKFLOW_ID = 'system-fleet-package-workflow';

export interface FleetPackageWorkflowTemplateValues extends ManagedWorkflowTemplateValues {
  yaml: string;
}

export const FLEET_PACKAGE_WORKFLOW = {
  id: FLEET_PACKAGE_WORKFLOW_ID,
  pluginId: 'fleet',
  version: 1,
  billable: false,
  visibility: { lists: ['workflows'] },
  // The package file's own `enabled` value is honoured; the workflow schema defaults it to true.
  yamlTemplate: ({ yaml }) => yaml,
  management: {
    lifecycle: 'dynamic',
    versionStrategy: 'auto',
    enablement: 'restorable',
  },
} as const satisfies ManagedWorkflowDefinition<FleetPackageWorkflowTemplateValues>;
