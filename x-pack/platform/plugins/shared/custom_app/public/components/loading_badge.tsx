/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { EuiText, useEuiTheme } from '@elastic/eui';
import { css, keyframes } from '@emotion/react';
import { useAiButtonGradientStyles } from '@kbn/shared-ux-ai-components';

const DOT_DELAYS_MS = [0, 150, 300] as const;
const DOT_SIZE_PX = 3;

const pulse = keyframes`
  0%, 80%, 100% {
    opacity: 0.25;
    transform: translateY(0);
  }

  40% {
    opacity: 1;
    transform: translateY(-1px);
  }
`;

/**
 * Something that is still under way, as the agent's work is shown: a dot that sets it apart from
 * what is before it, the words in the colours of AI, and three dots that pulse in turn. In a tight
 * row it sits close to what it follows, as a status of it.
 */
export const LoadingBadge = ({ nodeId, text }: { nodeId: string; text: string }) => {
  const { euiTheme } = useEuiTheme();
  const { labelCss } = useAiButtonGradientStyles({ variant: 'outlined' });
  const dotsFill = `linear-gradient(135deg, ${euiTheme.colors.textPrimary} 2.98%, ${euiTheme.colors.textAssistance} 66.24%)`;

  return (
    <span
      data-node-id={nodeId}
      data-test-subj="customAppLoadingBadge"
      role="status"
      css={css`
        display: inline-flex;
        align-items: center;
        gap: ${euiTheme.size.xs};
        margin-inline-start: calc(${euiTheme.size.xs} - ${euiTheme.size.s});
      `}
    >
      <EuiText size="xs" color="subdued" component="span" aria-hidden>
        •
      </EuiText>
      <EuiText
        size="xs"
        component="span"
        css={[
          labelCss,
          css`
            padding: 0;
            line-height: 1;
          `,
        ]}
      >
        {text}
      </EuiText>
      <span
        aria-hidden
        css={css`
          display: inline-flex;
          align-items: center;
          gap: 2px;
          flex-shrink: 0;
          line-height: 1;
          padding-block: 1px;

          @media (prefers-reduced-motion: reduce) {
            span {
              animation: none;
              opacity: 0.7;
              transform: none;
            }
          }
        `}
      >
        {DOT_DELAYS_MS.map((delay) => (
          <span
            key={delay}
            css={css`
              width: ${DOT_SIZE_PX}px;
              height: ${DOT_SIZE_PX}px;
              border-radius: 50%;
              background: ${dotsFill};
              animation: ${pulse} 1.2s ${euiTheme.animation.resistance} infinite;
              animation-delay: ${delay}ms;
            `}
          />
        ))}
      </span>
    </span>
  );
};
