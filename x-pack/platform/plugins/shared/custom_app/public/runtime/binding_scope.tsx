/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { combineLatest } from 'rxjs';
import {
  getDeclaredQuerySourceId,
  type BindingScope,
  type DeclaredQuery,
} from '@kbn/custom-app-common';
import { toFirstRow } from '../data/data_layer';
import { useDataLayer } from '../data/data_layer_context';

type Row = Readonly<Record<string, unknown>>;
type QueryValues = Readonly<Record<string, Row | undefined>>;

const NO_QUERIES: QueryValues = {};

/** The row a component is drawn for, inside the template of a list. */
export const RowScopeContext = createContext<Row | undefined>(undefined);

/** The first row of each query the document declares, by its id, once it has one. */
const QueryValuesContext = createContext<QueryValues>(NO_QUERIES);

/**
 * Runs the queries the document declares, for as long as the app is shown, and offers the first row
 * of each to what is inside: the text and the rules that read them.
 */
export const DeclaredQueries = ({
  queries,
  children,
}: {
  queries?: Readonly<Record<string, DeclaredQuery>>;
  children: ReactNode;
}) => {
  const layer = useDataLayer();
  const ids = useMemo(() => Object.keys(queries ?? {}).sort(), [queries]);
  const idsKey = ids.join('\n');
  const [values, setValues] = useState<QueryValues>(NO_QUERIES);

  useEffect(() => {
    if (ids.length === 0) {
      setValues(NO_QUERIES);
      return;
    }
    const sourceIds = ids.map(getDeclaredQuerySourceId);
    const releases = sourceIds.map((id) => layer.acquire(id));
    const subscription = combineLatest(sourceIds.map((id) => layer.getSource$(id))).subscribe(
      (states) =>
        setValues(Object.fromEntries(ids.map((id, index) => [id, toFirstRow(states[index])])))
    );
    return () => {
      subscription.unsubscribe();
      releases.forEach((release) => release());
    };
    // The ids are what is read; a new object with the same ids is the same queries.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer, idsKey]);

  return <QueryValuesContext.Provider value={values}>{children}</QueryValuesContext.Provider>;
};

/** What a component can read besides the values of the app: its row, and the declared queries. */
export const useBindingScope = (): BindingScope => {
  const row = useContext(RowScopeContext);
  const queries = useContext(QueryValuesContext);
  return useMemo(() => ({ row, queries }), [row, queries]);
};
