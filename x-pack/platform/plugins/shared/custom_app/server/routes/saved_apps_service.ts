/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { SavedObjectsClientContract } from '@kbn/core/server';
import { CUSTOM_APP_SAVED_OBJECT_TYPE } from '../../common/constants';
import type { SavedAppInput } from '../../common/saved_app_schema';

/** An app as it is written, and the package it was installed from, if it was. */
type StoredApp = SavedAppInput & { package?: { name: string } };

export type SavedApp = StoredApp & {
  id: string;
  updatedAt?: string;
};

export interface SavedAppListItem {
  id: string;
  title: string;
  description?: string;
  showInNav?: boolean;
  icon?: string;
  updatedAt?: string;
}

const toStored = (input: SavedAppInput): StoredApp => input;

const toSavedApp = (object: {
  id: string;
  attributes: StoredApp;
  updated_at?: string;
}): SavedApp => ({
  id: object.id,
  ...object.attributes,
  ...(object.updated_at ? { updatedAt: object.updated_at } : {}),
});

/** What the routes do, with the saved objects client of the request, which enforces privileges. */
export const createSavedAppsService = (client: SavedObjectsClientContract) => ({
  create: async (input: SavedAppInput): Promise<SavedApp> =>
    toSavedApp(await client.create<StoredApp>(CUSTOM_APP_SAVED_OBJECT_TYPE, toStored(input))),

  get: async (id: string): Promise<SavedApp> =>
    toSavedApp(await client.get<StoredApp>(CUSTOM_APP_SAVED_OBJECT_TYPE, id)),

  update: async (id: string, input: SavedAppInput): Promise<SavedApp> => {
    const stored = toStored(input);
    await client.update<StoredApp>(CUSTOM_APP_SAVED_OBJECT_TYPE, id, stored);
    // Read back, so that the response is what is stored and not what was sent.
    return toSavedApp(await client.get<StoredApp>(CUSTOM_APP_SAVED_OBJECT_TYPE, id));
  },

  remove: async (id: string): Promise<void> => {
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
      fields: ['title', 'description', 'showInNav', 'icon'],
      ...(search ? { search: `${search}*`, searchFields: ['title'] } : {}),
    });

    return {
      apps: result.saved_objects.map(({ id, attributes, updated_at: updatedAt }) => ({
        id,
        title: attributes.title,
        ...(attributes.description === undefined ? {} : { description: attributes.description }),
        ...(attributes.showInNav === undefined ? {} : { showInNav: attributes.showInNav }),
        ...(attributes.icon === undefined ? {} : { icon: attributes.icon }),
        ...(updatedAt ? { updatedAt } : {}),
      })),
      total: result.total,
      page: result.page,
      perPage: result.per_page,
    };
  },
});

export type SavedAppsService = ReturnType<typeof createSavedAppsService>;
