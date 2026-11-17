/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { i18n } from '@kbn/i18n';
import type { AppDocument } from '@kbn/custom-app-common';

// Temporary demo data that needs no index, so a new panel works on any cluster. Replaced by
// templates once the start flow exists.
const SERVICES = `ROW data = ["checkout:12", "cart:3", "search:27", "payments:5"]
| MV_EXPAND data
| DISSECT data "%{service}:%{errors}"
| EVAL errors = TO_INTEGER(errors)`;

export const SERVICES_QUERY = `${SERVICES}
| WHERE CONTAINS(service, ?nameFilter) AND errors >= TO_INTEGER(?minErrors)
| KEEP service, errors
| SORT errors DESC`;

export const SERVICE_DETAIL_QUERY = `${SERVICES}
| WHERE service == ?service
| EVAL owner = CONCAT(service, "-team")
| KEEP service, errors, owner`;

/** What the numbers of the example are, which need no index. */
export const SERVICES_COUNT_QUERY = 'ROW now = 4, before = 3';
export const ERRORS_COUNT_QUERY = 'ROW now = 47, before = 52';
export const ERROR_BUDGET_QUERY = 'ROW used = 62';

const t = (id: string, defaultMessage: string) =>
  i18n.translate(`xpack.customApp.defaultDocument.${id}`, { defaultMessage });

/** A new app: nothing in it yet, so that it is shown an empty state and not an example. */
export const createEmptyDocument = (): AppDocument => ({
  state: {},
  root: { type: 'section', id: 'root', title: t('emptyTitle', 'New app'), children: [] },
});

/**
 * An example to start from, which works on any cluster. It is small on purpose, and shows what an
 * app is made of: values that inputs set and components read, and a row click that opens details.
 */
export const createDefaultDocument = (): AppDocument => ({
  state: {
    service: { type: 'string', default: '' },
    nameFilter: { type: 'string', default: '' },
    minErrors: { type: 'string', default: '0' },
  },
  root: {
    type: 'section',
    id: 'root',
    title: t('title', 'Your custom app'),
    children: [
      {
        type: 'markdown',
        id: 'intro',
        text: t(
          'intro',
          'A small working app to change into your own. Ask the assistant to change anything: the data, the components, the look.'
        ),
      },
      {
        type: 'row',
        id: 'kpis',
        children: [
          {
            type: 'stat',
            id: 'stat-services',
            title: t('statServices', 'Services running'),
            query: SERVICES_COUNT_QUERY,
          },
          {
            type: 'stat',
            id: 'stat-errors',
            title: t('statErrors', 'Errors in the last hour'),
            query: ERRORS_COUNT_QUERY,
          },
          {
            type: 'stat',
            id: 'stat-budget',
            title: t('statBudget', 'Error budget used'),
            query: ERROR_BUDGET_QUERY,
          },
        ],
      },
      {
        type: 'section',
        id: 'services',
        title: t('servicesTitle', 'Services'),
        children: [
          {
            type: 'row',
            id: 'filters',
            children: [
              {
                type: 'input',
                id: 'name-filter',
                label: t('nameFilterLabel', 'Service name'),
                placeholder: t('nameFilterPlaceholder', 'Search services'),
                bind: 'nameFilter',
              },
              {
                type: 'select',
                id: 'min-errors',
                label: t('minErrorsLabel', 'Errors'),
                bind: 'minErrors',
                options: [
                  { value: '0', label: t('minErrorsAny', 'Any') },
                  { value: '10', label: t('minErrors10', '10 or more') },
                  { value: '20', label: t('minErrors20', '20 or more') },
                ],
                onChange: [],
              },
            ],
          },
          {
            type: 'table',
            id: 'services-table',
            query: SERVICES_QUERY,
            onRowClick: [
              { type: 'setState', key: 'service', value: { fromColumn: 'service' } },
              { type: 'openFlyout', flyout: 'service-flyout' },
            ],
          },
          {
            type: 'flyout',
            id: 'service-flyout',
            title: i18n.translate('xpack.customApp.defaultDocument.flyoutTitle', {
              defaultMessage: 'Service {service}',
              // The reference is data, not translatable text; i18n would read the braces as a
              // placeholder.
              values: { service: '{{state.service}}' },
            }),
            children: [{ type: 'fields', id: 'service-detail', query: SERVICE_DETAIL_QUERY }],
          },
        ],
      },
      {
        type: 'section',
        id: 'about',
        title: t('aboutTitle', 'What you can do'),
        children: [
          {
            type: 'markdown',
            id: 'about-text',
            text: t(
              'about',
              '- Ask the assistant to **use your own data**, with ES|QL queries.\n- Add stats, tables, sections and more.\n- Let people **pick** a value and have the queries follow it.\n- Run a **workflow** from a button or a form.'
            ),
          },
        ],
      },
    ],
  },
});
