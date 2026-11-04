/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { EuiFlexGroup, EuiFlexItem, EuiText, EuiTitle, useEuiTheme } from '@elastic/eui';
import { css } from '@emotion/react';
import type { AppNodeOfType } from '@kbn/custom-app-common';
import { useInterpolate } from '../runtime/use_interpolate';
import { AppIcon } from './app_icon';
import { LinkNode } from './link_node';
import { NodeRenderer } from './node_renderer';

/**
 * The header of a page: its icon in a round mark, a line above the title, the title, and the links
 * and buttons it holds at the end of the row, with the links drawn as quiet buttons.
 */
export const PageHeaderNode = ({ node }: { node: AppNodeOfType<'page_header'> }) => {
  const { euiTheme } = useEuiTheme();
  const text = useInterpolate();
  const markSize = `calc(${euiTheme.size.xxl} + ${euiTheme.size.m})`;

  return (
    <EuiFlexGroup
      alignItems="flexEnd"
      direction="row"
      gutterSize="l"
      justifyContent="spaceBetween"
      responsive={false}
      data-node-id={node.id}
      data-test-subj="customAppPageHeader"
    >
      <EuiFlexItem grow>
        <EuiFlexGroup alignItems="center" direction="row" gutterSize="m" responsive={false}>
          {node.icon !== undefined && (
            <EuiFlexItem grow={false}>
              <div
                role="presentation"
                css={css`
                  align-items: center;
                  background: linear-gradient(
                    99.4deg,
                    ${euiTheme.colors.backgroundLightPrimary} 3.97%,
                    ${euiTheme.colors.backgroundLightAssistance} 65.6%
                  );
                  border-radius: 50%;
                  color: ${euiTheme.colors.textAssistance};
                  display: inline-flex;
                  height: ${markSize};
                  justify-content: center;
                  width: ${markSize};
                `}
              >
                <AppIcon icon={node.icon} size={20} />
              </div>
            </EuiFlexItem>
          )}
          <EuiFlexItem>
            {node.eyebrow !== undefined && (
              <EuiText color="subdued" size="s" textAlign="left">
                <p>{text(node.eyebrow)}</p>
              </EuiText>
            )}
            <EuiTitle
              size="m"
              css={css`
                font-size: calc(${euiTheme.size.l} + ${euiTheme.size.xxs});
                font-weight: ${euiTheme.font.weight.medium};
                line-height: ${euiTheme.size.xl};
                text-align: left;
                white-space: nowrap;
              `}
            >
              <h2>{text(node.title)}</h2>
            </EuiTitle>
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiFlexItem>
      {node.children.length > 0 && (
        <EuiFlexItem grow={false}>
          <EuiFlexGroup gutterSize="s" responsive={false}>
            {node.children.map((child) => (
              <EuiFlexItem key={child.id} grow={false}>
                {child.type === 'link' ? (
                  <LinkNode node={child} appearance="button" />
                ) : (
                  <NodeRenderer node={child} />
                )}
              </EuiFlexItem>
            ))}
          </EuiFlexGroup>
        </EuiFlexItem>
      )}
    </EuiFlexGroup>
  );
};
