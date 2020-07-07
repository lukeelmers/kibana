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

import { pick } from 'lodash';

import { UiSettingsServiceStart, SavedObjectsClientContract } from 'src/core/server';
import { ExpressionsServiceSetup } from 'src/plugins/expressions/common';
import {
  AggsCommonService,
  AggTypesRegistry,
  aggsRequiredUiSettings,
  calculateBounds,
  getAggTypes,
  TimeRange,
} from '../../../common';
import { FieldFormatsStart } from '../../field_formats';
import { AggsSetup, AggsStart } from './types';

/** @internal */
export interface AggsSetupDependencies {
  registerFunction: ExpressionsServiceSetup['registerFunction'];
}

/** @internal */
export interface AggsStartDependencies {
  fieldFormats: FieldFormatsStart;
  uiSettings: UiSettingsServiceStart;
}

/**
 * The aggs service provides a means of modeling and manipulating the various
 * Elasticsearch aggregations supported by Kibana, providing the ability to
 * output the correct DSL when you are ready to send your request to ES.
 */
export class AggsService {
  private registerFunction?: ExpressionsServiceSetup['registerFunction'];
  /**
   * This is a temporary cache for agg types which are registered by other
   * plugins in `setup`. Its contents are merged with the default agg types
   * and added to the "real" registry which is instantiated when someone calls
   * `data.search.aggs.asScopedToClient`.
   */
  private readonly aggTypesCache = new AggTypesRegistry();

  /**
   * getForceNow uses window.location on the client, so we must have a
   * separate implementation of calculateBounds on the server.
   */
  private calculateBounds = (timeRange: TimeRange) => calculateBounds(timeRange, {});

  public setup({ registerFunction }: AggsSetupDependencies): AggsSetup {
    this.registerFunction = registerFunction;

    return {
      types: this.aggTypesCache.setup(),
    };
  }

  public start({ fieldFormats, uiSettings }: AggsStartDependencies): AggsStart {
    return {
      asScopedToClient: async (savedObjectsClient: SavedObjectsClientContract) => {
        const uiSettingsClient = uiSettings.asScopedToClient(savedObjectsClient);
        const formats = await fieldFormats.fieldFormatServiceFactory(uiSettingsClient);

        // cache ui settings, only including items which are explicitly needed by aggs
        const uiSettingsCache = pick(await uiSettingsClient.getAll(), aggsRequiredUiSettings);
        const getConfig = <T = any>(key: string): T => {
          return uiSettingsCache[key];
        };

        const defaultAggTypes = getAggTypes({
          calculateBounds: this.calculateBounds,
          getConfig,
          getFieldFormatsStart: () => ({
            deserialize: formats.deserialize,
            getDefaultInstance: formats.getDefaultInstance,
          }),
          /**
           * Date histogram and date range need to know whether we are using the
           * default timezone, but `isDefault` is not currently offered on the
           * server, so we need to manually check for the default value.
           */
          isDefaultTimezone: () => getConfig('dateFormat:tz') === 'Browser',
        });

        /**
         * Instantiating a new `AggsCommonService` will create a new registry, which
         * is desirable in this case as the scoped ui settings need to be provided
         * to some of the registered default aggs. So we merge the cached agg types
         * from `setup` with the default aggs that use scoped settings, ensuring
         * downstream consumers are receiving everything that has been registered.
         */
        const aggsCommonService = new AggsCommonService();
        const cachedAggTypes = this.aggTypesCache.start().getAll();

        // call setup to ensure all default agg types & functions are registered
        aggsCommonService.setup({
          aggTypes: {
            buckets: defaultAggTypes.buckets.concat(cachedAggTypes.buckets),
            metrics: defaultAggTypes.metrics.concat(cachedAggTypes.metrics),
          },
          registerFunction: this.registerFunction!,
        });

        return aggsCommonService.start({ getConfig });
      },
    };
  }

  public stop() {}
}
