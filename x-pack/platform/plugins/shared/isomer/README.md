# Isomer

Hosts Kibana's shared Isomer runtime with its primitive packs. The plugin runs on the server and in the browser, is always enabled, and registers no routes, saved objects, or UI.

Its start contract carries `getRuntime()`, which resolves a `createKibanaIsomerRuntime` with `@kbn/isomer-components`' `componentsPack`. Primitive schemas stay in memory for the life of the process once built, so the runtime and its packs load on the first call rather than at startup, and every later call shares that runtime. Call `getRuntime()` when a request needs it, not during `setup` or `start`.

Feature plugins add their own primitive packs from `setup` with `registerPack(load)`, where `load` resolves a `PrimitivePack`, typically through a dynamic `import()`. The runtime composes the components pack with every registered pack the first time it is built. Registering after `start` throws.

The browser plugin has the same contract. Its `getRuntime()` imports `@kbn/isomer` and the packs in an async chunk, since the runtime imports `react-dom/server`.
