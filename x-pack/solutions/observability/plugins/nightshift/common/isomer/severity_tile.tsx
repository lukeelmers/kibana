/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { css, type SerializedStyles } from '@emotion/react';
import React, { useMemo } from 'react';
import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiIcon,
  EuiPanel,
  type EuiPanelProps,
  EuiSkeletonTitle,
  EuiText,
  EuiTitle,
  euiShadowHover,
  type UseEuiTheme,
  useEuiTheme,
} from '@elastic/eui';
import { definePrimitive, nodeAnchor, type PrimitiveNode, z } from '@elastic/isomer-sdk';
import { md } from '@elastic/isomer-sdk/markdown';
import type { getEbtProps } from '@kbn/ebt-click';
import { i18n } from '@kbn/i18n';
import type { Severity } from '@kbn/nightshift-investigations-plugin/common';
import { getSeverityLabel, SEVERITY_OPTIONS } from '@kbn/significant-events-schema';
import { SEVERITY_TILE_ICON, SEVERITY_TILE_ICON_COLORS } from '../severity';

/** A muted tier has no section to scroll to, so its tile reads as a figure rather than a control. */
type SeverityTileState = 'muted' | 'interactive';

interface SeverityTileStateStyles {
  /** `EuiPanel`'s `color` prop when a state needs a filled panel; omit for border-only. */
  panelColor?: EuiPanelProps['color'];
  panel?: SerializedStyles;
  count?: SerializedStyles;
}

interface SeverityIconBoxStyles {
  muted: SerializedStyles;
  interactive: SerializedStyles;
}

/** Every visual difference between a muted and an interactive tile, in one place. */
const getSeverityTileStyles = (
  euiThemeContext: UseEuiTheme
): {
  iconBox: Readonly<Record<Severity, SeverityIconBoxStyles>>;
  iconGlyphRotateUp: SerializedStyles;
  label: SerializedStyles;
  count: SerializedStyles;
  byState: Readonly<Record<SeverityTileState, SeverityTileStateStyles>>;
} => {
  const { euiTheme } = euiThemeContext;
  const iconBoxBase = css`
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: ${euiTheme.size.xxl};
    height: ${euiTheme.size.xxl};
    border-radius: ${euiTheme.border.radius.control};
  `;

  const iconBox = Object.fromEntries(
    SEVERITY_OPTIONS.map((severity) => {
      const tokens = SEVERITY_TILE_ICON_COLORS[severity];
      return [
        severity,
        {
          muted: css`
            ${iconBoxBase}
            background: ${euiTheme.colors.backgroundBaseDisabled};
            color: ${euiTheme.colors.textDisabled};
          `,
          interactive: css`
            ${iconBoxBase}
            background: ${euiTheme.colors[tokens.background]};
            color: ${euiTheme.colors[tokens.color]};
          `,
        },
      ];
    })
  ) as Record<Severity, SeverityIconBoxStyles>;

  return {
    iconBox,
    iconGlyphRotateUp: css`
      transform: rotate(-90deg);
    `,
    // Match EuiButtonEmpty: medium weight (EuiText has no weight prop).
    label: css`
      font-weight: ${euiTheme.font.weight.medium};
    `,
    // Same stack/weight as Lens metric values (`echMetricText__value` + Elastic UI Numeric).
    count: css`
      font-family: 'Elastic UI Numeric', ${euiTheme.font.family};
      font-weight: ${euiTheme.font.weight.medium};
    `,
    byState: {
      // Empty tiles: border only, no panel fill; count/icon stay muted.
      muted: {
        panelColor: 'transparent',
        count: css`
          color: ${euiTheme.colors.textDisabled};
        `,
      },
      // Clickable EuiPanel defaults to hover shadow `m`; use `xs` for a lighter lift.
      interactive: {
        panel: css`
          &&:hover,
          &&:focus,
          &&:focus-visible {
            ${euiShadowHover(euiThemeContext, 'xs')}
          }
        `,
      },
    },
  };
};

export interface SeverityTileProps extends Partial<ReturnType<typeof getEbtProps>> {
  severity: Severity;
  count: number;
  isMuted?: boolean;
  isLoading?: boolean;
  onClick?: () => void;
  anchorProps?: Readonly<Record<string, string>>;
}

export const SeverityTile = ({
  severity,
  count,
  isMuted = false,
  isLoading = false,
  onClick,
  anchorProps,
  ...ebtProps
}: SeverityTileProps): React.ReactElement => {
  const euiThemeContext = useEuiTheme();
  const styles = useMemo(() => getSeverityTileStyles(euiThemeContext), [euiThemeContext]);
  const stateStyles = styles.byState[isMuted ? 'muted' : 'interactive'];
  const icon = SEVERITY_TILE_ICON[severity];

  return (
    <EuiPanel
      hasBorder
      hasShadow={false}
      paddingSize="m"
      color={stateStyles.panelColor}
      css={stateStyles.panel}
      data-test-subj={`nightshiftSeverityTile-${severity}`}
      onClick={onClick}
      {...ebtProps}
      {...anchorProps}
    >
      <EuiFlexGroup direction="column" gutterSize="s" responsive={false}>
        <EuiFlexItem grow={false}>
          <EuiText color="default" size="xs" css={styles.label}>
            {getSeverityLabel(severity)}
          </EuiText>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
            <EuiFlexItem grow={false}>
              <span
                css={styles.iconBox[severity][isMuted ? 'muted' : 'interactive']}
                aria-hidden={true}
              >
                <EuiIcon
                  type={icon.type}
                  size="m"
                  css={icon.rotateUp ? styles.iconGlyphRotateUp : undefined}
                  aria-hidden={true}
                />
              </span>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiSkeletonTitle
                size="l"
                isLoading={isLoading}
                contentAriaLabel={i18n.translate(
                  'xpack.nightshift.investigations.severityTileCountAriaLabel',
                  {
                    defaultMessage: '{severityLabel} investigation count',
                    values: { severityLabel: getSeverityLabel(severity) },
                  }
                )}
              >
                <EuiTitle size="l" css={[styles.count, stateStyles.count]}>
                  <span data-test-subj={`nightshiftSeverityTileCount-${severity}`}>{count}</span>
                </EuiTitle>
              </EuiSkeletonTitle>
            </EuiFlexItem>
          </EuiFlexGroup>
        </EuiFlexItem>
      </EuiFlexGroup>
    </EuiPanel>
  );
};

export const severitySchema = z.enum(SEVERITY_OPTIONS);

const schema = z.object({
  type: z.literal('severity_tile'),
  severity: severitySchema.describe('The severity tier, from critical to low.'),
  count: z.number().int().min(0).describe('How many investigations have this severity.'),
});

export type SeverityTileNode = z.infer<typeof schema> & PrimitiveNode;

const example: SeverityTileNode = { type: 'severity_tile', severity: 'critical', count: 3 };

const examples: SeverityTileNode[] = [
  example,
  { type: 'severity_tile', severity: 'medium', count: 12 },
  { type: 'severity_tile', severity: 'low', count: 0 },
];

export const severityTile = definePrimitive({
  type: 'severity_tile',
  schema,
  catalog: {
    type: 'severity_tile',
    purpose: 'The number of investigations at one severity tier, as a tile.',
    useWhen: ['An overview shows how many investigations each severity has.'],
    avoidWhen: ['The reader needs the investigations themselves. Use `investigation_list`.'],
    example,
  },
  examples,
  renderers: {
    react: (node, { context }) => (
      <SeverityTile
        severity={node.severity}
        count={node.count}
        isMuted={node.count === 0}
        anchorProps={nodeAnchor(context, node)}
      />
    ),
    text: ({ severity, count }) => `${getSeverityLabel(severity)}: ${count}`,
    markdown: ({ severity, count }) =>
      md.paragraph(md.strong(getSeverityLabel(severity)), `: ${count}`),
  },
});
