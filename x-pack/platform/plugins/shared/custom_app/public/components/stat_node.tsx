/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useState } from 'react';
import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiPanel,
  EuiStat,
  EuiText,
  EuiTitle,
  euiShadowHover,
  useEuiTheme,
} from '@elastic/eui';
import { css } from '@emotion/react';
import { i18n } from '@kbn/i18n';
import type { AppNodeOfType } from '@kbn/custom-app-common';
import type { SourceData } from '../data/data_layer';
import { useDataLayer } from '../data/data_layer_context';
import { useSource } from '../data/use_source';
import { useInterpolate } from '../runtime/use_interpolate';
import { useActionRunner } from '../workflows/use_action_runner';
import { AppIcon } from './app_icon';
import { DataState } from './data_state';
import { DroppedActions } from './dropped_actions';

type StatNodeType = AppNodeOfType<'stat'>;
type StatColor = NonNullable<StatNodeType['color']>;

const formatValue = (value: unknown): string =>
  typeof value === 'number' ? new Intl.NumberFormat(i18n.getLocale()).format(value) : String(value);

const capitalize = (word: string) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`;

/** The value of a stat, beside its icon on a light fill of its colour, with the title above. */
const IconStatValue = ({ node, value }: { node: StatNodeType; value: unknown }) => {
  const euiThemeContext = useEuiTheme();
  const { euiTheme } = euiThemeContext;
  const text = useInterpolate();
  // Nothing to count is shown quietly, as a figure and not something to look into.
  const isMuted = value === 0;
  const color: StatColor = node.color ?? 'primary';
  const colors = euiTheme.colors as unknown as Record<string, string>;

  return (
    <EuiFlexGroup direction="column" gutterSize="s" responsive={false}>
      <EuiFlexItem grow={false}>
        <EuiText size="xs" css={css({ fontWeight: euiTheme.font.weight.medium })}>
          {text(node.title)}
        </EuiText>
      </EuiFlexItem>
      <EuiFlexItem grow={false}>
        <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
          <EuiFlexItem grow={false}>
            <span
              aria-hidden={true}
              data-test-subj="customAppStatIcon"
              css={css({
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                width: euiTheme.size.xxl,
                height: euiTheme.size.xxl,
                borderRadius: euiTheme.border.radius.control,
                background: isMuted
                  ? euiTheme.colors.backgroundBaseDisabled
                  : colors[`backgroundLight${capitalize(color)}`],
                color: isMuted ? euiTheme.colors.textDisabled : colors[`text${capitalize(color)}`],
              })}
            >
              <AppIcon icon={node.icon as string} />
            </span>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiTitle
              size="l"
              css={css({
                fontFamily: `'Elastic UI Numeric', ${euiTheme.font.family}`,
                fontWeight: euiTheme.font.weight.medium,
                color: isMuted ? euiTheme.colors.textDisabled : undefined,
              })}
            >
              <span data-test-subj="customAppStat">
                {value === null || value === undefined ? '—' : formatValue(value)}
              </span>
            </EuiTitle>
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiFlexItem>
    </EuiFlexGroup>
  );
};

/** A stat shows the first column of the first row. A query that wants another can KEEP it. */
const StatValue = ({ node, data }: { node: StatNodeType; data: SourceData }) => {
  const text = useInterpolate();
  const [value] = data.rows[0];

  if (node.icon !== undefined) return <IconStatValue node={node} value={value} />;

  return (
    <EuiStat
      title={value === null || value === undefined ? '—' : formatValue(value)}
      description={text(node.title)}
      titleSize="l"
      reverse
      data-test-subj="customAppStat"
    />
  );
};

export const StatNode = ({ node }: { node: StatNodeType }) => {
  const euiThemeContext = useEuiTheme();
  const layer = useDataLayer();
  const state = useSource(node.id);
  const run = useActionRunner(node.id);
  const [dropped, setDropped] = useState<string[]>([]);
  const isClickable = node.onClick !== undefined && node.onClick.length > 0;
  const isEmpty =
    state.status === 'success' && (state.data.rows.length === 0 || state.data.rows[0][0] === 0);

  return (
    <>
      <EuiPanel
        hasBorder
        hasShadow={false}
        paddingSize="m"
        // A stat with an icon and nothing to count has no fill: it is a figure, not a control.
        color={node.icon !== undefined && isEmpty ? 'transparent' : undefined}
        data-node-id={node.id}
        onClick={isClickable ? () => setDropped(run(node.onClick ?? [])) : undefined}
        css={
          isClickable
            ? css`
                &&:hover,
                &&:focus,
                &&:focus-visible {
                  ${euiShadowHover(euiThemeContext, 'xs')}
                }
              `
            : undefined
        }
      >
        <DataState state={state} onRetry={layer.retry}>
          {(data) => <StatValue node={node} data={data} />}
        </DataState>
      </EuiPanel>
      <DroppedActions reasons={dropped} onDismiss={() => setDropped([])} />
    </>
  );
};
