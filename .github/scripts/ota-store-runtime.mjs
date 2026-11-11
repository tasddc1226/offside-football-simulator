// Compare computed fingerprints with existing store builds; never override runtimeVersion.
// T-11-600 1.1.6 added @shopify/react-native-skia (lounge field). The fingerprint also hashes app.config.js and
// plugins/withAdMediation.js (comments included), so changing them needs a new store build.
// T-11-563 1.1.7 added the Meta app events module (Android native). 1.1.6, 1.1.5 and 1.1.4 builds keep receiving
// updates through prepare-ota-legacy.mjs. 1.1.2 and 1.1.3 OTA ended (T-11-559).
// T-11-698 1.1.8 added expo-tracking-transparency (iOS ATT). 1.1.7 moved to the legacy lanes.
// The 1.1.8 runtimes are filled after the store builds finish (eas build:list).
export const STORE_RUNTIMES = Object.freeze({
  ios: 'TODO-1.1.8-ios', // 1.1.8
  android: 'TODO-1.1.8-android', // 1.1.8
});
export function assertStoreRuntime(platform, fingerprint) {
  if (!STORE_RUNTIMES[platform] || STORE_RUNTIMES[platform] !== fingerprint)
    throw new Error(
      `${platform}: computed native fingerprint differs from the reviewed 1.1.8 store build; do not publish (${fingerprint})`,
    );
}
if (process.argv[1]?.endsWith('/ota-store-runtime.mjs')) {
  assertStoreRuntime(process.argv[2], process.argv[3]);
  console.log(`${process.argv[2]}: computed fingerprint matches the reviewed 1.1.8 store runtime`);
}
