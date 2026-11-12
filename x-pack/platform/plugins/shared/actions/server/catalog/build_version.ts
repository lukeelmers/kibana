/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { createHash } from 'crypto';
import { parseDeclarativeConnectorSpec } from './parse_spec';
import { buildConnectorSpec } from './build_spec';
import type { BuiltVersion } from './types';

const getContentHash = (raw: string): string =>
  `sha256:${createHash('sha256').update(raw, 'utf8').digest('hex')}`;

/** Parses a connector YAML document and builds its ConnectorSpec. */
export const buildVersion = (yaml: string): BuiltVersion => {
  const connector = parseDeclarativeConnectorSpec(yaml);
  return {
    id: connector.id,
    version: connector.version,
    contentHash: getContentHash(yaml),
    spec: buildConnectorSpec(connector),
  };
};
