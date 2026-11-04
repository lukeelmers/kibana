/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { useCallback } from 'react';
import { interpolate } from '@kbn/custom-app-common';
import { useStateValues } from './app_runtime_context';
import { useBindingScope } from './binding_scope';

/**
 * Fills a text with what it refers to as it is now: the values of the app, the row it is drawn for
 * and the declared queries.
 */
export const useInterpolate = (): ((text: string) => string) => {
  const state = useStateValues();
  const scope = useBindingScope();
  return useCallback((text: string) => interpolate(text, state, scope), [state, scope]);
};
