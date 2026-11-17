/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useEffect, useState } from 'react';
import { EuiFieldSearch } from '@elastic/eui';
import { useDebouncedValue } from '@kbn/react-hooks';
import type { AppNodeProps, KibanaUiRenderer } from '@kbn/custom-app-registry';
import { type InvestigationSearchNode, SEARCH_PLACEHOLDER } from '../../../common/isomer';

/** As on the Nightshift page, the value is set once typing pauses, so the queries run once. */
const SEARCH_DEBOUNCE_MS = 300;

const InvestigationSearch = ({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) => {
  const [text, setText] = useState(value);
  const debouncedText = useDebouncedValue(text, SEARCH_DEBOUNCE_MS);

  useEffect(() => {
    if (debouncedText !== value) onChange(debouncedText);
  }, [debouncedText, value, onChange]);

  return (
    <EuiFieldSearch
      data-test-subj="nightshiftInvestigationSearchFieldSearch"
      placeholder={placeholder ?? SEARCH_PLACEHOLDER}
      value={text}
      onChange={(event) => setText(event.target.value)}
      isClearable
      fullWidth
      compressed
    />
  );
};

export const renderInvestigationSearch: KibanaUiRenderer<InvestigationSearchNode & AppNodeProps> = (
  { id, bind, placeholder },
  { state, setState }
) => (
  <div data-node-id={id}>
    <InvestigationSearch
      value={bind ? String(state[bind] ?? '') : ''}
      placeholder={placeholder}
      onChange={(value) => bind && setState(bind, value)}
    />
  </div>
);
