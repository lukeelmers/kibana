/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

// Temporary. Mirrors https://github.com/elastic/isomer/issues/194 until @elastic/isomer-sdk ships
// surface registration. Delete when it does.

import type { PrimitiveNode, SurfaceName } from '@elastic/isomer-sdk';

export interface SurfaceDefinition<THost, TOutput, TApi> {
  name: string;
  /** Also visible wherever a node's `surfaces` allowlist names this built-in surface. */
  visibleAs?: SurfaceName;
  /** Renders a node whose primitive has no renderer for this surface. */
  fallback: (node: PrimitiveNode, host: THost) => TOutput;
  /** Builds the surface. */
  create: (host: THost) => TApi;
}

export const defineSurface = <THost, TOutput, TApi>(
  definition: SurfaceDefinition<THost, TOutput, TApi>
): SurfaceDefinition<THost, TOutput, TApi> => definition;
