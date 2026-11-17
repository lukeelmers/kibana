/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { firstValueFrom } from 'rxjs';
import { parse } from 'yaml';

import { ENABLE_CUSTOM_APP_ASSETS_FLAG } from '../../../../../common/constants';
import type { PackageInstallContext } from '../../../../../common/types';
import { KibanaSavedObjectType } from '../../../../../common/types';
import { PackageInvalidArchiveError } from '../../../../errors';
import { appContextService } from '../../../app_context';
import { getPathParts } from '../../archive';
import { getWorkflowFileName, isWorkflowAssetPath } from '../workflows/install';

import type { ArchiveAsset } from './install';

const CUSTOM_APP_FILE_EXTENSION = '.json';

export const isCustomAppAssetPath = (path: string) => {
  const { service, type } = getPathParts(path);
  return service === 'kibana' && type === 'custom_app' && path.endsWith(CUSTOM_APP_FILE_EXTENSION);
};

export const isCustomAppAssetsFlagEnabled = async (): Promise<boolean> => {
  const featureFlags = appContextService.getFeatureFlags();
  if (!featureFlags) return false;
  return await firstValueFrom(featureFlags.getBooleanValue$(ENABLE_CUSTOM_APP_ASSETS_FLAG, false));
};

/**
 * Package files hold the app document only. The saved object id is the file name
 * (`kibana/custom_app/<id>.json`), and the package name is kept so the app can find its package.
 */
export const toCustomAppAsset = ({
  path,
  file,
  packageName,
}: {
  path: string;
  file: Record<string, unknown>;
  packageName: string;
}): ArchiveAsset => ({
  id: getPathParts(path).file.slice(0, -CUSTOM_APP_FILE_EXTENSION.length),
  type: KibanaSavedObjectType.customApp,
  attributes: { ...file, package: { name: packageName } },
  references: [],
});

/** The input names of the manual triggers of a workflow file, or undefined if it cannot be read. */
const getManualInputNames = (yaml: string): string[] | undefined => {
  try {
    const { triggers } = parse(yaml) ?? {};
    const declared = (Array.isArray(triggers) ? triggers : [])
      .filter((trigger) => trigger?.type === 'manual' && trigger.inputs)
      .map(({ inputs }) => inputs);
    // A JSON schema with `additionalProperties` takes inputs it does not name.
    if (declared.some((inputs) => !Array.isArray(inputs) && inputs.additionalProperties)) {
      return undefined;
    }
    return declared.flatMap((inputs) =>
      Array.isArray(inputs)
        ? inputs.map((input) => input?.name)
        : Object.keys(inputs.properties ?? {})
    );
  } catch {
    return undefined;
  }
};

/**
 * The workflows an app file names by reference, with the inputs each is handed: its own `inputs`,
 * or else the fields of the form it is submitted from. Workflows given as `{ id }` are left out.
 */
const getWorkflowRefs = (value: unknown): Array<{ ref: string; inputNames: string[] }> => {
  if (Array.isArray(value)) return value.flatMap(getWorkflowRefs);
  if (typeof value !== 'object' || value === null) return [];
  const node = value as Record<string, unknown>;
  const fieldNames = Array.isArray(node.fields) ? node.fields.map((field) => field?.name) : [];
  const refs = Object.entries(node)
    .filter(([key]) => /^on[A-Z]/.test(key))
    .flatMap(([event, handlers]) =>
      ([handlers].flat() as Array<{ workflow?: unknown; inputs?: object } | null>).flatMap(
        (action) => {
          if (typeof action?.workflow !== 'string') return [];
          const formFields = event === 'onSubmit' ? fieldNames : [];
          return [
            {
              ref: action.workflow,
              inputNames: action.inputs ? Object.keys(action.inputs) : formFields,
            },
          ];
        }
      )
    );
  return [...refs, ...Object.values(node).flatMap(getWorkflowRefs)];
};

/**
 * Fails the install when an app names a workflow by reference that the package cannot give it:
 * `"<name>"` and `"<this package>:<name>"` must be a `kibana/workflow/<name>.yml` file of the
 * package that declares the inputs the app hands it, and `"<other package>:<name>"` must name a
 * package that `requires.content` in `manifest.yml` lists.
 */
export const checkCustomAppWorkflowRefs = async ({
  packageInfo,
  archiveIterator,
}: PackageInstallContext) => {
  const workflowInputs = new Map<string, string[] | undefined>();
  await archiveIterator.traverseEntries(async ({ path, buffer }) => {
    if (buffer) {
      workflowInputs.set(getWorkflowFileName(path), getManualInputNames(buffer.toString('utf8')));
    }
  }, isWorkflowAssetPath);

  const requiredPackages = packageInfo.requires?.content?.map((dependency) => dependency.package);

  const getProblem = (ref: string, inputNames: string[]): string | undefined => {
    const separator = ref.indexOf(':');
    const packageName = separator === -1 ? packageInfo.name : ref.slice(0, separator);
    const fileName = ref.slice(separator + 1);
    if (packageName !== packageInfo.name) {
      return requiredPackages?.includes(packageName)
        ? undefined
        : `names package ${packageName}, which manifest.yml does not list under requires.content`;
    }
    if (!workflowInputs.has(fileName)) {
      return `is not a workflow of this package: kibana/workflow/${fileName}.yml is missing`;
    }
    const declared = workflowInputs.get(fileName);
    const unknown = declared ? inputNames.filter((name) => !declared.includes(name)) : [];
    return unknown.length
      ? `is handed inputs its manual trigger does not declare: ${unknown.join(', ')}`
      : undefined;
  };

  await archiveIterator.traverseEntries(async ({ path, buffer }) => {
    if (!buffer) return;
    for (const { ref, inputNames } of getWorkflowRefs(JSON.parse(buffer.toString('utf8')))) {
      const problem = getProblem(ref, inputNames);
      if (problem) {
        throw new PackageInvalidArchiveError(`Custom app ${path}: workflow "${ref}" ${problem}`);
      }
    }
  }, isCustomAppAssetPath);
};
