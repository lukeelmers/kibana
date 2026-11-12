/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { loggingSystemMock } from '@kbn/core/server/mocks';
import type { ManagedConnectorSpecsClient } from '@kbn/actions-plugin/server';

import type { PackageInstallContext } from '../../../../../common/types';
import { KibanaSavedObjectType } from '../../../../../common/types';

import { installConnectors } from './install';

const createContext = (entries: Record<string, string>): PackageInstallContext =>
  ({
    packageInfo: { name: 'my_pkg' },
    paths: Object.keys(entries),
    archiveIterator: {
      traverseEntries: async (
        onEntry: (entry: { path: string; buffer?: Buffer }) => Promise<void>,
        filter?: (path: string) => boolean
      ) => {
        for (const [path, content] of Object.entries(entries)) {
          if (!filter || filter(path)) {
            await onEntry({ path, buffer: Buffer.from(content) });
          }
        }
      },
    },
  } as unknown as PackageInstallContext);

const createClient = () =>
  ({
    upsertSpec: jest.fn(async (yaml: string) => ({ id: yaml })),
    deleteSpecs: jest.fn().mockResolvedValue(undefined),
  } as jest.Mocked<ManagedConnectorSpecsClient>);

const connectorRef = (id: string) => ({ id, type: KibanaSavedObjectType.connector });

describe('installConnectors', () => {
  const logger = loggingSystemMock.createLogger();

  it('upserts the connector YAML files and removes connectors the package no longer ships', async () => {
    const client = createClient();
    const refs = await installConnectors({
      client,
      packageInstallContext: createContext({
        'my_pkg-1.0.0/kibana/connector/a.yml': '.a',
        'my_pkg-1.0.0/kibana/workflow/b.yml': '.b',
      }),
      logger,
      previousRefs: [connectorRef('.a'), connectorRef('.old')],
    });

    expect(client.upsertSpec.mock.calls).toEqual([['.a']]);
    expect(client.deleteSpecs).toHaveBeenCalledWith(['.old']);
    expect(refs).toEqual([connectorRef('.a')]);
  });

  it('removes only the connectors added by the failed run', async () => {
    const client = createClient();
    client.upsertSpec.mockImplementation(async (yaml) => {
      if (yaml === '.c') throw new Error('invalid');
      return { id: yaml };
    });

    await expect(
      installConnectors({
        client,
        packageInstallContext: createContext({
          'my_pkg-1.0.0/kibana/connector/a.yml': '.a',
          'my_pkg-1.0.0/kibana/connector/b.yml': '.b',
          'my_pkg-1.0.0/kibana/connector/c.yml': '.c',
        }),
        logger,
        previousRefs: [connectorRef('.a')],
      })
    ).rejects.toThrow('Failed to install connector my_pkg-1.0.0/kibana/connector/c.yml: invalid');
    expect(client.deleteSpecs).toHaveBeenCalledWith(['.b']);
  });
});
