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

import { Subscription } from 'rxjs';

import { IUiSettingsClient } from 'src/core/public';
import { ExpressionsServiceSetup } from 'src/plugins/expressions/common';
import {
  aggsRequiredUiSettings,
  AggsCommonStartDependencies,
  AggsCommonService,
  calculateBounds,
  FieldFormatsStartCommon,
  getAggTypes,
  TimeRange,
} from '../../../common';
import { getForceNow } from '../../query/timefilter/lib/get_force_now';
import { AggsSetup, AggsStart } from './types';

/**
 * Aggs needs synchronous access to specific uiSettings. Since settings can change
 * without a page refresh, we create a cache that subscribes to changes from
 * uiSettings.get$ and keeps everything up-to-date.
 *
 * @internal
 */
export function createGetConfig(
  uiSettings: IUiSettingsClient,
  requiredSettings: string[],
  subscriptions: Subscription[]
): AggsCommonStartDependencies['getConfig'] {
  const settingsCache: Record<string, any> = {};

  requiredSettings.forEach((setting) => {
    subscriptions.push(
      uiSettings.get$(setting).subscribe((value) => {
        settingsCache[setting] = value;
      })
    );
  });

  return (key) => settingsCache[key];
}

/** @internal */
export interface AggsSetupDependencies {
  getFieldFormatsStart: () => Pick<FieldFormatsStartCommon, 'deserialize' | 'getDefaultInstance'>;
  registerFunction: ExpressionsServiceSetup['registerFunction'];
  uiSettings: IUiSettingsClient;
}

/** @internal */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface AggsStartDependencies {}

/**
 * The aggs service provides a means of modeling and manipulating the various
 * Elasticsearch aggregations supported by Kibana, providing the ability to
 * output the correct DSL when you are ready to send your request to ES.
 */
export class AggsService {
  private readonly aggsCommonService = new AggsCommonService();
  private getConfig?: AggsCommonStartDependencies['getConfig'];
  private subscriptions: Subscription[] = [];

  /**
   * getForceNow uses window.location, so we must have a separate implementation
   * of calculateBounds on the client and the server.
   */
  private calculateBounds = (timeRange: TimeRange) =>
    calculateBounds(timeRange, { forceNow: getForceNow() });

  public setup({
    getFieldFormatsStart,
    registerFunction,
    uiSettings,
  }: AggsSetupDependencies): AggsSetup {
    this.getConfig = createGetConfig(uiSettings, aggsRequiredUiSettings, this.subscriptions);

    const aggTypes = getAggTypes({
      calculateBounds: this.calculateBounds,
      getConfig: this.getConfig!,
      getFieldFormatsStart,
      isDefaultTimezone: () => uiSettings.isDefault('dateFormat:tz'),
    });

    return this.aggsCommonService.setup({ aggTypes, registerFunction });
  }

  public start({}: AggsStartDependencies = {}): AggsStart {
    return this.aggsCommonService.start({ getConfig: this.getConfig! });
  }

  public stop() {
    this.subscriptions.forEach((s) => s.unsubscribe());
    this.subscriptions = [];
  }
}
