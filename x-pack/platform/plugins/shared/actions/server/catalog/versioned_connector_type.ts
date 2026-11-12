/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { ActionTypeExecutorOptions, SpecVersionsContract, ValidatorServices } from '../types';
import type { PluginSetupContract as ActionsPluginSetupContract } from '../plugin';
import { createConnectorTypeFromSpec } from '../lib/single_file_connectors/create_connector_from_spec';
import type { CatalogActionType, BuiltVersion } from './types';

type ValidatorKey = 'config' | 'secrets' | 'params';
type ExecutorOptions = ActionTypeExecutorOptions<
  Record<string, unknown>,
  Record<string, unknown>,
  Record<string, unknown>
>;

/** One registry entry per connector type id that dispatches on each connector's pinned version. */
export interface VersionedConnectorType {
  readonly actionType: CatalogActionType;
  addVersion(built: BuiltVersion): void;
  hasVersion(version: string): boolean;
  getLatestVersion(major?: number): string | undefined;
}

const parse = (version: string) => version.split('.').map(Number);
const compareVersions = (left: string, right: string) => {
  const [leftMajor, leftMinor] = parse(left);
  const [rightMajor, rightMinor] = parse(right);
  return leftMajor - rightMajor || leftMinor - rightMinor;
};

export const createVersionedConnectorType = ({
  id,
  versions,
  actions,
}: {
  id: string;
  versions: BuiltVersion[];
  actions: ActionsPluginSetupContract;
}): VersionedConnectorType => {
  const types = new Map<string, { built: BuiltVersion; type: CatalogActionType }>();

  const getLatestVersion = (major?: number) =>
    [...types.keys()]
      .filter((version) => major === undefined || parse(version)[0] === major)
      .sort(compareVersions)
      .pop();
  // Connectors stored before pinning run the newest version of the lowest major
  const getDefaultVersion = () =>
    getLatestVersion(Math.min(...[...types.keys()].map((version) => parse(version)[0])))!;

  const entry = (version = getDefaultVersion()) => {
    const found = types.get(version);
    if (!found) {
      throw new Error(`Spec version "${version}" of connector type "${id}" is not installed`);
    }
    return found;
  };
  const newest = () => entry(getLatestVersion());

  const addVersion = (built: BuiltVersion) => {
    if (built.id !== id) {
      throw new Error(`Connector type "${id}" cannot serve "${built.id}@${built.version}"`);
    }
    if (!types.has(built.version)) {
      types.set(built.version, { built, type: createConnectorTypeFromSpec(built.spec, actions) });
    }
  };
  versions.forEach(addVersion);

  const resolveSchema = (key: ValidatorKey, specVersion?: string) => {
    const { built, type } = entry(specVersion);
    const schema = type.validate[key]!.schema;
    if (key !== 'params') return schema;
    return {
      parse: (value: unknown) => {
        const { subAction } = value as { subAction?: string };
        const latest = newest().built;
        if (subAction && !built.spec.actions[subAction] && latest.spec.actions[subAction]) {
          throw new Error(
            `"${subAction}" is added in spec version ${latest.version} of "${id}", and this connector runs ${built.version}. Update the connector's spec version to use it.`
          );
        }
        return schema.parse(value);
      },
    };
  };

  const validator = (key: ValidatorKey) => ({
    get schema() {
      return newest().type.validate[key]!.schema;
    },
    resolveSchema: ({ specVersion }: ValidatorServices) => resolveSchema(key, specVersion),
    customValidator: (value: Record<string, unknown>, services: ValidatorServices) =>
      entry(services.specVersion).type.validate[key]?.customValidator?.(value, services),
  });

  const specVersions: SpecVersionsContract = {
    getLatestVersion,
    getDefaultVersion,
    hasVersion: (version) => types.has(version),
  };

  // Type-level fields follow the newest version, which new connectors are created at
  const actionType: CatalogActionType = {
    id,
    get name() {
      return newest().type.name;
    },
    get minimumLicenseRequired() {
      return newest().type.minimumLicenseRequired;
    },
    get supportedFeatureIds() {
      return newest().type.supportedFeatureIds;
    },
    get source() {
      return newest().type.source;
    },
    get description() {
      return newest().type.description;
    },
    get isExperimental() {
      return newest().type.isExperimental;
    },
    get isTestable() {
      return newest().type.isTestable;
    },
    get globalAuthHeaders() {
      return newest().type.globalAuthHeaders;
    },
    get sandboxSupportedAuthTypes() {
      return newest().type.sandboxSupportedAuthTypes;
    },
    get spec() {
      return newest().built.spec;
    },
    specVersions,
    validate: {
      config: validator('config'),
      secrets: validator('secrets'),
      params: validator('params'),
    },
    executor: (options: ExecutorOptions) => entry(options.specVersion).type.executor!(options),
  };

  return { actionType, addVersion, hasVersion: specVersions.hasVersion, getLatestVersion };
};
