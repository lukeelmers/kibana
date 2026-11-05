/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { omit } from 'lodash';
import { MAX_STATE_STRING_LENGTH, type FormField } from '@kbn/custom-app-common';

/** What was typed into a field, which holds while its value is the one it was typed over. */
export interface TypedAnswer {
  answer: string;
  over: string;
}

/** What a form has been typed into, by the value each field sets. */
export type FormAnswers = Readonly<Record<string, TypedAnswer>>;

export const getFormAnswersKey = (appId: string, nodeId: string): string =>
  `customApp:formAnswers:${appId}:${nodeId}`;

const getStorage = (): Storage | undefined => {
  try {
    return window.sessionStorage;
  } catch {
    // Storage can be refused, in a private window for instance. Then nothing is kept.
    return undefined;
  }
};

const isText = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= MAX_STATE_STRING_LENGTH;

const isTypedAnswer = (value: unknown): value is TypedAnswer =>
  typeof value === 'object' &&
  value !== null &&
  isText((value as Record<string, unknown>).answer) &&
  isText((value as Record<string, unknown>).over);

/**
 * What was typed and not sent, from this tab's session. It is read as untrusted, since the storage
 * can hold anything: only an answer for a field the form has, with texts no longer than a value can be.
 */
export const readFormAnswers = (key: string, fields: readonly FormField[]): FormAnswers => {
  try {
    const stored: unknown = JSON.parse(getStorage()?.getItem(key) ?? 'null');
    if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) return {};
    const answers = stored as Record<string, unknown>;
    return Object.fromEntries(
      fields.flatMap(({ bind }) => {
        const answer = Object.prototype.hasOwnProperty.call(answers, bind)
          ? answers[bind]
          : undefined;
        return isTypedAnswer(answer) ? [[bind, { answer: answer.answer, over: answer.over }]] : [];
      })
    );
  } catch {
    return {};
  }
};

/** Keeps what was typed, or nothing at all when nothing was. */
export const writeFormAnswers = (key: string, answers: FormAnswers): void => {
  try {
    const storage = getStorage();
    if (!storage) return;
    if (Object.keys(answers).length === 0) {
      storage.removeItem(key);
    } else {
      storage.setItem(key, JSON.stringify(answers));
    }
  } catch {
    // A full or refused storage only means that a refresh will not bring the answers back.
  }
};

/** Forgets what was typed over a value, in every form of an app, once an action sets that value. */
export const forgetFormAnswers = (appId: string, bind: string): void => {
  try {
    const storage = getStorage();
    if (!storage) return;
    const prefix = getFormAnswersKey(appId, '');
    for (const key of Object.keys(storage)) {
      if (!key.startsWith(prefix)) continue;
      const answers: unknown = JSON.parse(storage.getItem(key) ?? 'null');
      if (typeof answers === 'object' && answers !== null && bind in answers) {
        writeFormAnswers(key, omit(answers as FormAnswers, bind));
      }
    }
  } catch {
    // An entry that cannot be parsed is ignored by readFormAnswers too.
  }
};
