/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useMemo } from 'react';
import { EuiComboBox, EuiFormRow, EuiSelect } from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import { MAX_QUERY_OPTIONS, getOptionsSourceId } from '@kbn/custom-app-common';
import type { AppNodeProps, KibanaUiEnv, KibanaUiRenderer } from '@kbn/custom-app-registry';
import type { SelectNode as Select } from '../../../common/pack';
import type { SourceState } from '../../data/data_layer';
import { useSource } from '../../data/use_source';

type Node = Select & AppNodeProps & { optionsQuery?: string };

interface Option {
  value: string;
  label?: string;
}

/**
 * The options a query gives: the first column is the value and a second, when there is one, its
 * label. An empty value is skipped, as is one that was written by hand, which keeps its own label,
 * and no more than a person can look through are taken.
 */
export const toQueryOptions = (state: SourceState, written: readonly Option[]): Option[] => {
  if (state.status !== 'success') return [];
  const taken = new Set(written.map(({ value }) => value));
  const options: Option[] = [];

  for (const [value, label] of state.data.rows) {
    if (options.length >= MAX_QUERY_OPTIONS) break;
    if (value === null || value === undefined || value === '') continue;
    const text = String(value);
    if (taken.has(text)) continue;
    taken.add(text);
    options.push({
      value: text,
      ...(label === null || label === undefined || label === '' ? {} : { label: String(label) }),
    });
  }
  return options;
};

/** Sets the value the select is bound to, then runs its handlers with the new value. */
const change = (node: Node, env: KibanaUiEnv, next: string | string[]) =>
  env.dispatch(
    [
      { type: 'setState', key: node.bind ?? '', value: { fromInput: true } },
      ...(node.onChange ?? []),
    ],
    { input: next }
  );

interface SelectProps {
  node: Node;
  env: KibanaUiEnv;
  queried: readonly Option[];
  isLoading?: boolean;
  error?: string;
}

/** A select that takes several options: what is chosen is a list, and nothing chosen is an empty one. */
const MultiSelect = ({ node, env, queried, isLoading = false, error }: SelectProps) => {
  const bound = env.state[node.bind ?? ''];
  const list: readonly string[] = Array.isArray(bound) ? bound : [];
  const options = [...node.options, ...queried].map(({ value, label }) => ({
    key: value,
    value,
    label: label ?? value,
  }));
  // What is chosen and is none of the options, such as before the options have come, is shown as
  // what it is.
  const selected = list.map(
    (value) =>
      options.find((option) => option.value === value) ?? { key: value, value, label: value }
  );

  return (
    <EuiFormRow
      label={node.label}
      data-node-id={node.id}
      isInvalid={error !== undefined}
      error={error}
    >
      <EuiComboBox
        compressed
        isClearable
        isLoading={isLoading}
        isInvalid={error !== undefined}
        aria-label={node.label}
        placeholder={i18n.translate('xpack.customApp.selectNode.multiplePlaceholder', {
          defaultMessage: 'Select one or more',
        })}
        options={options}
        selectedOptions={selected}
        onChange={(chosen) =>
          change(
            node,
            env,
            chosen.map((option) => String(option.value))
          )
        }
      />
    </EuiFormRow>
  );
};

const SingleSelect = ({ node, env, queried, isLoading = false, error }: SelectProps) => {
  const value = String(env.state[node.bind ?? ''] ?? '');
  const known = [...node.options, ...queried];
  // A value that is none of the options, such as one from a link before the options have come, is
  // shown as what it is, and not as the first option, which it is not. An empty one is nothing chosen.
  const options =
    value === '' || known.some((option) => option.value === value) ? known : [...known, { value }];

  return (
    <EuiFormRow
      label={node.label}
      data-node-id={node.id}
      isInvalid={error !== undefined}
      error={error}
    >
      <EuiSelect
        compressed
        isLoading={isLoading}
        isInvalid={error !== undefined}
        value={value}
        hasNoInitialSelection={!options.some((option) => option.value === value)}
        options={options.map((option) => ({
          value: option.value,
          text: option.label ?? option.value,
        }))}
        onChange={(event) => change(node, env, event.target.value)}
      />
    </EuiFormRow>
  );
};

const OptionsSelect = (props: SelectProps) =>
  props.node.multiple ? <MultiSelect {...props} /> : <SingleSelect {...props} />;

/** A select whose options, or some of them, come from a query that runs with the app. */
const QueryOptionsSelect = ({ node, env }: { node: Node; env: KibanaUiEnv }) => {
  const state = useSource(getOptionsSourceId(node.id));
  const queried = useMemo(() => toQueryOptions(state, node.options), [state, node.options]);

  return (
    <OptionsSelect
      node={node}
      env={env}
      queried={queried}
      isLoading={state.status === 'loading'}
      error={
        state.status === 'error'
          ? i18n.translate('xpack.customApp.selectNode.optionsError', {
              defaultMessage: 'The options could not be loaded: {reason}',
              values: { reason: state.message },
            })
          : undefined
      }
    />
  );
};

export const renderSelect: KibanaUiRenderer<Node> = (node, env) =>
  node.optionsQuery === undefined ? (
    <OptionsSelect node={node} env={env} queried={[]} />
  ) : (
    <QueryOptionsSelect node={node} env={env} />
  );
