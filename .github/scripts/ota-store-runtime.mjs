// Compare computed fingerprints with existing store builds; never override runtimeVersion.
// T-11-453 1.1.4(AdMob mediation adapters). The fingerprints were computed locally with the EAS production environment;
// the deploy still requires a finished production build with the same runtime, so merge only after the 1.1.4 builds.
// 1.1.3 builds keep receiving updates through prepare-ota-113.mjs.
export const STORE_RUNTIMES = Object.freeze({
  ios: 'c11a78e1f06e5e448789e5bd6624a06e38452c4b', // 1.1.4
  android: '031d6efab3abac0045831c67b23b03c887aaab97', // 1.1.4
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
