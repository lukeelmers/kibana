/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { z } from '@kbn/zod/v4';
import type { CapabilityDoc } from './define_capability';
import type { KibanaUiStateValue } from './surface/env';

export interface ActionValidationContext {
  /** The node that has the action, by its id or its type, and the event that runs it. */
  nodeId: string;
  event: string;
  /** The values the app declares, as they start: the type of each is that of its value. */
  state: Readonly<Record<string, KibanaUiStateValue>>;
  /**
   * What is wrong with the `{{state.key}}` and `{{row.key}}` references of a text, in words: an
   * unknown key, or a row where the action has none.
   */
  checkText: (text: string) => string[];
  /** The ids of the components that are opened by an action, such as flyouts. */
  overlayIds: ReadonlySet<string>;
  /** Reports a problem with the node that has the action. */
  issue: (message: string) => void;
}

/** The action of a manifest: its settings, one of which is keyed by the id of the action. */
export type ActionOfShape<Shape extends z.ZodRawShape> = z.output<z.ZodObject<Shape>>;

export interface ActionManifest<
  Id extends string = string,
  Shape extends z.ZodRawShape = z.ZodRawShape
> {
  kind: 'action';
  id: Id;
  version: number;
  /** The settings of the action: the one keyed by its id, and any that go with it. */
  props: z.ZodObject<Shape>;
  doc: CapabilityDoc;
  /** What is wrong with the action beyond what its settings say, with the whole document in view. */
  validate?: (action: ActionOfShape<Shape>, context: ActionValidationContext) => void;
}

/** The action of a manifest. */
export type ActionOf<Manifest> = Manifest extends ActionManifest<string, infer Shape>
  ? ActionOfShape<Shape>
  : never;

export const defineAction = <Id extends string, Shape extends z.ZodRawShape>(
  manifest: ActionManifest<Id, Shape>
): ActionManifest<Id, Shape> => manifest;
