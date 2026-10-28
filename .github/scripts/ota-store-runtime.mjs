// Compare computed fingerprints with existing store builds; never override runtimeVersion.
// T-11-516 1.1.5(app version only). The fingerprint also hashes app.config.js and plugins/withAdMediation.js
// (comments included), so changing them needs a new store build.
// 1.1.4 builds keep receiving updates through prepare-ota-114.mjs. 1.1.2 and 1.1.3 OTA ended (T-11-559).
export const STORE_RUNTIMES = Object.freeze({
  ios: 'ca480d51e4d9afdae6f87685cc601133c9d16f1b', // 1.1.5(19), build f86ccd94-410a-4882-91c3-00773b9683b9
  android: '3fa1453aa50c2866ba47ba7dd040975153bf686a', // 1.1.5(23), build 06f70f81-3fa9-4c21-980e-7d46a6e064fb
});
export function assertStoreRuntime(platform, fingerprint) {
  if (!STORE_RUNTIMES[platform] || STORE_RUNTIMES[platform] !== fingerprint)
    throw new Error(
      `${platform}: computed native fingerprint differs from the reviewed 1.1.5 store build; do not publish (${fingerprint})`,
    );
}
if (process.argv[1]?.endsWith('/ota-store-runtime.mjs')) {
  assertStoreRuntime(process.argv[2], process.argv[3]);
  console.log(`${process.argv[2]}: computed fingerprint matches the reviewed 1.1.5 store runtime`);
}
