/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { ElasticsearchClient, Logger } from '@kbn/core/server';
import { StorageIndexAdapter, types, type IndexStorageSettings } from '@kbn/storage-adapter';
import type { StoredDefinition } from './types';

const CONNECTOR_CATALOG_INDEX_NAME = '.kibana_connector_catalog';

const MAX_DEFINITIONS = 10000;

const definitionDocId = (id: string, version: string): string => `${id}@${version}`;

const connectorCatalogStorageSettings = {
  name: CONNECTOR_CATALOG_INDEX_NAME,
  schema: {
    properties: {
      id: types.keyword(),
      version: types.keyword(),
      yaml: types.text({ index: false }),
      contentHash: types.keyword(),
      managedBy: types.keyword(),
      addedAt: types.date(),
    },
  },
} satisfies IndexStorageSettings;

type ConnectorCatalogStorageAdapter = StorageIndexAdapter<
  typeof connectorCatalogStorageSettings,
  StoredDefinition
>;

type ConnectorCatalogStorageClient = ReturnType<ConnectorCatalogStorageAdapter['getClient']>;

export class ConnectorCatalogStorage {
  constructor(private readonly client: ConnectorCatalogStorageClient) {}

  public async listDefinitions(
    filter: { id?: string; managedBy?: string } = {}
  ): Promise<StoredDefinition[]> {
    const response = await this.client.search({
      size: MAX_DEFINITIONS,
      track_total_hits: false,
      query: {
        bool: {
          filter: Object.entries(filter).map(([field, value]) => ({ term: { [field]: value } })),
        },
      },
    });
    return response.hits.hits.flatMap(({ _source: source }) => (source ? [source] : []));
  }

  public async createDefinition(definition: StoredDefinition): Promise<void> {
    await this.client.index({
      id: definitionDocId(definition.id, definition.version),
      op_type: 'create',
      document: definition,
    });
  }

  public async deleteDefinition({ id, version }: StoredDefinition): Promise<void> {
    await this.client.delete({ id: definitionDocId(id, version) });
  }
}

export const createConnectorCatalogStorage = (
  esClient: ElasticsearchClient,
  logger: Logger
): ConnectorCatalogStorage => {
  const adapter: ConnectorCatalogStorageAdapter = new StorageIndexAdapter(
    esClient,
    logger,
    connectorCatalogStorageSettings
  );
  return new ConnectorCatalogStorage(adapter.getClient());
};
