/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import numeral from '@elastic/numeral';
import { LogMeta } from '@kbn/logging';
import type { OpsMetrics } from '@kbn/core-metrics-server';

/**
 * Converts ops metrics into ECS-compliant `LogMeta` for logging
 *
 * @internal
 */
export function getEcsOpsMetricsLog(metrics: OpsMetrics) {
  const { process, os } = metrics;
  const processMemoryUsedInBytes = process?.memory?.heap?.used_in_bytes;
  const processMemoryUsedInBytesMsg = processMemoryUsedInBytes
    ? `memory: ${numeral(processMemoryUsedInBytes).format('0.0b')} `
    : '';

  // ECS process.uptime is in seconds:
  const uptimeVal = process?.uptime_in_millis
    ? Math.floor(process.uptime_in_millis / 1000)
    : undefined;

  // HH:mm:ss message format for backward compatibility
  const uptimeValMsg = uptimeVal ? `uptime: ${numeral(uptimeVal).format('00:00:00')} ` : '';

  // Event loop delay metrics are in ms
  const eventLoopDelayVal = process?.event_loop_delay;
  const eventLoopDelayValMsg = eventLoopDelayVal
    ? `mean delay: ${numeral(process?.event_loop_delay).format('0.000')}`
    : '';

  const eventLoopDelayPercentiles = process?.event_loop_delay_histogram?.percentiles;

  // Format message from 50th, 95th and 99th percentiles
  const eventLoopDelayHistMsg = eventLoopDelayPercentiles
    ? ` delay histogram: { 50: ${numeral(eventLoopDelayPercentiles['50']).format(
        '0.000'
      )}; 95: ${numeral(eventLoopDelayPercentiles['95']).format('0.000')}; 99: ${numeral(
        eventLoopDelayPercentiles['99']
      ).format('0.000')} }`
    : '';

  const eventLoopUtilizationVal = process?.event_loop_utilization;
  const eventLoopUtilizationValMsg = eventLoopUtilizationVal
    ? ` utilization: ${JSON.stringify(process?.event_loop_utilization)}`
    : '';

  const loadVals = [...Object.values(os?.load ?? [])];
  const loadValsMsg =
    loadVals.length > 0
      ? `load: [${loadVals.map((val: number) => {
          return numeral(val).format('0.00');
        })}] `
      : '';

  const meta: LogMeta = {
    ...metrics,
  };

  return {
    message: [
      processMemoryUsedInBytesMsg,
      uptimeValMsg,
      loadValsMsg,
      eventLoopDelayValMsg,
      eventLoopDelayHistMsg,
      eventLoopUtilizationValMsg,
    ].join(''),
    meta,
  };
}
