/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { FtrProviderContext } from '../ftr_provider_context';

// eslint-disable-next-line import/no-default-export
export default function ({ loadTestFile }: FtrProviderContext) {
  describe('Cloud Security Posture', function () {
    loadTestFile(require.resolve('./agentless_api_sanity'));
    loadTestFile(require.resolve('./dashboard_sanity'));
    loadTestFile(require.resolve('./benchmark_sanity'));
    loadTestFile(require.resolve('./findings_sanity'));
  });
}
