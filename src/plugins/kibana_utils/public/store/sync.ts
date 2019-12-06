/*
 * Licensed to Elasticsearch B.V. under one or more contributor
 * license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { MonoTypeOperatorFunction, Observable, Subscription } from 'rxjs';
import { distinctUntilChanged, map, share, skip, startWith } from 'rxjs/operators';
import { createUrlControls, getStateFromUrl, IUrlControls, setStateToUrl } from '../url';

/**
 * Configuration of StateSync utility
 * State - interface for application provided state to sync with storage
 */
export interface IStateSyncConfig<State extends BaseState = BaseState> {
  /**
   * Storage key to use for syncing,
   * e.g. syncKey '_a' should sync state to ?_a query param
   */
  syncKey: string;
  /**
   * Store to keep in sync with storage, have to implement IStore interface
   * The idea is that ./store/create_store.ts should be used as a state container,
   * but it is also possible to implement own custom container for advanced use cases
   */
  store: IStore<State>;
  /**
   * Sync strategy to use,
   * Sync strategy is responsible for serialising / deserialising and persisting / retrieving stored state
   * 2 strategies available now out of the box, which replicate what State (AppState, GlobalState) implemented:
   *
   * SyncStrategy.Url: the same as old persisting of expanded state in rison format to the url
   * SyncStrategy.HashedUrl: the same as old persisting of hashed state using sessionStorage for storing expanded state
   *
   * Possible to provide own custom SyncStrategy by implementing ISyncStrategy
   *
   * SyncStrategy.Url is default
   */
  syncStrategy?: SyncStrategy | ISyncStrategy;

  /**
   * During app bootstrap we could have default app state and data in storage to be out of sync,
   * initialTruthSource indicates who's values to consider as source of truth
   *
   * InitialTruthSource.Store - Application state take priority over storage state
   * InitialTruthSource.Storage (default) - Storage state take priority over Application state
   * InitialTruthSource.None - skip initial syncing do nothing
   */
  initialTruthSource?: InitialTruthSource;
}

/**
 * To use stateSync util application have to pass state container which implements IStore interface.
 * The idea is that ./store/create_store.ts should be used as a state container by default,
 * but it is also possible to implement own custom container for advanced use cases
 */
export type BaseState = Record<string, unknown>;
export interface IStore<State extends BaseState = BaseState> {
  get: () => State;
  set: (state: State) => void;
  state$: Observable<State>;
}

/**
 * During app bootstrap we could have default app state and data in storage to be out of sync,
 * initialTruthSource indicates who's values to consider as source of truth
 *
 * InitialTruthSource.Store - Application state take priority over storage state
 * InitialTruthSource.Storage (default) - Storage state take priority over Application state
 * InitialTruthSource.None - skip initial syncing do nothing
 */
export enum InitialTruthSource {
  Store,
  Storage,
  None,
}

/**
 * Sync strategy is responsible for serialising / deserialising and persisting / retrieving stored state
 * 2 strategies available now out of the box, which replicate what State (AppState, GlobalState) implemented:
 *
 * SyncStrategy.Url: the same as old persisting of expanded state in rison format to the url
 * SyncStrategy.HashedUrl: the same as old persisting of hashed state using sessionStorage for storing expanded state
 *
 * Possible to provide own custom SyncStrategy by implementing ISyncStrategy
 *
 * SyncStrategy.Url is default
 */
export enum SyncStrategy {
  Url,
  HashedUrl,
}

/**
 * Any SyncStrategy have to implement ISyncStrategy interface
 * SyncStrategy is responsible for:
 * * state serialisation / deserialization
 * * persisting to and retrieving from storage
 *
 * For an example take a look at already implemented URL sync strategies
 */
interface ISyncStrategy<State extends BaseState = BaseState> {
  /**
   * Take in a state object, should serialise and persist
   */
  // TODO: replace sounds like something url specific ...
  toStorage: (syncKey: string, state: State, opts: { replace: boolean }) => Promise<void>;
  /**
   * Should retrieve state from the storage and deserialize it
   */
  fromStorage: (syncKey: string) => Promise<State>;
  /**
   * Should notify when the storage has changed
   */
  storageChange$?: (syncKey: string) => Observable<State>;
}

/**
 * Implements syncing to/from url strategies.
 * Replicates what was implemented in state (AppState, GlobalState)
 * Both expanded and hashed use cases
 */
const createUrlSyncStrategyFactory = (
  { useHash = false }: { useHash: boolean } = { useHash: false },
  { updateAsync: updateUrlAsync, listen: listenUrl }: IUrlControls = createUrlControls()
): ISyncStrategy => {
  return {
    toStorage: async (
      syncKey: string,
      state: BaseState,
      { replace = false } = { replace: false }
    ) => {
      await updateUrlAsync(
        currentUrl => setStateToUrl(syncKey, state, { useHash }, currentUrl),
        replace
      );
    },
    fromStorage: async syncKey => getStateFromUrl(syncKey),
    storageChange$: (syncKey: string) =>
      new Observable(observer => {
        const unlisten = listenUrl(() => {
          observer.next();
        });

        return () => {
          unlisten();
        };
      }).pipe(
        map(() => getStateFromUrl(syncKey)),
        distinctUntilChangedWithInitialValue(getStateFromUrl(syncKey), shallowEqual),
        share()
      ),
  };
};

export function isSyncStrategy(
  syncStrategy: SyncStrategy | ISyncStrategy | void
): syncStrategy is ISyncStrategy {
  return typeof syncStrategy === 'object';
}

// strategies provided out of the box
const createStrategies: () => {
  [key in SyncStrategy]: ISyncStrategy;
} = () => {
  const urlControls = createUrlControls();
  return {
    [SyncStrategy.Url]: createUrlSyncStrategyFactory({ useHash: false }, urlControls),
    [SyncStrategy.HashedUrl]: createUrlSyncStrategyFactory({ useHash: true }, urlControls),
    // Other SyncStrategies: LocalStorage, es, somewhere else...
  };
};

/**
 * Utility for syncing application state wrapped in IStore container
 * with some kind of storage (e.g. URL)
 */
// 1. the simplest use case
// $scope.destroyStateSync = syncState({
//   syncKey: '_s',
//   store,
// });
//
// 2. conditionally picking sync strategy
// $scope.destroyStateSync = syncState({
//   syncKey: '_s',
//   store,
//   syncStrategy: config.get('state:storeInSessionStorage') ? SyncStrategy.HashedUrl : SyncStrategy.Url
// });
//
// 3. implementing custom sync strategy
// const localStorageSyncStrategy = {
//   toStorage: (syncKey, state) => localStorage.setItem(syncKey, JSON.stringify(state)),
//   fromStorage: (syncKey) => localStorage.getItem(syncKey) ? JSON.parse(localStorage.getItem(syncKey)) : null
// };
// $scope.destroyStateSync = syncState({
//   syncKey: '_s',
//   store,
//   syncStrategy: localStorageSyncStrategy
// });
//
// 4. syncing only part of state
// const stateToStorage = (s) => ({ tab: s.tab });
// $scope.destroyStateSync = syncState({
//   syncKey: '_s',
//   store: {
//     get: () => stateToStorage(store.get()),
//     set: store.set(({ tab }) => ({ ...store.get(), tab }),
//       state$: store.state$.pipe(map(stateToStorage))
// }
// });
//
// 5. transform state before serialising
// this could be super useful for backward compatibility
// const stateToStorage = (s) => ({ t: s.tab });
// $scope.destroyStateSync = syncState({
//   syncKey: '_s',
//   store: {
//     get: () => stateToStorage(store.get()),
//     set: ({ t }) => store.set({ ...store.get(), tab: t }),
//     state$: store.state$.pipe(map(stateToStorage))
//   }
// });
//
// 6. multiple different sync configs
// const stateAToStorage = s => ({ t: s.tab });
// const stateBToStorage = s => ({ f: s.fieldFilter, i: s.indexedFieldTypeFilter, l: s.scriptedFieldLanguageFilter });
// $scope.destroyStateSync = syncState([
//   {
//     syncKey: '_a',
//     syncStrategy: SyncStrategy.Url,
//     store: {
//       get: () => stateAToStorage(store.get()),
//       set: s => store.set(({ ...store.get(), tab: s.t })),
//       state$: store.state$.pipe(map(stateAToStorage))
//     },
//   },
//   {
//     syncKey: '_b',
//     syncStrategy: SyncStrategy.HashedUrl,
//     store: {
//       get: () => stateBToStorage(store.get()),
//       set: s => store.set({
//         ...store.get(),
//         fieldFilter: s.f || '',
//         indexedFieldTypeFilter: s.i || '',
//         scriptedFieldLanguageFilter: s.l || ''
//       }),
//       state$: store.state$.pipe(map(stateBToStorage))
//     },
//   },
// ]);
export type DestroySyncStateFnType = () => void;
export function syncState(config: IStateSyncConfig[] | IStateSyncConfig): DestroySyncStateFnType {
  const stateSyncConfigs = Array.isArray(config) ? config : [config];
  const subscriptions: Subscription[] = [];

  const syncStrategies = createStrategies();

  stateSyncConfigs.forEach(stateSyncConfig => {
    const { toStorage, fromStorage, storageChange$ } = isSyncStrategy(stateSyncConfig.syncStrategy)
      ? stateSyncConfig.syncStrategy
      : syncStrategies[stateSyncConfig.syncStrategy || SyncStrategy.Url];

    // returned boolean indicates if update happen
    const updateState = async (): Promise<boolean> => {
      const storageState = await fromStorage(stateSyncConfig.syncKey);
      if (!storageState) {
        return false;
      }

      if (storageState) {
        stateSyncConfig.store.set(storageState);
        return true;
      }

      return false;
    };

    // returned boolean indicates if update happen
    const updateStorage = async ({ replace = false } = {}): Promise<boolean> => {
      const newStorageState = stateSyncConfig.store.get();
      await toStorage(stateSyncConfig.syncKey, newStorageState, { replace });
      return true;
    };

    // subscribe to state and storage updates
    subscriptions.push(
      stateSyncConfig.store.state$
        .pipe(distinctUntilChangedWithInitialValue(stateSyncConfig.store.get(), shallowEqual))
        .subscribe(() => {
          updateStorage();
        })
    );
    if (storageChange$) {
      subscriptions.push(
        storageChange$(stateSyncConfig.syncKey).subscribe(() => {
          updateState();
        })
      );
    }

    // initial syncing of store state and storage state
    const initialTruthSource = stateSyncConfig.initialTruthSource ?? InitialTruthSource.Storage;
    if (initialTruthSource === InitialTruthSource.Storage) {
      updateState().then(hasUpdated => {
        // if there is nothing by state key in storage
        // then we should fallback and consider state source of truth
        if (!hasUpdated) {
          updateStorage({ replace: true });
        }
      });
    } else if (initialTruthSource === InitialTruthSource.Store) {
      updateStorage({ replace: true });
    }
  });

  return () => {
    subscriptions.forEach(sub => sub.unsubscribe());
  };
}

// https://github.com/facebook/fbjs/blob/master/packages/fbjs/src/core/shallowEqual.js
function shallowEqual(objA: any, objB: any): boolean {
  if (is(objA, objB)) {
    return true;
  }

  if (typeof objA !== 'object' || objA === null || typeof objB !== 'object' || objB === null) {
    return false;
  }

  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);

  if (keysA.length !== keysB.length) {
    return false;
  }

  // Test for A's keys different from B.
  for (let i = 0; i < keysA.length; i++) {
    if (
      !Object.prototype.hasOwnProperty.call(objB, keysA[i]) ||
      !is(objA[keysA[i]], objB[keysA[i]])
    ) {
      return false;
    }
  }

  return true;
}

/**
 * IE11 does not support Object.is
 */
function is(x: any, y: any): boolean {
  if (x === y) {
    return x !== 0 || y !== 0 || 1 / x === 1 / y;
  } else {
    return x !== x && y !== y;
  }
}

function distinctUntilChangedWithInitialValue<T>(
  initialValue: T,
  compare?: (x: T, y: T) => boolean
): MonoTypeOperatorFunction<T> {
  return input$ => input$.pipe(startWith(initialValue), distinctUntilChanged(compare), skip(1));
}
