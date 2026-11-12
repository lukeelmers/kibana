/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import yaml from 'yaml';
import { lazySchema, z, ZodError } from '@kbn/zod/v4';
import type { DeclarativeConnectorSpec } from './types';

const jsonSchemaRecord = lazySchema(() => z.record(z.string(), z.unknown()));

const retrySchema = lazySchema(() =>
  z
    .object({
      statusCodes: z.array(z.number().int().min(100).max(599)),
      maxAttempts: z.number().int().min(1).max(5),
      initialDelayMs: z.number().int().nonnegative().max(30_000).optional(),
      maxDelayMs: z.number().int().positive().max(60_000).optional(),
    })
    .strict()
);

const requestSchema = lazySchema(() =>
  z
    .object({
      method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
      url: z.string().optional(),
      baseUrl: z.string().optional(),
      path: z.string().optional(),
      query: z.record(z.string(), z.unknown()).optional(),
      headers: z.record(z.string(), z.unknown()).optional(),
      body: z.unknown().optional(),
      bodyType: z.enum(['json', 'form', 'text']).optional(),
      retry: retrySchema.optional(),
      pagination: z
        .object({
          strategy: z.literal('link_header'),
          header: z.string().optional(),
          maxPages: z.number().int().min(1).max(100),
          itemsPath: z.string().optional(),
          outputKey: z.string().min(1),
        })
        .strict()
        .optional(),
      response: z
        .object({
          dataPath: z.string().optional(),
          outputKey: z.string().optional(),
          rateLimitHeaders: z
            .object({
              remaining: z.string().optional(),
              reset: z.string().optional(),
            })
            .strict()
            .optional(),
        })
        .strict()
        .optional(),
    })
    .strict()
    .superRefine((request, context) => {
      const hasUrl = request.url !== undefined;
      const hasBaseAndPath = request.baseUrl !== undefined && request.path !== undefined;
      if (hasUrl === hasBaseAndPath) {
        context.addIssue({
          code: 'custom',
          message: 'Provide either url or baseUrl with path.',
        });
      }
      const hostTemplates = [request.url, request.baseUrl]
        .filter((value): value is string => typeof value === 'string')
        .flatMap((value) =>
          [...value.matchAll(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g)].map((match) => match[1])
        );
      for (const templatePath of hostTemplates) {
        if (!templatePath.startsWith('config.')) {
          context.addIssue({
            code: 'custom',
            message: 'url and baseUrl templates may only reference config.*',
            path: request.url !== undefined ? ['url'] : ['baseUrl'],
          });
        }
      }
    })
);

const authTypeIdSchema = lazySchema(() => z.string().min(1).max(128));

const authTypeDefinitionSchema = lazySchema(() =>
  z
    .object({
      type: authTypeIdSchema,
      isRecommended: z.boolean().optional(),
      isLegacy: z.boolean().optional(),
      isExperimental: z.boolean().optional(),
      defaults: z.record(z.string(), z.unknown()),
      overrides: z
        .object({
          label: z.string().max(256).optional(),
          meta: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
        })
        .strict()
        .optional(),
      prefix: z.string().max(128).optional(),
    })
    .strict()
);

const connectorSpecAuthSchema = lazySchema(() =>
  z
    .object({
      types: z
        .array(z.union([authTypeIdSchema, authTypeDefinitionSchema]))
        .min(1)
        .max(16),
    })
    .strict()
);

const metadataSchema = lazySchema(() =>
  z
    .object({
      displayName: z.string().min(1).max(256),
      description: z.string().max(1024),
      docsUrl: z.url().optional(),
      // Connector types outside the stack need gold or above, see ensureSufficientLicense
      minimumLicense: z.enum(['gold', 'platinum', 'enterprise']),
      isTechnicalPreview: z.boolean().optional(),
      supportedFeatureIds: z.array(z.string()).min(1),
    })
    .strict()
);

const connectorSpecSchema = lazySchema(() =>
  z
    .object({
      schemaVersion: z.literal(1),
      id: z.string().regex(/^\.[a-z0-9_-]+$/),
      version: z.string().regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)$/),
      metadata: metadataSchema,
      config: jsonSchemaRecord,
      auth: connectorSpecAuthSchema,
      actions: z
        .record(
          z.string(),
          z
            .object({
              description: z.string().optional(),
              isTool: z.boolean().optional(),
              scope: z.enum(['read', 'write', 'destroy']).optional(),
              input: jsonSchemaRecord,
              request: requestSchema,
            })
            .strict()
        )
        .refine((actions) => Object.keys(actions).length > 0, 'At least one action is required.'),
      test: z
        .object({
          description: z.string().optional(),
          request: requestSchema,
        })
        .strict(),
    })
    .strict()
);

const formatIssues = (error: ZodError): string =>
  error.issues
    .map((issue) => `${issue.path.length > 0 ? issue.path.join('.') : '(root)'}: ${issue.message}`)
    .join(', ');

export const parseDeclarativeConnectorSpec = (raw: string): DeclarativeConnectorSpec => {
  let parsed: unknown;
  try {
    parsed = yaml.parse(raw);
  } catch (error) {
    throw new Error('Declarative connector definition is not valid YAML.', { cause: error });
  }
  try {
    return connectorSpecSchema.parse(parsed) as DeclarativeConnectorSpec;
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error(`Declarative connector definition is invalid: ${formatIssues(error)}`, {
        cause: error,
      });
    }
    throw error;
  }
};
