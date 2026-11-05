/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { isEqual } from 'lodash';
import type { AppDeepLink, CoreStart } from '@kbn/core/public';
import type { NodeDefinition } from '@kbn/core-chrome-browser';
import type { CustomAppDeepLinkId } from '@kbn/deeplinks-shared';
import {
  BehaviorSubject,
  distinctUntilChanged,
  fromEvent,
  map,
  merge,
  switchMap,
  from,
  catchError,
  EMPTY,
  debounceTime,
  takeUntil,
  Subject,
} from 'rxjs';
import type { Observable } from 'rxjs';
import { CUSTOM_APP_APPLICATION_ID } from '../common/constants';
import type { SavedAppListItem, SavedAppsClient } from './application/saved_apps_client';

/** An installed app that asked to be listed in the side navigation. */
export interface NavApp {
  id: string;
  title: string;
}

/** As many as a single page of the list returns: enough for a demo, and the browser filters. */
const MAX_LISTED_APPS = 100;

export const toNavApps = (apps: SavedAppListItem[]): NavApp[] =>
  apps
    .filter(({ showInNav }) => showInNav === true)
    .map(({ id, title }) => ({ id, title }))
    .sort((a, b) => a.title.localeCompare(b.title));

/** One deep link of the standalone application per app, which core turns into a nav link. */
export const toDeepLinks = (apps: NavApp[]): AppDeepLink[] =>
  apps.map(({ id, title }) => ({
    id,
    title,
    path: `/view/${encodeURIComponent(id)}`,
    visibleIn: ['classicSideNav', 'projectSideNav', 'globalSearch'],
  }));

/** The id of the nav link core makes of an app's deep link. */
export const toDeepLinkId = (id: string): CustomAppDeepLinkId =>
  `${CUSTOM_APP_APPLICATION_ID}:${id}`;

/** What a solution adds to its navigation tree for each app. */
export const toNavItems = (apps: NavApp[]): NodeDefinition[] =>
  apps.map(({ id }) => ({
    link: toDeepLinkId(id),
    icon: 'apps',
  }));

/**
 * Keeps the list of apps in the side navigation. Nothing tells the browser when Fleet installs an
 * app, so the list is read again when the user moves between applications, when the window gets
 * the focus back, and when `refresh` is called.
 */
export const createNavApps = ({
  application,
  client,
}: {
  application: CoreStart['application'];
  client: SavedAppsClient;
}) => {
  const apps$ = new BehaviorSubject<NavApp[]>([]);
  const refresh$ = new Subject<void>();
  const stop$ = new Subject<void>();

  const focus$: Observable<unknown> =
    typeof window === 'undefined' ? EMPTY : fromEvent(window, 'focus');

  merge(application.currentAppId$, focus$, refresh$)
    .pipe(
      debounceTime(100),
      switchMap(() =>
        from(client.find({ page: 1, perPage: MAX_LISTED_APPS })).pipe(
          map(({ apps }) => toNavApps(apps)),
          // The navigation keeps what it had: an app that cannot be listed is not worth an error.
          catchError(() => EMPTY)
        )
      ),
      distinctUntilChanged(isEqual),
      takeUntil(stop$)
    )
    .subscribe(apps$);

  return {
    apps$: apps$.asObservable(),
    refresh: () => refresh$.next(),
    stop: () => stop$.next(),
  };
};
