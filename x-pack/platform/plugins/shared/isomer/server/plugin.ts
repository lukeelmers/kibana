/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { Logger, Plugin, PluginInitializerContext } from '@kbn/core/server';
import type { KibanaIsomerRuntime, PrimitivePack } from '@kbn/isomer';

export interface IsomerPluginSetup {
  /** Adds a primitive pack to the shared runtime. The loader runs when the runtime is first built. */
  registerPack: (load: () => Promise<PrimitivePack>) => void;
}

export interface IsomerPluginStart {
  /** Loads the shared runtime and primitive packs on first use. */
  getRuntime: () => Promise<KibanaIsomerRuntime>;
}

const createRuntime = async (
  loaders: Array<() => Promise<PrimitivePack>>
): Promise<KibanaIsomerRuntime> => {
  const [{ createKibanaIsomerRuntime }, { componentsPack }, ...packs] = await Promise.all([
    import('@kbn/isomer'),
    import('@kbn/isomer-components'),
    ...loaders.map((load) => load()),
  ]);
  return createKibanaIsomerRuntime({ packs: [componentsPack, ...packs] });
};

export class IsomerPlugin implements Plugin<IsomerPluginSetup, IsomerPluginStart> {
  private readonly logger: Logger;
  private readonly packLoaders: Array<() => Promise<PrimitivePack>> = [];
  private started = false;
  private runtime?: Promise<KibanaIsomerRuntime>;

  constructor(initializerContext: PluginInitializerContext) {
    this.logger = initializerContext.logger.get();
  }

  setup(): IsomerPluginSetup {
    return {
      registerPack: (load) => {
        if (this.started) {
          throw new Error('Isomer packs must be registered during setup.');
        }
        this.packLoaders.push(load);
      },
    };
  }

  start(): IsomerPluginStart {
    this.started = true;
    return { getRuntime: this.getRuntime };
  }

  stop() {}

  private readonly getRuntime = (): Promise<KibanaIsomerRuntime> => {
    this.runtime ??= createRuntime(this.packLoaders).then(
      (runtime) => {
        this.logger.debug(
          `Built the Isomer runtime with ${this.packLoaders.length + 1} primitive packs.`
        );
        return runtime;
      },
      (error) => {
        this.runtime = undefined;
        throw error;
      }
    );
    return this.runtime;
  };
}
