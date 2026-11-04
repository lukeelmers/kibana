/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import {
  EuiBadge,
  EuiFlexGroup,
  EuiFlexItem,
  EuiIcon,
  EuiTextBlockTruncate,
  EuiToolTip,
} from '@elastic/eui';
import { css } from '@emotion/react';
import { i18n } from '@kbn/i18n';
import { FormattedDate, FormattedRelative } from '@kbn/i18n-react';
import { selectUnit } from '@formatjs/intl-utils';
import type { ValueFormat } from '@kbn/custom-app-common';
import { formatValue } from './format_value';

/** How often a relative time is said again. */
const UPDATE_INTERVAL_SECONDS = 60;

/** react-intl throws rather than schedule an update once the unit passes an hour. */
const INCREMENTABLE_UNITS: ReadonlyArray<ReturnType<typeof selectUnit>['unit']> = [
  'second',
  'minute',
  'hour',
];

const toDate = (value: unknown): Date | undefined => {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

/** How long ago a time was, which says itself again as time goes by, with the time as a tooltip. */
const RelativeTime = ({ value }: { value: unknown }) => {
  const date = toDate(value);
  if (!date) return <>{formatValue(value)}</>;
  const { unit } = selectUnit(date);
  return (
    <EuiToolTip content={<FormattedDate value={date} dateStyle="full" timeStyle="long" />}>
      <span tabIndex={0} data-test-subj="customAppRelativeTime">
        <FormattedRelative
          value={date}
          updateIntervalInSeconds={
            INCREMENTABLE_UNITS.includes(unit) ? UPDATE_INTERVAL_SECONDS : undefined
          }
        />
      </span>
    </EuiToolTip>
  );
};

const Chips = ({
  value,
  format,
}: {
  value: unknown;
  format: Extract<ValueFormat, { type: 'chips' }>;
}) => {
  const items = (
    Array.isArray(value) ? value.map(String) : formatValue(value).split(format.separator)
  )
    .map((item) => item.trim())
    .filter(Boolean);
  if (items.length === 0) return null;
  const shown = format.max === undefined ? items : items.slice(0, format.max);
  const overflow = items.length - shown.length;
  const dot =
    format.dot === undefined
      ? undefined
      : () => <EuiIcon type="dot" color={format.dot} size="s" aria-hidden />;

  return (
    <EuiFlexGroup gutterSize="xs" alignItems="center" responsive={false} wrap>
      {shown.map((item, index) => (
        <EuiFlexItem key={index} grow={false} css={css({ display: 'flex', alignItems: 'center' })}>
          <EuiBadge color={format.color} iconType={dot} data-test-subj="customAppChip">
            {item}
          </EuiBadge>
        </EuiFlexItem>
      ))}
      {overflow > 0 && (
        <EuiFlexItem grow={false} css={css({ display: 'flex', alignItems: 'center' })}>
          <EuiBadge color={format.color} data-test-subj="customAppChipOverflow">
            {i18n.translate('xpack.customApp.formattedValue.moreChips', {
              defaultMessage: '+{count}',
              values: { count: overflow },
            })}
          </EuiBadge>
        </EuiFlexItem>
      )}
    </EuiFlexGroup>
  );
};

/** A value, shown as its format says. */
export const FormattedValue = ({ value, format }: { value: unknown; format: ValueFormat }) => {
  switch (format.type) {
    case 'relative_time':
      return <RelativeTime value={value} />;
    case 'truncate': {
      const text = formatValue(value);
      return (
        <EuiTextBlockTruncate lines={format.lines} cloneElement>
          <div title={text} data-test-subj="customAppTruncated">
            {text}
          </div>
        </EuiTextBlockTruncate>
      );
    }
    case 'badge': {
      const text = formatValue(value);
      if (text === '') return null;
      return (
        <EuiBadge
          color={format.colorMap[text] ?? format.color}
          data-test-subj="customAppValueBadge"
        >
          {text}
        </EuiBadge>
      );
    }
    case 'chips':
      return <Chips value={value} format={format} />;
  }
};

/** Whether a value in this format takes only the room it needs, in a row, as a badge does. */
export const isCompactFormat = (format: ValueFormat | undefined): boolean =>
  format?.type === 'relative_time' || format?.type === 'badge' || format?.type === 'chips';
