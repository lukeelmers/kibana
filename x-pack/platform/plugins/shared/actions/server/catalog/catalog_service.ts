/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import Boom from '@hapi/boom';
import type { ElasticsearchClient, Logger } from '@kbn/core/server';
import type { ActionTypeRegistry } from '../action_type_registry';
import type { PluginSetupContract } from '../plugin';
import { createConnectorTypeFromSpec } from '../lib/single_file_connectors/create_connector_from_spec';
import { buildVersion } from './build_version';
import type { VersionedConnectorType } from './versioned_connector_type';
import { createVersionedConnectorType } from './versioned_connector_type';
import type { ConnectorCatalogStorage } from './catalog_storage';
import { createConnectorCatalogStorage } from './catalog_storage';
import type { BuiltVersion, ConnectorCatalogStart, ManagedConnectorSpecsClient } from './types';

interface ConnectorCatalogServiceOptions {
  logger: Logger;
  actions: PluginSetupContract;
  actionTypeRegistry: ActionTypeRegistry;
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Registers connector types defined in YAML and stored in the connector catalog index. Every
 * stored version of a type stays loaded, and each connector runs the version it is pinned to;
 * installers write versions through a managed client.
 * PoC limit: the index is read once at start, so this only stays in sync on a single Kibana node.
 */
export class ConnectorCatalogService {
  private storage?: ConnectorCatalogStorage;
  private loaded?: Promise<void>;
  private readonly types = new Map<string, VersionedConnectorType>();

  constructor(private readonly options: ConnectorCatalogServiceOptions) {}

  public start(esClient: ElasticsearchClient): ConnectorCatalogStart {
    this.storage = createConnectorCatalogStorage(esClient, this.options.logger);
    this.loaded = this.loadFromIndex().catch((error) => {
      this.options.logger.warn(`Failed to load the connector catalog: ${errorMessage(error)}`);
    });
    return {
      getManagedClient: ({ managedBy }) => this.getManagedClient(managedBy),
    };
  }

  private getStorage(): ConnectorCatalogStorage {
    if (!this.storage) {
      throw new Error('The connector catalog is not started.');
    }
    return this.storage;
  }

  private async loadFromIndex() {
    const { logger } = this.options;
    for (const definition of await this.getStorage().listDefinitions()) {
      const { id, version } = definition;
      if (this.isBuiltInType(id)) {
        logger.warn(`Skipping catalog connector ${id}@${version}: a built-in type is registered`);
        continue;
      }
      try {
        this.addVersion(buildVersion(definition.yaml));
      } catch (error) {
        logger.warn(`Skipping catalog connector ${id}@${version}: ${errorMessage(error)}`);
      }
    }
  }

  private isBuiltInType(id: string) {
    return this.options.actionTypeRegistry.has(id) && !this.types.has(id);
  }

  /** Adds the version to its connector type, registering the type on its first version. */
  private addVersion(built: BuiltVersion) {
    const { actions, actionTypeRegistry, logger } = this.options;
    const existing = this.types.get(built.id);
    if (existing) {
      existing.addVersion(built);
    } else {
      const type = createVersionedConnectorType({ id: built.id, versions: [built], actions });
      try {
        actions.registerType(type.actionType);
      } catch (error) {
        // `register` can throw after taking the id
        actionTypeRegistry.unregister(built.id);
        throw error;
      }
      this.types.set(built.id, type);
    }
    logger.info(`Registered catalog connector ${built.id}@${built.version}`);
  }

  private getManagedClient(managedBy: string): ManagedConnectorSpecsClient {
    if (!managedBy) {
      throw Boom.badRequest('A managed connector spec owner is required.');
    }
    const storage = this.getStorage();
    const { actions, actionTypeRegistry } = this.options;

    return {
      upsertSpec: async (yaml) => {
        await this.loaded;
        const built = buildVersion(yaml);
        if (this.isBuiltInType(built.id)) {
          throw Boom.conflict(`Connector type "${built.id}" is a built-in connector type.`);
        }
        const stored = await storage.listDefinitions({ id: built.id });
        const otherOwner = stored.find((definition) => definition.managedBy !== managedBy);
        if (otherOwner) {
          throw Boom.conflict(
            `Connector type "${built.id}" is managed by "${otherOwner.managedBy}".`
          );
        }
        const existing = stored.find(({ version }) => version === built.version);
        if (existing && existing.contentHash !== built.contentHash) {
          throw Boom.conflict(
            `Connector spec ${built.id}@${built.version} is already stored with different content; publish the change as a new version.`
          );
        }
        if (!existing) {
          actionTypeRegistry.validateActionType(createConnectorTypeFromSpec(built.spec, actions));
          const definition = {
            id: built.id,
            version: built.version,
            yaml,
            contentHash: built.contentHash,
            managedBy,
            addedAt: new Date().toISOString(),
          };
          await storage.createDefinition(definition);
        }
        if (!this.types.get(built.id)?.hasVersion(built.version)) {
          this.addVersion(built);
        }
        return { id: built.id };
      },
      deleteSpecs: async (ids) => {
        await this.loaded;
        for (const id of ids) {
          const stored = await storage.listDefinitions({ id, managedBy });
          for (const definition of stored) {
            await storage.deleteDefinition(definition);
          }
          const remaining = await storage.listDefinitions({ id });
          if (remaining.length === 0 && this.types.delete(id)) {
            this.options.actionTypeRegistry.unregister(id);
            this.options.logger.info(`Unregistered catalog connector ${id}`);
          }
        }
      },
    };
  }
}
