/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

export const HOME_APP_ID = 'home';

export const CUSTOM_APP_ID = 'customApp';

export type AppId = typeof HOME_APP_ID | typeof CUSTOM_APP_ID;

/** An installed custom app, which the custom apps application publishes as a deep link. */
export type CustomAppDeepLinkId = `${typeof CUSTOM_APP_ID}:${string}`;

export type DeepLinkId = AppId | CustomAppDeepLinkId;
