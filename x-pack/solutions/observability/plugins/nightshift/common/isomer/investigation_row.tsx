/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { css, keyframes } from '@emotion/react';
import moment from 'moment';
import React from 'react';
import {
  EuiBadge,
  EuiFlexGroup,
  EuiFlexItem,
  EuiIcon,
  EuiText,
  EuiTextBlockTruncate,
  useEuiTheme,
} from '@elastic/eui';
import {
  definePrimitive,
  nodeAnchor,
  type PrimitiveNode,
  requiredString,
  z,
} from '@elastic/isomer-sdk';
import { md } from '@elastic/isomer-sdk/markdown';
import { i18n } from '@kbn/i18n';
import { getSeverityLabel } from '@kbn/significant-events-schema';
import { SEVERITY_DOT_COLOR } from '../severity';
import { severitySchema } from './severity_tile';

const MAX_VISIBLE_ENTITIES = 3;
const DOT_DELAYS_MS = [0, 150, 300] as const;

const IN_PROGRESS_LABEL = i18n.translate('xpack.nightshift.isomer.investigationRow.inProgress', {
  defaultMessage: 'Investigating',
});

const moreEntitiesLabel = (count: number): string =>
  i18n.translate('xpack.nightshift.isomer.investigationRow.moreEntities', {
    defaultMessage: '+{count}',
    values: { count },
  });

export const investigationRowPropsSchema = z.object({
  title: requiredString().max(200).describe('The investigation title, in plain text.'),
  summary: z.string().max(500).optional().describe('A one-line summary of what was found.'),
  created_at: z.iso.datetime().describe('When the investigation started, as an ISO timestamp.'),
  in_progress: z.boolean().describe('Whether the investigation is still running.'),
  severity: severitySchema.optional().describe('The severity, once the investigation rates it.'),
  entities: z
    .array(requiredString().max(100))
    .optional()
    .describe('The impacted entities, such as services. The first 3 show.'),
});

export type InvestigationRowProps = z.infer<typeof investigationRowPropsSchema>;

const schema = investigationRowPropsSchema.extend({ type: z.literal('investigation_row') });

export type InvestigationRowNode = z.infer<typeof schema> & PrimitiveNode;

const typingDotPulse = keyframes`
  0%, 80%, 100% {
    opacity: 0.25;
    transform: translateY(0);
  }

  40% {
    opacity: 1;
    transform: translateY(-1px);
  }
`;

const InvestigatingIndicator = () => {
  const { euiTheme } = useEuiTheme();
  const fill = `linear-gradient(135deg, ${euiTheme.colors.textPrimary} 2.98%, ${euiTheme.colors.textAssistance} 66.24%)`;

  return (
    <EuiFlexGroup alignItems="center" gutterSize="xs" responsive={false}>
      <EuiText size="xs" color={euiTheme.colors.textPrimary} component="span">
        {IN_PROGRESS_LABEL}
      </EuiText>
      <span
        aria-hidden
        css={css`
          display: inline-flex;
          gap: 2px;

          @media (prefers-reduced-motion: reduce) {
            span {
              animation: none;
              opacity: 0.7;
            }
          }
        `}
      >
        {DOT_DELAYS_MS.map((delayMs) => (
          <span
            key={delayMs}
            css={css`
              width: 3px;
              height: 3px;
              border-radius: 50%;
              background: ${fill};
              animation: ${typingDotPulse} 1.2s ${euiTheme.animation.resistance} infinite;
              animation-delay: ${delayMs}ms;
            `}
          />
        ))}
      </span>
    </EuiFlexGroup>
  );
};

const EntityChips = ({ entities }: { entities: readonly string[] }) => {
  const overflow = entities.length - MAX_VISIBLE_ENTITIES;

  return (
    <EuiFlexGroup gutterSize="xs" alignItems="center" responsive={false} wrap>
      {entities.slice(0, MAX_VISIBLE_ENTITIES).map((entity) => (
        <EuiFlexItem key={entity} grow={false}>
          <EuiBadge
            color="hollow"
            iconType={() => <EuiIcon type="dot" color="danger" size="s" aria-hidden />}
          >
            {entity}
          </EuiBadge>
        </EuiFlexItem>
      ))}
      {overflow > 0 && (
        <EuiFlexItem grow={false}>
          <EuiBadge color="hollow">{moreEntitiesLabel(overflow)}</EuiBadge>
        </EuiFlexItem>
      )}
    </EuiFlexGroup>
  );
};

/** A compact investigation row: age and status, title, a one-line summary, and entity chips. */
export const InvestigationRow = ({
  title,
  summary,
  created_at: createdAt,
  in_progress: inProgress,
  severity,
  entities = [],
  anchorProps,
}: InvestigationRowProps & { anchorProps?: Readonly<Record<string, string>> }) => {
  const { euiTheme } = useEuiTheme();

  return (
    <div
      {...anchorProps}
      data-test-subj="nightshiftInvestigationRow"
      css={css`
        padding: ${euiTheme.size.m} ${euiTheme.size.base};
        background: ${euiTheme.colors.backgroundBasePlain};
      `}
    >
      <EuiFlexGroup gutterSize="xs" direction="column" responsive={false}>
        <EuiFlexItem grow={false}>
          <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
            {severity && (
              <EuiFlexItem grow={false}>
                <EuiBadge color={SEVERITY_DOT_COLOR[severity]}>
                  {getSeverityLabel(severity)}
                </EuiBadge>
              </EuiFlexItem>
            )}
            <EuiFlexItem grow={false}>
              <EuiText size="xs" color="subdued" component="span">
                {moment(createdAt).fromNow()}
              </EuiText>
            </EuiFlexItem>
            {inProgress && (
              <EuiFlexItem grow={false}>
                <InvestigatingIndicator />
              </EuiFlexItem>
            )}
          </EuiFlexGroup>
        </EuiFlexItem>
        <EuiFlexItem grow={false} css={{ minWidth: 0 }}>
          <EuiText size="s">
            <p
              className="eui-textTruncate"
              title={title}
              css={css`
                margin: 0;
                font-weight: ${euiTheme.font.weight.semiBold};
              `}
            >
              {title}
            </p>
          </EuiText>
        </EuiFlexItem>
        {summary && (
          <EuiFlexItem grow={false}>
            <EuiText size="xs" color="subdued">
              <EuiTextBlockTruncate lines={1} cloneElement>
                <p
                  css={css`
                    margin: 0;
                  `}
                >
                  {summary}
                </p>
              </EuiTextBlockTruncate>
            </EuiText>
          </EuiFlexItem>
        )}
        {entities.length > 0 && (
          <EuiFlexItem grow={false}>
            <EntityChips entities={entities} />
          </EuiFlexItem>
        )}
      </EuiFlexGroup>
    </div>
  );
};

// Text and markdown outlive the render, so they carry a fixed UTC time rather than a relative one.
const rowDetails = ({ severity, created_at: createdAt }: InvestigationRowProps): string =>
  [severity && getSeverityLabel(severity), moment.utc(createdAt).format('MMM D, HH:mm [UTC]')]
    .filter(Boolean)
    .join(', ');

export const investigationRowText = (row: InvestigationRowProps): string =>
  `${row.title} (${rowDetails(row)})`;

export const investigationRowMarkdown = (row: InvestigationRowProps) =>
  md.paragraph(md.strong(row.title), ` (${rowDetails(row)})`);

const example: InvestigationRowNode = {
  type: 'investigation_row',
  title: 'Checkout latency doubled on web-prod',
  summary: 'A cache change at 14:00 sent most reads to the database.',
  created_at: '2026-11-17T14:05:00.000Z',
  in_progress: false,
  severity: 'high',
  entities: ['checkout', 'payments', 'web-prod', 'redis'],
};

const examples: InvestigationRowNode[] = [
  example,
  {
    type: 'investigation_row',
    title: 'Error spike in the search service',
    created_at: '2026-11-17T15:30:00.000Z',
    in_progress: true,
  },
];

export const investigationRow = definePrimitive({
  type: 'investigation_row',
  schema,
  catalog: {
    type: 'investigation_row',
    purpose: 'One Nightshift investigation: its age, status, title, summary and impacted entities.',
    useWhen: ['A single investigation is the subject of the message.'],
    avoidWhen: ['There are several investigations. Use `investigation_list`.'],
    example,
  },
  examples,
  renderers: {
    react: (node, { context }) => (
      <InvestigationRow {...node} anchorProps={nodeAnchor(context, node)} />
    ),
    text: (node) => investigationRowText(node),
    markdown: (node) => investigationRowMarkdown(node),
  },
});
