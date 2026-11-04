/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { EuiIcon, useEuiTheme } from '@elastic/eui';
import { css } from '@emotion/react';

type IconSize = 'm' | 'l' | 'xl';

const isDataUri = (icon: string): boolean => icon.startsWith('data:');

/**
 * An icon of an app: one EUI draws, by its name, or a mark of the app's own, an SVG data URI. The
 * mark is a mask filled with the colour of the text around it, as an icon of EUI is, so it follows
 * the theme and is never an image that does anything.
 */
export const AppIcon = ({ icon, size = 'm' }: { icon: string; size?: IconSize }) => {
  const { euiTheme } = useEuiTheme();
  if (!isDataUri(icon)) return <EuiIcon type={icon} size={size} aria-hidden={true} />;

  const side = { m: euiTheme.size.base, l: euiTheme.size.l, xl: euiTheme.size.xl }[size];
  const url = `url("${icon.replace(/"/g, '%22')}")`;
  return (
    <span
      aria-hidden={true}
      data-test-subj="customAppIconMark"
      css={css({
        display: 'inline-block',
        flexShrink: 0,
        width: side,
        height: side,
        backgroundColor: 'currentColor',
        maskImage: url,
        maskRepeat: 'no-repeat',
        maskPosition: 'center',
        maskSize: 'contain',
        WebkitMaskImage: url,
        WebkitMaskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        WebkitMaskSize: 'contain',
      })}
    />
  );
};
