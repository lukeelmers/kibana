/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { ActionType } from '../types';

/**
 * The spec version a connector runs (its pin, or the default for connectors stored without one)
 * and the newest version of the same major, which it can be updated to. Empty for classic types.
 */
export const getConnectorSpecVersions = (
  actionType: Pick<ActionType, 'specVersions'>,
  pin: string | undefined
): { specVersion?: string; latestSpecVersion?: string } => {
  const { specVersions } = actionType;
  if (!specVersions) {
    return {};
  }
  const specVersion = pin ?? specVersions.getDefaultVersion();
  const major = Number(specVersion.split('.')[0]);
  return { specVersion, latestSpecVersion: specVersions.getLatestVersion(major) };
};
