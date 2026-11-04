/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { i18n } from '@kbn/i18n';
import type { TextFilter } from '@kbn/custom-app-common';

const toDate = (value: unknown): Date | undefined => {
  const date =
    value instanceof Date
      ? value
      : typeof value === 'string' || typeof value === 'number'
      ? new Date(value)
      : undefined;
  return date && !Number.isNaN(date.getTime()) ? date : undefined;
};

/** What time of day a time is, as a greeting: `{{now | greeting}}` is "Good morning" before noon. */
export const greeting: TextFilter = (value) => {
  const hour = (toDate(value) ?? new Date()).getHours();
  if (hour < 12) {
    return i18n.translate('xpack.customApp.textFilters.morning', {
      defaultMessage: 'Good morning',
    });
  }
  if (hour < 18) {
    return i18n.translate('xpack.customApp.textFilters.afternoon', {
      defaultMessage: 'Good afternoon',
    });
  }
  return i18n.translate('xpack.customApp.textFilters.evening', {
    defaultMessage: 'Good evening',
  });
};

/** What each filter of a reference in text does, in Kibana's UI language. */
export const TEXT_FILTER_IMPLEMENTATIONS: Readonly<Record<string, TextFilter>> = { greeting };
