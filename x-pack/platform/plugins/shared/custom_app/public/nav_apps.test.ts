/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { BehaviorSubject, firstValueFrom, filter } from 'rxjs';
import { createNavApps, toDeepLinks, toNavApps, toNavItems } from './nav_apps';
import type { SavedAppsClient } from './application/saved_apps_client';

const listed = [
  { id: 'b', title: 'Beta', showInNav: true },
  { id: 'hidden', title: 'Hidden' },
  { id: 'a', title: 'Alpha', showInNav: true },
  { id: 'off', title: 'Off', showInNav: false },
];

describe('apps in the side navigation', () => {
  it('lists only the apps that ask for it, by title', () => {
    expect(toNavApps(listed)).toEqual([
      { id: 'a', title: 'Alpha' },
      { id: 'b', title: 'Beta' },
    ]);
  });

  it('makes a deep link per app that opens it', () => {
    expect(toDeepLinks([{ id: 'investigations', title: 'Investigations' }])).toEqual([
      {
        id: 'investigations',
        title: 'Investigations',
        path: '/view/investigations',
        visibleIn: ['classicSideNav', 'projectSideNav', 'globalSearch'],
      },
    ]);
  });

  it('points the nodes of a solution tree at those deep links', () => {
    expect(toNavItems([{ id: 'investigations', title: 'Investigations' }])).toEqual([
      { link: 'customApp:investigations', icon: 'apps' },
    ]);
  });

  it('reads the list again when the user moves to another application', async () => {
    jest.useFakeTimers();
    const currentAppId$ = new BehaviorSubject<string | undefined>('home');
    const find = jest
      .fn()
      .mockResolvedValueOnce({ apps: [] })
      .mockResolvedValueOnce({ apps: listed });
    const navApps = createNavApps({
      application: { currentAppId$ } as never,
      client: { find } as unknown as SavedAppsClient,
    });

    const nonEmpty = firstValueFrom(navApps.apps$.pipe(filter((apps) => apps.length > 0)));
    await jest.advanceTimersByTimeAsync(200);
    currentAppId$.next('observability-overview');
    await jest.advanceTimersByTimeAsync(200);

    expect(await nonEmpty).toHaveLength(2);
    expect(find).toHaveBeenCalledTimes(2);
    navApps.stop();
    jest.useRealTimers();
  });
});
