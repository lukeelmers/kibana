/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useState } from 'react';
import { EuiFlexGroup, EuiFlexItem } from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import type { InvestigationSummary } from '@kbn/agentic-investigations-plugin/common';
import type { AppNodeProps, KibanaUiRenderer } from '@kbn/custom-app-registry';
import type { InvestigationListNode, InvestigationRowProps } from '../../../common/isomer';
import { InvestigationCardActions } from '../../components/entities/investigation/investigation_card_actions';
import { InvestigationSection } from '../../components/entities/investigation/investigation_section';
import type { InvestigationSectionId } from '../../data/investigations/use_investigation_sections';

/** A row as the query fills it: the investigation, with the other columns the query kept. */
type Row = InvestigationRowProps & Record<string, unknown>;

const SECTION_IDS: InvestigationSectionId[] = [
  'in-progress',
  'critical',
  'high',
  'medium',
  'low',
  'not-rated',
];

const VIEW_DETAILS_LABEL = i18n.translate('xpack.nightshift.isomer.investigationList.viewDetails', {
  defaultMessage: 'View details',
});

/** As on the Nightshift page: running investigations first, the rest by severity. */
const getSectionId = (row: Row): InvestigationSectionId =>
  row.in_progress ? 'in-progress' : row.severity ?? 'not-rated';

const toInvestigation = (row: Row): InvestigationSummary => ({
  id: String(row.id ?? row.title),
  title: row.title,
  title_pending: false,
  created_at: row.created_at,
  updated_at: row.created_at,
  agent_id: String(row.agent_id ?? ''),
  in_progress: row.in_progress,
  metadata: {
    status: row.status === 'closed' ? 'closed' : 'open',
    severity: row.severity,
    summary: row.summary,
  },
  subjects: [],
  impact: row.entities && {
    entities: row.entities.map((name) => ({ id: name, name })),
    created_at: row.created_at,
  },
});

/**
 * The investigations in the Nightshift page's sections, each card a button when there is a click.
 * A query with no rows never gets here: the app says there are no results.
 */
const InvestigationSections = ({
  rows,
  onRowClick,
}: {
  rows: readonly Row[];
  onRowClick?: (row: Row) => void;
}) => {
  const [collapsed, setCollapsed] = useState<InvestigationSectionId[]>([]);
  const sections = SECTION_IDS.map((id) => ({
    id,
    rows: rows.filter((row) => getSectionId(row) === id),
  })).filter((section) => section.rows.length > 0);

  return (
    <EuiFlexGroup direction="column" gutterSize="l" responsive={false}>
      {sections.map((section) => {
        const investigations = section.rows.map(toInvestigation);
        const rowOf = (investigation: InvestigationSummary) =>
          section.rows[investigations.indexOf(investigation)];
        return (
          <EuiFlexItem key={section.id} grow={false}>
            <InvestigationSection
              id={section.id}
              investigations={investigations}
              total={investigations.length}
              hasMore={false}
              onShowMore={() => {}}
              onRetry={() => {}}
              isOpen={!collapsed.includes(section.id)}
              onToggle={(isOpen) =>
                setCollapsed((ids) =>
                  isOpen ? ids.filter((id) => id !== section.id) : [...ids, section.id]
                )
              }
              onInvestigationClick={
                onRowClick && ((investigation) => onRowClick(rowOf(investigation)))
              }
              renderActions={(investigation) => (
                <InvestigationCardActions
                  investigation={investigation}
                  menuItems={
                    onRowClick && [
                      {
                        key: 'viewDetails',
                        icon: 'inspect',
                        label: VIEW_DETAILS_LABEL,
                        onClick: () => onRowClick(rowOf(investigation)),
                      },
                    ]
                  }
                />
              )}
            />
          </EuiFlexItem>
        );
      })}
    </EuiFlexGroup>
  );
};

export const renderInvestigationList: KibanaUiRenderer<InvestigationListNode & AppNodeProps> = (
  { id, rows, onRowClick },
  { dispatch }
) => (
  <div data-node-id={id}>
    <InvestigationSections
      rows={rows}
      onRowClick={onRowClick ? (row) => dispatch(onRowClick, { row }) : undefined}
    />
  </div>
);
