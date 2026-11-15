// Import shim in a CommonJS-compatible way to avoid needing esModuleInterop in tsconfig
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mod = require("use-sync-external-store/shim/with-selector");
const useSyncExternalStoreWithSelector = (mod && (mod.default ?? mod)) as any;
export { useSyncExternalStoreWithSelector };
export default useSyncExternalStoreWithSelector;
