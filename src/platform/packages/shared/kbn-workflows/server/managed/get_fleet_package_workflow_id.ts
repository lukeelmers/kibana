/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

// eslint-disable-next-line import/no-nodejs-modules -- Exported from @kbn/workflows/server for server-side code only.
import { createHash } from 'node:crypto';
import { isValidId } from '@kbn/human-readable-id';
import { FLEET_PACKAGE_WORKFLOW_ID } from '../../managed/definitions/fleet';

const ID_HASH_LENGTH = 16;

const hashIdSegment = (value: string) =>
  createHash('sha256').update(value).digest('hex').slice(0, ID_HASH_LENGTH);

const normalizeIdSegment = (value: string) => value.toLowerCase().replace(/_/g, '-');

/**
 * The id Fleet installs a package workflow under, from the file name without `.yml`:
 * `<definition id>-<space hash>-<package hash>-<file name>`. The space and package name are
 * hashed because space ids are uncapped and allow hyphens, and package names differing only by
 * `-`/`_` normalize to the same file name prefix, so appending them as-is could collide.
 * Returns undefined when the file name cannot produce a valid workflow id.
 */
export const getFleetPackageWorkflowId = ({
  spaceId,
  packageName,
  fileName,
}: {
  spaceId: string;
  packageName: string;
  fileName: string;
}): string | undefined => {
  const workflowId = [
    FLEET_PACKAGE_WORKFLOW_ID,
    hashIdSegment(spaceId),
    hashIdSegment(packageName),
    normalizeIdSegment(fileName),
  ].join('-');

  return isValidId(workflowId) ? workflowId : undefined;
};
