/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import {
  SavedObjectsErrorHelpers,
  SavedObjectsUtils,
  type SavedObjectsClientContract,
} from '@kbn/core/server';
import { CUSTOM_APP_SAVED_OBJECT_TYPE } from '../../common/constants';
import type { SavedAppInput } from '../../common/saved_app_schema';
import { resolveWorkflowRefs, type ResolvedWorkflows } from '../workflows/resolve_workflow_refs';

/** An app as it is written, and the package it was installed from, if it was. */
type StoredApp = SavedAppInput & { package?: { name: string } };

export type SavedApp = StoredApp & {
  id: string;
  /** Installed by a package, which owns it: it is cloned to be changed. */
  managed?: boolean;
  updatedAt?: string;
};

/** A saved app as it is opened, with the id of each workflow it names by reference. */
export type OpenedApp = SavedApp & { workflows: ResolvedWorkflows };

export interface SavedAppListItem {
  id: string;
  title: string;
  description?: string;
  showInNav?: boolean;
  icon?: string;
  managed?: boolean;
  package?: { name: string };
  updatedAt?: string;
}

const toStored = (input: SavedAppInput): StoredApp => input;

const toSavedApp = (object: {
  id: string;
  attributes: StoredApp;
  managed?: boolean;
  updated_at?: string;
}): SavedApp => ({
  id: object.id,
  ...object.attributes,
  ...(object.managed ? { managed: true } : {}),
  ...(object.updated_at ? { updatedAt: object.updated_at } : {}),
});

const openApp = async (client: SavedObjectsClientContract, id: string): Promise<OpenedApp> => {
  const app = toSavedApp(await client.get<StoredApp>(CUSTOM_APP_SAVED_OBJECT_TYPE, id));
  const spaceId = SavedObjectsUtils.namespaceIdToString(client.getCurrentNamespace());
  return { ...app, workflows: resolveWorkflowRefs(app, spaceId) };
};

/** A package's app is changed by the package: a change made here would be lost on its upgrade. */
const assertNotManaged = async (client: SavedObjectsClientContract, id: string) => {
  const { managed, attributes } = await client.get<StoredApp>(CUSTOM_APP_SAVED_OBJECT_TYPE, id);
  if (managed) {
    const owner = attributes.package ? `the ${attributes.package.name} package` : 'a package';
    throw SavedObjectsErrorHelpers.decorateBadRequestError(
      new Error(
        `This app is managed by ${owner} and cannot be changed or deleted. Clone it to customize.`
      )
    );
  }
};

/** What the routes do, with the saved objects client of the request, which enforces privileges. */
export const createSavedAppsService = (client: SavedObjectsClientContract) => ({
  create: async (input: SavedAppInput): Promise<SavedApp> =>
    toSavedApp(await client.create<StoredApp>(CUSTOM_APP_SAVED_OBJECT_TYPE, toStored(input))),

  get: (id: string): Promise<OpenedApp> => openApp(client, id),

  update: async (id: string, input: SavedAppInput): Promise<OpenedApp> => {
    await assertNotManaged(client, id);
    const stored = toStored(input);
    await client.update<StoredApp>(CUSTOM_APP_SAVED_OBJECT_TYPE, id, stored);
    // Read back, so that the response is what is stored and not what was sent.
    return openApp(client, id);
  },

  remove: async (id: string): Promise<void> => {
    await assertNotManaged(client, id);
    await client.delete(CUSTOM_APP_SAVED_OBJECT_TYPE, id);
  },

  find: async ({
    search,
    page,
    perPage,
  }: {
    search?: string;
    page: number;
    perPage: number;
  }): Promise<{ apps: SavedAppListItem[]; total: number; page: number; perPage: number }> => {
    const result = await client.find<StoredApp>({
      type: CUSTOM_APP_SAVED_OBJECT_TYPE,
      page,
      perPage,
      sortField: 'updated_at',
      sortOrder: 'desc',
      // Only what a list shows: the documents can be large.
      fields: ['title', 'description', 'showInNav', 'icon', 'package'],
      ...(search ? { search: `${search}*`, searchFields: ['title'] } : {}),
    });

    return {
      apps: result.saved_objects.map(({ id, attributes, managed, updated_at: updatedAt }) => ({
        id,
        title: attributes.title,
        ...(attributes.description === undefined ? {} : { description: attributes.description }),
        ...(attributes.showInNav === undefined ? {} : { showInNav: attributes.showInNav }),
        ...(attributes.icon === undefined ? {} : { icon: attributes.icon }),
        ...(managed ? { managed: true } : {}),
        ...(attributes.package === undefined ? {} : { package: attributes.package }),
        ...(updatedAt ? { updatedAt } : {}),
      })),
      total: result.total,
      page: result.page,
      perPage: result.per_page,
    };
  },
});

export type SavedAppsService = ReturnType<typeof createSavedAppsService>;
