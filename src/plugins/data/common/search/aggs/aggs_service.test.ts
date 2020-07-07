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

import {
  AggsCommonService,
  AggsCommonSetupDependencies,
  AggsCommonStartDependencies,
} from './aggs_service';
import { getAggTypes } from './agg_types';
import { BucketAggType } from './buckets/bucket_agg_type';
import { MetricAggType } from './metrics/metric_agg_type';

describe('Aggs service', () => {
  let service: AggsCommonService;
  let setupDeps: AggsCommonSetupDependencies;
  let startDeps: AggsCommonStartDependencies;

  beforeEach(() => {
    service = new AggsCommonService();
    setupDeps = {
      aggTypes: {
        buckets: [
          { name: 'date_histogram', type: 'bucket' },
          { name: 'range', type: 'bucket' },
          { name: 'terms', type: 'bucket' },
        ] as Array<BucketAggType<any>>,
        metrics: [
          { name: 'avg', type: 'metric' },
          { name: 'count', type: 'metric' },
        ] as Array<MetricAggType<any>>,
      },
      registerFunction: jest.fn(),
    };
    startDeps = {
      getConfig: jest.fn(),
    };
  });

  describe('constructor()', () => {
    test('instantiates a new registry', () => {
      const a = new AggsCommonService();
      const b = new AggsCommonService();
      const bSetupDeps = {
        aggTypes: {
          buckets: [{ name: 'ip_range', type: 'bucket' }] as Array<BucketAggType<any>>,
          metrics: [{ name: 'percentiles', type: 'metric' }] as Array<MetricAggType<any>>,
        },
        registerFunction: jest.fn(),
      };

      a.setup(setupDeps);
      const aStart = a.start(startDeps);
      expect(aStart.types.getAll()).toMatchInlineSnapshot(`
        Object {
          "buckets": Array [
            Object {
              "name": "date_histogram",
              "type": "bucket",
            },
            Object {
              "name": "range",
              "type": "bucket",
            },
            Object {
              "name": "terms",
              "type": "bucket",
            },
          ],
          "metrics": Array [
            Object {
              "name": "avg",
              "type": "metric",
            },
            Object {
              "name": "count",
              "type": "metric",
            },
          ],
        }
      `);

      b.setup(bSetupDeps);
      const bStart = b.start(startDeps);
      expect(bStart.types.getAll()).toMatchInlineSnapshot(`
        Object {
          "buckets": Array [
            Object {
              "name": "ip_range",
              "type": "bucket",
            },
          ],
          "metrics": Array [
            Object {
              "name": "percentiles",
              "type": "metric",
            },
          ],
        }
      `);
    });
  });

  describe('setup()', () => {
    test('exposes proper contract', () => {
      const setup = service.setup(setupDeps);
      expect(Object.keys(setup).length).toBe(1);
      expect(setup).toHaveProperty('types');
    });

    test('registers all agg types', () => {
      service.setup(setupDeps);
      const start = service.start(startDeps);
      expect(start.types.getAll().buckets.map((b) => b.name)).toEqual(
        setupDeps.aggTypes.buckets.map((b) => b.name)
      );
      expect(start.types.getAll().metrics.map((m) => m.name)).toEqual(
        setupDeps.aggTypes.metrics.map((m) => m.name)
      );
    });

    test('registers all agg type expression functions', () => {
      service.setup(setupDeps);
      const aggTypes = getAggTypes({
        calculateBounds: jest.fn(),
        getConfig: jest.fn(),
        getFieldFormatsStart: jest.fn(),
        isDefaultTimezone: jest.fn(),
      });
      expect(setupDeps.registerFunction).toHaveBeenCalledTimes(
        aggTypes.buckets.length + aggTypes.metrics.length
      );
    });
  });

  describe('start()', () => {
    test('exposes proper contract', () => {
      const start = service.start(startDeps);
      expect(Object.keys(start).length).toBe(3);
      expect(start).toHaveProperty('calculateAutoTimeExpression');
      expect(start).toHaveProperty('createAggConfigs');
      expect(start).toHaveProperty('types');
    });
  });
});
