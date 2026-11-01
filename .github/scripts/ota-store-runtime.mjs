// Compare computed fingerprints with existing store builds; never override runtimeVersion.
// T-11-600 1.1.6 added @shopify/react-native-skia (lounge field). The fingerprint also hashes app.config.js and
// plugins/withAdMediation.js (comments included), so changing them needs a new store build.
// 1.1.5 and 1.1.4 builds keep receiving updates through prepare-ota-legacy.mjs. 1.1.2 and 1.1.3 OTA ended (T-11-559).
export const STORE_RUNTIMES = Object.freeze({
  ios: 'dfd47f447f667c81816a87122937ef8384f2324e', // 1.1.6
  android: '788cf73ac02df52f5b15fcdeb398a70e94ff3f3f', // 1.1.6
});
export function assertStoreRuntime(platform, fingerprint) {
  if (!STORE_RUNTIMES[platform] || STORE_RUNTIMES[platform] !== fingerprint)
    throw new Error(
      `${platform}: computed native fingerprint differs from the reviewed 1.1.6 store build; do not publish (${fingerprint})`,
    );
}
if (process.argv[1]?.endsWith('/ota-store-runtime.mjs')) {
  assertStoreRuntime(process.argv[2], process.argv[3]);
  console.log(`${process.argv[2]}: computed fingerprint matches the reviewed 1.1.6 store runtime`);
}
