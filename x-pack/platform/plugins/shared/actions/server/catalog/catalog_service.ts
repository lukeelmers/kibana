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
import type { ConnectorCatalogStorage } from './catalog_storage';
import { createConnectorCatalogStorage } from './catalog_storage';
import type { ConnectorCatalogStart, ManagedConnectorSpecsClient, StoredDefinition } from './types';

interface ConnectorCatalogServiceOptions {
  logger: Logger;
  actions: PluginSetupContract;
  actionTypeRegistry: ActionTypeRegistry;
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** Sorts MAJOR.MINOR versions, newest first. */
const newestFirst = (definitions: StoredDefinition[]) =>
  [...definitions].sort((left, right) => {
    const [leftMajor, leftMinor] = left.version.split('.').map(Number);
    const [rightMajor, rightMinor] = right.version.split('.').map(Number);
    return rightMajor - leftMajor || rightMinor - leftMinor;
  });

/**
 * Registers connector types defined in YAML and stored in the connector catalog index. Each type
 * runs its newest stored version; installers write versions through a managed client.
 * PoC limit: the index is read once at start, so this only stays in sync on a single Kibana node.
 */
export class ConnectorCatalogService {
  private storage?: ConnectorCatalogStorage;
  private loaded?: Promise<void>;
  private readonly activeVersions = new Map<string, string>();

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
    const definitions = await this.getStorage().listDefinitions();
    for (const id of new Set(definitions.map((definition) => definition.id))) {
      if (this.isBuiltInType(id)) {
        this.options.logger.warn(
          `Skipping catalog connector "${id}" because a built-in type is already registered`
        );
        continue;
      }
      this.activate(
        id,
        definitions.filter((definition) => definition.id === id)
      );
    }
  }

  private isBuiltInType(id: string) {
    return this.options.actionTypeRegistry.has(id) && !this.activeVersions.has(id);
  }

  /**
   * Registers the newest of the given versions that can be registered, replacing the registered
   * version, or unregisters the type when none is left.
   */
  private activate(id: string, definitions: StoredDefinition[]) {
    const { logger } = this.options;
    for (const definition of newestFirst(definitions)) {
      if (this.activeVersions.get(id) === definition.version) {
        return;
      }
      try {
        this.replaceRegistration(id, definition);
        logger.info(`Registered catalog connector ${id}@${definition.version}`);
        return;
      } catch (error) {
        logger.warn(
          `Skipping catalog connector ${id}@${definition.version}: ${errorMessage(error)}`
        );
      }
    }
    if (this.activeVersions.delete(id)) {
      this.options.actionTypeRegistry.unregister(id);
      logger.info(`Unregistered catalog connector ${id}`);
    }
  }

  /** Registers the version in place of the registered one, which is restored if that fails. */
  private replaceRegistration(id: string, definition: StoredDefinition) {
    const { actions, actionTypeRegistry } = this.options;
    const actionType = createConnectorTypeFromSpec(buildVersion(definition.yaml).spec, actions);
    const previous = this.activeVersions.has(id) ? actionTypeRegistry.get(id) : undefined;
    if (previous) {
      actionTypeRegistry.unregister(id);
    }
    try {
      actions.registerType(actionType);
    } catch (error) {
      // `register` can throw after taking the id
      actionTypeRegistry.unregister(id);
      if (previous) {
        actionTypeRegistry.register(previous);
      }
      throw error;
    }
    this.activeVersions.set(id, definition.version);
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
          stored.push(definition);
        }
        this.activate(built.id, stored);
        return { id: built.id };
      },
      deleteSpecs: async (ids) => {
        await this.loaded;
        for (const id of ids) {
          const stored = await storage.listDefinitions({ id, managedBy });
          for (const definition of stored) {
            await storage.deleteDefinition(definition);
          }
          this.activate(id, await storage.listDefinitions({ id }));
        }
      },
    };
  }
}
