/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { z, lazySchema } from '@kbn/zod/v4';
import {
  getCapability,
  getNodeSchemas,
  nodeSchema,
  type AppNode,
  type AppNodeOfType,
  type AppNodeType,
  type ContainerNode,
} from '@kbn/custom-app-registry';
import {
  CUSTOM_APP_STATE_VERSION,
  MAX_APP_DESCRIPTION_LENGTH,
  MAX_APP_TITLE_LENGTH,
  MAX_CHILDREN_PER_NODE,
} from './constants';
import { stateKeySchema } from './bindings';
import { actionSchema, stateDefaultSchema } from './action_schemas';
import type { casesSourceSchema } from './data_fields';
import type { formFieldSchema } from './input_schemas';
import type { StateValue } from './interpolation';
import { validateDocument } from './validate_document';

export { stateKeySchema, actionSchema, nodeSchema, getNodeSchemas };
export type { AppNode, AppNodeOfType, AppNodeType, ContainerNode };
export type { Action, ActionList } from '@kbn/custom-app-registry';
export type FormField = z.output<typeof formFieldSchema>;
export type CasesSource = z.output<typeof casesSourceSchema>;
/** Where a component gets what it shows. */
export type DataSource = { type: 'esql'; query: string } | CasesSource;

/**
 * An app. It is written out, and not worked out from the schema, so that the nodes stay the ones
 * that are registered where the type is used: a package that registers none cannot know them.
 */
export interface AppDocument {
  title: string;
  description?: string;
  /** Whether the app is offered in the navigation of Kibana. */
  showInNav?: boolean;
  /** The EUI icon of the app, such as `users`. */
  icon?: string;
  /** On its own page, `page` centers the app at the width of a page rather than the whole width. */
  width?: 'page';
  /** The values of the app, each by its default, whose type is the type of the value. */
  state: Record<string, StateValue>;
  /** What the app shows, in order. */
  body: AppNode[];
}

export const appDocumentShapeSchema: z.ZodType<AppDocument, unknown> = lazySchema(() =>
  z.object({
    title: z.string().min(1).max(MAX_APP_TITLE_LENGTH).describe('The name of the app.'),
    description: z
      .string()
      .max(MAX_APP_DESCRIPTION_LENGTH)
      .optional()
      .describe('What the app is for.'),
    showInNav: z.boolean().optional().describe('Whether Kibana lists the app in its navigation.'),
    icon: z.string().min(1).max(64).optional().describe('An EUI icon, such as "users".'),
    width: z
      .literal('page')
      .optional()
      .describe(
        '"page" centers the app on its page at the width of a page. Left out, it is as wide as the page.'
      ),
    state: z
      .record(stateKeySchema, stateDefaultSchema)
      .default({})
      .describe(
        'The values of the app by name, each given as its default: a text, a number, a boolean or a list of texts.'
      ),
    body: z
      .array(nodeSchema)
      .max(MAX_CHILDREN_PER_NODE)
      .describe('The components of the app, in order.'),
  })
);

export const appDocumentSchema: z.ZodType<AppDocument, unknown> = lazySchema(() =>
  appDocumentShapeSchema.superRefine(validateDocument)
);

/** The panel's own state, without the titles and time range every panel shares. */
export const customAppStateSchema = lazySchema(() =>
  z.object({
    version: z.literal(CUSTOM_APP_STATE_VERSION),
    document: appDocumentSchema,
  })
);

export type CustomAppState = z.output<typeof customAppStateSchema>;

/** Whether a node holds other nodes. */
export const isContainerNode = (node: AppNode): node is ContainerNode =>
  getCapability(node.type)?.container === true;

/** Returns the direct children of a node, empty for leaf nodes. */
export const getNodeChildren = (node: AppNode): readonly AppNode[] =>
  isContainerNode(node) ? node.children : [];
