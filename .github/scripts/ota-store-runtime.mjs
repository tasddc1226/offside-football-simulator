// Compare computed fingerprints with existing store builds; never override runtimeVersion.
// T-11-453 1.1.4(AdMob mediation adapters). The fingerprint also hashes app.config.js and plugins/withAdMediation.js
// (comments included), so changing them needs a new store build.
// 1.1.3 builds keep receiving updates through prepare-ota-113.mjs.
export const STORE_RUNTIMES = Object.freeze({
  ios: 'a021d56e856d876b2fa7669de03cefefd274939b', // 1.1.4(18), build 6e13a542-e8fe-41f9-b4e8-00885926d71f
  android: '10d1210456e33bebbb0e7f90198a811ff21b59a0', // 1.1.4(22), build 785dc63b-19a2-446b-ae95-34dda089f737
});
export function assertStoreRuntime(platform, fingerprint) {
  if (!STORE_RUNTIMES[platform] || STORE_RUNTIMES[platform] !== fingerprint)
    throw new Error(
      `${platform}: computed native fingerprint differs from the reviewed 1.1.4 store build; do not publish (${fingerprint})`,
    );
}
if (process.argv[1]?.endsWith('/ota-store-runtime.mjs')) {
  assertStoreRuntime(process.argv[2], process.argv[3]);
  console.log(`${process.argv[2]}: computed fingerprint matches the reviewed 1.1.4 store runtime`);
}
