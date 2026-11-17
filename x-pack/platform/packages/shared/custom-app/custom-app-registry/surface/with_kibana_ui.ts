/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type {
  AnyPrimitiveDefinition,
  PackTypes,
  PrimitiveDefinition,
  PrimitiveNode,
  PrimitiveSchema,
} from '@elastic/isomer-sdk';
import type { AppNodeProps, KibanaUiRenderer } from './env';

export const KIBANA_UI_SURFACE = 'kibana-ui';

/**
 * The primitive with a `kibana-ui` renderer, which draws it as a live part of an app. Call it in
 * browser code only, so that what it draws stays out of the server.
 */
export const withKibanaUi = <
  TNode extends PrimitiveNode,
  T extends PackTypes,
  TSchema extends PrimitiveSchema
>(
  primitive: PrimitiveDefinition<TNode, T, TSchema>,
  renderer: KibanaUiRenderer<TNode & AppNodeProps>
): PrimitiveDefinition<TNode, T, TSchema> => ({
  ...primitive,
  // The SDK's `Renderers` has fixed keys.
  renderers: {
    ...primitive.renderers,
    [KIBANA_UI_SURFACE]: renderer,
  } as typeof primitive.renderers,
});

/** The `kibana-ui` renderer of a primitive, if it has one. */
export const getKibanaUiRenderer = (
  primitive: AnyPrimitiveDefinition
): KibanaUiRenderer<PrimitiveNode & AppNodeProps> | undefined =>
  (primitive.renderers as { [KIBANA_UI_SURFACE]?: KibanaUiRenderer<PrimitiveNode & AppNodeProps> })[
    KIBANA_UI_SURFACE
  ];
