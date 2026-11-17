/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useEffect, useId, useState, type FormEvent } from 'react';
import {
  EuiButton,
  EuiFieldText,
  EuiForm,
  EuiFormRow,
  EuiSelect,
  EuiText,
  EuiToolTip,
} from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import { MAX_STATE_STRING_LENGTH } from '@kbn/custom-app-common';
import type { AppNodeProps, KibanaUiEnv, KibanaUiRenderer } from '@kbn/custom-app-registry';
import type { FormField, FormNode } from '../../../common/pack';
import { useAppId } from '../../runtime/app_id_context';
import { useActionGate } from '../../actions/use_action_gate';
import { DroppedActions } from '../../components/dropped_actions';
import {
  getFormAnswersKey,
  readFormAnswers,
  writeFormAnswers,
} from '../../components/form_answers_storage';

const requiredLabel = i18n.translate('xpack.customApp.formNode.required', {
  defaultMessage: 'Required',
});

const FieldInput = ({
  field,
  id,
  value,
  isInvalid,
  onChange,
}: {
  field: FormField;
  id: string;
  value: string;
  isInvalid: boolean;
  onChange: (next: string) => void;
}) => {
  const options = field.options ?? [];
  return field.kind === 'select' ? (
    <EuiSelect
      compressed
      fullWidth
      id={id}
      aria-label={field.label ?? field.name}
      value={value}
      isInvalid={isInvalid}
      // An answer that is none of the options, such as an empty one, shows as nothing chosen.
      hasNoInitialSelection={!options.some((option) => option.value === value)}
      options={options.map((option) => ({
        value: option.value,
        text: option.label ?? option.value,
      }))}
      onChange={(event) => onChange(event.target.value)}
    />
  ) : (
    <EuiFieldText
      compressed
      fullWidth
      id={id}
      value={value}
      isInvalid={isInvalid}
      maxLength={MAX_STATE_STRING_LENGTH}
      onChange={(event) => onChange(event.target.value)}
    />
  );
};

/**
 * Asks for some answers, and does something with them only when it is submitted: typing in a field
 * changes nothing. On submit the answers go into their values of the app, and then the form's
 * actions run, so that a workflow is given what was answered. A form that is missing a required
 * answer says which, and does nothing.
 */
const FormView = ({ node, env }: { node: FormNode & AppNodeProps; env: KibanaUiEnv }) => {
  const { state } = env;
  const onSubmit = node.onSubmit ?? [];
  const baseId = useId();
  const appId = useAppId();
  const storageKey = appId === undefined ? undefined : getFormAnswersKey(appId, node.id);
  /**
   * What was typed, by value. A field that was not typed in shows the value as the app has it. For a
   * saved app it is kept in this tab's session, so that a refresh does not lose it: it stays out of
   * the URL, which is shared.
   */
  const [typed, setTyped] = useState<Readonly<Record<string, string>>>(() =>
    storageKey === undefined ? {} : readFormAnswers(storageKey, node.fields)
  );
  useEffect(() => {
    if (storageKey !== undefined) writeFormAnswers(storageKey, typed);
  }, [storageKey, typed]);
  const [missing, setMissing] = useState<ReadonlySet<string>>(new Set());
  const [dropped, setDropped] = useState<string[]>([]);

  const answerTo = ({ name }: FormField): string => typed[name] ?? String(state[name] ?? '');

  const unavailableReason = useActionGate(onSubmit);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (unavailableReason !== undefined) return;

    const answers = node.fields.map((field) => ({ field, answer: answerTo(field).trim() }));
    const empty = answers.filter(({ field, answer }) => field.required && answer === '');
    setMissing(new Set(empty.map(({ field }) => field.name)));
    if (empty.length > 0) return;

    setDropped(
      env.dispatch([
        ...answers.map(({ field, answer }) => ({
          type: 'setState' as const,
          key: field.name,
          value: answer,
        })),
        ...onSubmit,
      ])
    );
  };

  return (
    <div data-node-id={node.id}>
      <EuiForm component="form" noValidate onSubmit={submit} data-test-subj="customAppForm">
        {node.fields.map((field, index) => {
          const id = `${baseId}-${index}`;
          const isInvalid = missing.has(field.name) && answerTo(field).trim() === '';
          return (
            <EuiFormRow
              key={field.name}
              id={id}
              label={field.label ?? field.name}
              labelAppend={
                field.required ? (
                  <EuiText size="xs" color="subdued">
                    {requiredLabel}
                  </EuiText>
                ) : undefined
              }
              isInvalid={isInvalid}
              error={
                isInvalid
                  ? i18n.translate('xpack.customApp.formNode.requiredError', {
                      defaultMessage: 'This is needed to continue.',
                    })
                  : undefined
              }
              fullWidth
            >
              <FieldInput
                field={field}
                id={id}
                value={answerTo(field)}
                isInvalid={isInvalid}
                onChange={(next) => {
                  setTyped((current) => ({ ...current, [field.name]: next }));
                }}
              />
            </EuiFormRow>
          );
        })}
        <EuiFormRow hasEmptyLabelSpace fullWidth>
          <EuiToolTip content={unavailableReason}>
            <EuiButton
              fill
              type="submit"
              isDisabled={unavailableReason !== undefined}
              data-test-subj="customAppFormSubmit"
            >
              {node.submitLabel}
            </EuiButton>
          </EuiToolTip>
        </EuiFormRow>
      </EuiForm>
      <DroppedActions reasons={dropped} onDismiss={() => setDropped([])} />
    </div>
  );
};

export const renderForm: KibanaUiRenderer<FormNode & AppNodeProps> = (node, env) => (
  <FormView node={node} env={env} />
);
