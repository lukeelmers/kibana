/*
 * Licensed to Elasticsearch B.V. under one or more contributor
 * license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { KibanaRequest } from 'src/core/server';

import { coreMock } from '../../../../../core/server/mocks';
import { expressionsPluginMock } from '../../../../../plugins/expressions/server/mocks';
import { BucketAggType, MetricAggType } from '../../../common';
import { createFieldFormatsStartMock } from '../../field_formats/mocks';

import { AggsService, AggsSetupDependencies, AggsStartDependencies } from './aggs_service';

const { savedObjects, uiSettings } = coreMock.createStart();

describe('AggsService - server', () => {
  let service: AggsService;
  let setupDeps: AggsSetupDependencies;
  let startDeps: AggsStartDependencies;

  beforeEach(() => {
    service = new AggsService();
    setupDeps = {
      registerFunction: expressionsPluginMock.createSetupContract().registerFunction,
    };
    startDeps = {
      fieldFormats: createFieldFormatsStartMock(),
      uiSettings,
    };
  });

  describe('setup()', () => {
    test('exposes proper contract', () => {
      const setup = service.setup(setupDeps);
      expect(Object.keys(setup).length).toBe(1);
      expect(setup).toHaveProperty('types');
    });
  });

  describe('start()', () => {
    test('exposes proper contract', async () => {
      // need to call `setup` first so registerFunction is available
      service.setup(setupDeps);
      const start = service.start(startDeps);
      expect(Object.keys(start).length).toBe(1);
      expect(start).toHaveProperty('asScopedToClient');
      const contract = await start.asScopedToClient(
        savedObjects.getScopedClient({} as KibanaRequest)
      );
      expect(contract).toHaveProperty('calculateAutoTimeExpression');
      expect(contract).toHaveProperty('createAggConfigs');
      expect(contract).toHaveProperty('types');
    });

    test('registers default agg types', async () => {
      // need to call `setup` first so registerFunction is available
      service.setup(setupDeps);
      const start = await service
        .start(startDeps)
        .asScopedToClient(savedObjects.getScopedClient({} as KibanaRequest));

      expect(start.types.getBuckets().length).toBe(11);
      expect(start.types.getMetrics().length).toBe(21);
    });

    test('merges default agg types with types registered during setup', async () => {
      const setup = service.setup(setupDeps);
      setup.types.registerBucket({ name: 'foo', type: 'bucket' } as BucketAggType<any>);
      setup.types.registerMetric({ name: 'bar', type: 'metric' } as MetricAggType<any>);

      const start = await service
        .start(startDeps)
        .asScopedToClient(savedObjects.getScopedClient({} as KibanaRequest));

      expect(start.types.getBuckets().length).toBe(12);
      expect(start.types.getBuckets().some(({ name }) => name === 'foo')).toBe(true);
      expect(start.types.getMetrics().length).toBe(22);
      expect(start.types.getMetrics().some(({ name }) => name === 'bar')).toBe(true);
    });
  });
});
