/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import type { EventLoopUtilization } from 'perf_hooks';
import { performance } from 'perf_hooks';

export class EventLoopUtilizationMonitor {
  private elu: EventLoopUtilization;

  constructor() {
    this.elu = performance.eventLoopUtilization();
  }

  public collect(): EventLoopUtilization {
    const { active, idle, utilization } = performance.eventLoopUtilization(this.elu);

    return {
      active,
      idle,
      utilization,
    };
  }

  public reset() {
    this.elu = performance.eventLoopUtilization();
  }
}
