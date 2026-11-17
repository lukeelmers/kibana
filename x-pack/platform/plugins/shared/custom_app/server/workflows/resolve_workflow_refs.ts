/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { NODE_EVENTS, toActionArray, type ActionList } from '@kbn/custom-app-registry';
import { getFleetPackageWorkflowId } from '@kbn/workflows/server';

/** Each workflow of the app, by the reference it is written as, and the id it resolves to. */
export type ResolvedWorkflows = Record<string, string | null>;

const collectRefs = (value: unknown, refs: Set<string>): void => {
  if (Array.isArray(value)) {
    value.forEach((item) => collectRefs(item, refs));
    return;
  }
  if (typeof value !== 'object' || value === null) return;
  const node = value as Record<string, unknown>;
  NODE_EVENTS.forEach((event) => {
    if (node[event] === undefined) return;
    toActionArray(node[event] as ActionList).forEach((action) => {
      const { workflow } = action as { workflow?: unknown };
      if (typeof workflow === 'string') refs.add(workflow);
    });
  });
  Object.values(node).forEach((child) => collectRefs(child, refs));
};

/**
 * `"<name>"` is the workflow file `<name>.yml` of the package the app was installed from, and
 * `"<package>:<name>"` that of another package: each resolves to the id Fleet installs it under in
 * this space. Always from the package name, never from the id of the app, which is only the file
 * name in the space the package was installed to first. A name in an app that no package installed
 * resolves to null. Workflows given as `{ id }` need no resolving and are left out.
 */
export const resolveWorkflowRefs = (
  app: { body: unknown; package?: { name: string } },
  spaceId: string
): ResolvedWorkflows => {
  const refs = new Set<string>();
  collectRefs(app.body, refs);
  return Object.fromEntries(
    [...refs].map((ref) => {
      const separator = ref.indexOf(':');
      const packageName = separator === -1 ? app.package?.name : ref.slice(0, separator);
      const fileName = ref.slice(separator + 1);
      const id = packageName
        ? getFleetPackageWorkflowId({ spaceId, packageName, fileName })
        : undefined;
      return [ref, id ?? null];
    })
  );
};
