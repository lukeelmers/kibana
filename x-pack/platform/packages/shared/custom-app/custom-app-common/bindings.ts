/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { z } from '@kbn/zod/v4';
import {
  BADGE_COLORS,
  CARD_ICONS,
  MAX_COLUMNS,
  MAX_HEADING_LENGTH,
  MAX_NODE_ID_LENGTH,
  MAX_STATE_KEY_LENGTH,
  MAX_STATE_STRING_LENGTH,
  PROGRESS_COLORS,
  RESERVED_STATE_KEYS,
  THEME_ACCENTS,
  THEME_SHAPES,
} from './constants';
import type { AppNode } from './document_schema';

/** A valid ES|QL parameter name, so a state key can be used as `?key` in a query. */
export const stateKeySchema = z
  .string()
  .max(MAX_STATE_KEY_LENGTH)
  .regex(/^[A-Za-z_][A-Za-z0-9_]*$/)
  .refine((key) => !RESERVED_STATE_KEYS.includes(key.toLowerCase()), {
    message: `Reserved by ES|QL for the time range: ${RESERVED_STATE_KEYS.join(', ')}`,
  });

/** The value of a state key, in place of a value that is written down. */
export const stateRefSchema = z.object({ $state: stateKeySchema });
export type StateRef = z.output<typeof stateRefSchema>;

export const isStateRef = (value: unknown): value is StateRef =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  typeof (value as { $state?: unknown }).$state === 'string';

/** The name of a column of a row, as ES|QL names it, which may have dots in it. */
export const fieldNameSchema = z
  .string()
  .min(1)
  .max(MAX_HEADING_LENGTH)
  .regex(/^[A-Za-z_@][A-Za-z0-9_.@-]*$/);

/** The id of a query the document declares. It is written as a node id is, without dots. */
export const queryIdSchema = z
  .string()
  .min(1)
  .max(MAX_NODE_ID_LENGTH)
  .regex(/^[A-Za-z0-9_-]+$/);

/**
 * A column of the row a component is drawn for, which only the template of a list has: it is
 * drawn once for each row of the query of the list.
 */
export const rowRefSchema = z.object({ $row: fieldNameSchema });
export type RowRef = z.output<typeof rowRefSchema>;

/** A column of the first row of a query the document declares, as it is now. */
export const queryRefSchema = z.object({ $query: queryIdSchema, field: fieldNameSchema });
export type QueryRef = z.output<typeof queryRefSchema>;

const hasString = (value: unknown, key: string): boolean =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  typeof (value as Record<string, unknown>)[key] === 'string';

export const isRowRef = (value: unknown): value is RowRef => hasString(value, '$row');

export const isQueryRef = (value: unknown): value is QueryRef =>
  hasString(value, '$query') && hasString(value, 'field');

/** Anything a property can read instead of being written down. */
export type BindingRef = StateRef | RowRef | QueryRef;

export const isBindingRef = (value: unknown): value is BindingRef =>
  isStateRef(value) || isRowRef(value) || isQueryRef(value);

/**
 * What a component can read besides the values of the app: the row it is drawn for, inside the
 * template of a list, and the first row of each query the document declares, by its id.
 */
export interface BindingScope {
  row?: Readonly<Record<string, unknown>>;
  queries?: Readonly<Record<string, Readonly<Record<string, unknown>> | undefined>>;
}

/** What a reference reads now, before it is checked against the property. */
export const readRef = (
  ref: BindingRef,
  values: Readonly<Record<string, unknown>>,
  scope: BindingScope = {}
): unknown => {
  if (isStateRef(ref)) return values[ref.$state];
  if (isRowRef(ref)) return scope.row?.[ref.$row];
  return scope.queries?.[ref.$query]?.[ref.field];
};

/**
 * A property that can be given as a value or as `{ "$state": "key" }`, the value of that key as it is
 * now, so that a switch or a select can drive it. It is read as a value of its own type, because the
 * references are replaced by `resolveBoundProps` before anything draws the component. It can also be
 * `{ "$row": "column" }` in the template of a list, and `{ "$query": "id", "field": "column" }`.
 */
export const bindable = <T extends z.ZodType>(schema: T): T =>
  z.union([schema, stateRefSchema, rowRefSchema, queryRefSchema]) as unknown as T;

/**
 * A reference to a key for a property of a document written in code. It is typed as the value the
 * property has, as `bindable` types the schema, since it is replaced by that value before anything
 * draws the component.
 */
export const stateRef = <T>(key: string): T => ({ $state: key } as unknown as T);

const comparableSchema = z.union([
  z.string().max(MAX_STATE_STRING_LENGTH),
  z.number().finite(),
  z.boolean(),
]);

/** How what is read is compared, at most one of them. With none, it is shown when it is true. */
const visibilityOperators = {
  equals: comparableSchema.optional(),
  notEquals: comparableSchema.optional(),
  gt: z.number().finite().optional(),
  gte: z.number().finite().optional(),
  lt: z.number().finite().optional(),
  lte: z.number().finite().optional(),
  isEmpty: z.literal(true).optional(),
  isNotEmpty: z.literal(true).optional(),
};

export const VISIBILITY_OPERATORS = Object.keys(visibilityOperators) as Array<
  keyof typeof visibilityOperators
>;

/**
 * Whether a component is shown: when the key is true, or, with `equals`, when it is that value, such
 * as the option of a select. Left out, it is always shown. What it reads can also be a column of the
 * first row of a declared query, or of the row of a list, and it can be compared in other ways.
 */
export const visibleWhenSchema = z
  .union([
    z.object({ $state: stateKeySchema, ...visibilityOperators }),
    z.object({ $query: queryIdSchema, field: fieldNameSchema, ...visibilityOperators }),
    z.object({ $row: fieldNameSchema, ...visibilityOperators }),
  ])
  .optional();

export type VisibleWhen = NonNullable<z.output<typeof visibleWhenSchema>>;

/** The operators a rule uses, which validation holds to one. */
export const getVisibilityOperators = (rule: VisibleWhen): string[] =>
  VISIBILITY_OPERATORS.filter((operator) => rule[operator] !== undefined);

/** What a bindable property is when it is written down, and the kind of value that can set it. */
export const calloutColorSchema = z
  .enum(['primary', 'success', 'warning', 'danger'])
  .default('primary');
export const chartTypeSchema = z.enum(['bar', 'line', 'area', 'donut']).optional();
export const annotationsVisibleSchema = z.boolean().default(true);
export const betterWhenSchema = z.enum(['higher', 'lower']).default('higher');
export const progressMaxSchema = z.number().finite().positive().default(100);
export const progressColorSchema = z.enum(PROGRESS_COLORS).default('primary');
export const badgeColorSchema = z.enum(BADGE_COLORS).default('default');
export const stackDirectionSchema = z.enum(['vertical', 'horizontal']).default('vertical');
export const cardIconSchema = z.enum(CARD_ICONS).optional();
export const columnsCountSchema = z.number().int().min(2).max(MAX_COLUMNS).default(2);
export const sectionOpenSchema = z.boolean().optional();
export const themeAccentSchema = z.enum(THEME_ACCENTS).optional();
export const themeShapeSchema = z.enum(THEME_SHAPES).optional();

type BoundKind = 'string' | 'number' | 'boolean';

interface BoundProp {
  /** The property as it is written down, which a value from the state must also be. */
  schema: z.ZodType;
  /** The kind of state key that can set it. */
  kind: BoundKind;
}

const prop = (schema: z.ZodType, kind: BoundKind): BoundProp => ({ schema, kind });

/** The properties of each type of component that can be set by a value, by their path. */
export const BOUND_PROPS: Readonly<Record<string, Readonly<Record<string, BoundProp>>>> = {
  callout: { color: prop(calloutColorSchema, 'string') },
  chart: {
    chartType: prop(chartTypeSchema, 'string'),
    'annotations.visible': prop(annotationsVisibleSchema, 'boolean'),
  },
  metric: { betterWhen: prop(betterWhenSchema, 'string') },
  progress: { max: prop(progressMaxSchema, 'number'), color: prop(progressColorSchema, 'string') },
  badge: { color: prop(badgeColorSchema, 'string') },
  stack: { direction: prop(stackDirectionSchema, 'string') },
  card: { icon: prop(cardIconSchema, 'string') },
  columns: { columns: prop(columnsCountSchema, 'number') },
  section: { open: prop(sectionOpenSchema, 'boolean') },
};

/** The same for the theme of a page. */
export const THEME_BOUND_PROPS: Readonly<Record<string, BoundProp>> = {
  accent: prop(themeAccentSchema, 'string'),
  shape: prop(themeShapeSchema, 'string'),
};

export const getPath = (value: unknown, path: string): unknown =>
  path
    .split('.')
    .reduce<unknown>(
      (current, key) =>
        typeof current === 'object' && current !== null
          ? (current as Record<string, unknown>)[key]
          : undefined,
      value
    );

/** A copy of the object with the value at the path set, or taken out when it is not there. */
const withPath = <T extends object>(value: T, [key, ...rest]: string[], next: unknown): T => {
  const copy = { ...value } as Record<string, unknown>;
  if (rest.length === 0) {
    if (next === undefined) delete copy[key];
    else copy[key] = next;
  } else if (typeof copy[key] === 'object' && copy[key] !== null) {
    copy[key] = withPath(copy[key] as object, rest, next);
  }
  return copy as T;
};

/**
 * What a reference is now: the value of its key, when that is a value the property can have, and
 * what the property is when nothing is written, or none, when that is not a value it can have.
 */
export const resolveBoundValue = (
  { schema }: BoundProp,
  ref: BindingRef,
  values: Readonly<Record<string, unknown>>,
  scope?: BindingScope
): unknown => {
  const read = readRef(ref, values, scope);
  const given = schema.safeParse(read);
  if (given.success && read !== undefined) return given.data;
  const fallback = schema.safeParse(undefined);
  return fallback.success ? fallback.data : undefined;
};

/**
 * The component with every property that reads a value given what it is now. The component is the
 * same one when it reads nothing, so what is drawn from it does not change for nothing.
 */
export const resolveBoundProps = (
  node: AppNode,
  values: Readonly<Record<string, unknown>>,
  scope?: BindingScope
): AppNode => {
  const props = BOUND_PROPS[node.type];
  if (!props) return node;

  return Object.entries(props).reduce<AppNode>((resolved, [path, bound]) => {
    const value = getPath(resolved, path);
    return isBindingRef(value)
      ? withPath(resolved, path.split('.'), resolveBoundValue(bound, value, values, scope))
      : resolved;
  }, node);
};

/**
 * What the properties of the component that read a value are now, as text, so that a component that
 * is drawn again with the same values can be told from one whose values changed.
 */
export const getBoundSignature = (
  node: AppNode,
  values: Readonly<Record<string, unknown>>,
  scope?: BindingScope
): string => {
  const props = BOUND_PROPS[node.type];
  if (!props) return '';
  return JSON.stringify(
    Object.entries(props).flatMap(([path, bound]) => {
      const value = getPath(node, path);
      return isBindingRef(value) ? [[path, resolveBoundValue(bound, value, values, scope)]] : [];
    })
  );
};

const isEmptyValue = (value: unknown): boolean =>
  value === undefined ||
  value === null ||
  value === '' ||
  (Array.isArray(value) && value.length === 0);

/** A value compared with a number: a number, or a text that is one, as a column can be. */
const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return undefined;
};

/** Whether what a rule reads passes it. */
export const passesRule = (rule: VisibleWhen, value: unknown): boolean => {
  if (rule.equals !== undefined) return value === rule.equals;
  if (rule.notEquals !== undefined) return value !== rule.notEquals;
  if (rule.isEmpty) return isEmptyValue(value);
  if (rule.isNotEmpty) return !isEmptyValue(value);
  const comparisons: Array<[number | undefined, (a: number, b: number) => boolean]> = [
    [rule.gt, (a, b) => a > b],
    [rule.gte, (a, b) => a >= b],
    [rule.lt, (a, b) => a < b],
    [rule.lte, (a, b) => a <= b],
  ];
  const comparison = comparisons.find(([operand]) => operand !== undefined);
  if (comparison) {
    const [operand, compare] = comparison;
    const number = toNumber(value);
    return number !== undefined && compare(number, operand as number);
  }
  return value === true;
};

/** Whether the component is shown, given the values of the app, and the rows it can read. */
export const isNodeVisible = (
  node: { visibleWhen?: VisibleWhen },
  values: Readonly<Record<string, unknown>>,
  scope?: BindingScope
): boolean => {
  const { visibleWhen } = node;
  if (!visibleWhen) return true;
  return passesRule(visibleWhen, readRef(visibleWhen as BindingRef, values, scope));
};
