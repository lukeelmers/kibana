/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { ActionScope, AuthTypeDef, ConnectorSpec } from '@kbn/connector-specs';
import type { LicenseType } from '@kbn/licensing-types';

export interface DeclarativeRequest {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url?: string;
  baseUrl?: string;
  path?: string;
  query?: Record<string, unknown>;
  headers?: Record<string, unknown>;
  body?: unknown;
  bodyType?: 'json' | 'form' | 'text';
  retry?: {
    statusCodes: number[];
    maxAttempts: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
  };
  pagination?: {
    strategy: 'link_header';
    header?: string;
    maxPages: number;
    itemsPath?: string;
    outputKey: string;
  };
  response?: {
    dataPath?: string;
    outputKey?: string;
    rateLimitHeaders?: {
      remaining?: string;
      reset?: string;
    };
  };
}

export interface DeclarativeAction {
  description?: string;
  isTool?: boolean;
  scope?: ActionScope;
  input: Record<string, unknown>;
  request: DeclarativeRequest;
}

export interface DeclarativeAuthTypeDef extends AuthTypeDef {
  prefix?: string;
}

export interface DeclarativeConnectorMetadata {
  displayName: string;
  description: string;
  docsUrl?: string;
  minimumLicense: LicenseType;
  isTechnicalPreview?: boolean;
  supportedFeatureIds: string[];
}

/** A YAML connector definition. Each `version` is immutable once stored. */
export interface DeclarativeConnectorSpec {
  schemaVersion: 1;
  id: string;
  version: string;
  metadata: DeclarativeConnectorMetadata;
  config: Record<string, unknown>;
  auth: {
    types: Array<string | DeclarativeAuthTypeDef>;
  };
  actions: Record<string, DeclarativeAction>;
  test: {
    description?: string;
    request: DeclarativeRequest;
  };
}

export interface BuiltVersion {
  id: string;
  version: string;
  contentHash: string;
  spec: ConnectorSpec;
}

export interface StoredDefinition {
  id: string;
  version: string;
  yaml: string;
  contentHash: string;
  managedBy: string;
  addedAt: string;
}

/**
 * Writes the connector specs of one owner (`managedBy`), for installers such as Fleet that run
 * without a user request.
 */
export interface ManagedConnectorSpecsClient {
  /**
   * Stores the spec version and registers the connector type at its newest stored version.
   * Stored versions are never overwritten: an older version stays stored after an upgrade, and
   * re-sending a stored version with different content throws. Also throws when the id is a
   * built-in connector type or belongs to another owner, or when the version cannot be registered.
   */
  upsertSpec(yaml: string): Promise<{ id: string }>;
  /** Deletes every stored version of these connector types and unregisters them. */
  deleteSpecs(ids: string[]): Promise<void>;
}

export interface ConnectorCatalogStart {
  getManagedClient(options: { managedBy: string }): ManagedConnectorSpecsClient;
}
