// Compare computed fingerprints with existing store builds; never override runtimeVersion.
// T-11-600 1.1.6 added @shopify/react-native-skia (lounge field). The fingerprint also hashes app.config.js and
// plugins/withAdMediation.js (comments included), so changing them needs a new store build.
// T-11-563 1.1.7 added the Meta app events module (Android native).
// T-11-698 1.1.8 added expo-tracking-transparency (iOS ATT). T-11-738 1.1.10 added expo-audio (result sounds). 1.1.7 moved to the legacy lane (prepare-ota-legacy.mjs).
// 1.1.2 and 1.1.3 OTA ended in T-11-559, 1.1.4 to 1.1.6 in T-11-719.
// Change each platform only after its store release is available. While a newer binary is in review,
// the disposable OTA checkout restores this exact native snapshot and keeps the latest JavaScript.
export const STORE_BUILDS = Object.freeze({
  ios: {
    version: '1.1.10',
    source: 'e93fbfa5d95759a09a03b01756070e67eb64121b',
    runtime: '9c5b90dbbde46a6fccbd1864269aaeb199fb88e9', // iOS build 36; public since 2026-11-18
  },
  android: {
    version: '1.1.10',
    source: 'e93fbfa5d95759a09a03b01756070e67eb64121b',
    runtime: '5390fc5af2f92099eb176b14882b2989ac98e2a4', // Android build 31; public since 2026-11-17
  },
});
export const STORE_RUNTIMES = Object.freeze(
  Object.fromEntries(
    Object.entries(STORE_BUILDS).map(([platform, build]) => [platform, build.runtime]),
  ),
);
export function assertStoreRuntime(platform, fingerprint) {
  if (!STORE_RUNTIMES[platform] || STORE_RUNTIMES[platform] !== fingerprint)
    throw new Error(
      `${platform}: computed native fingerprint differs from the reviewed ${STORE_BUILDS[platform]?.version ?? 'unknown'} store build; do not publish (${fingerprint})`,
    );
}
if (process.argv[1]?.endsWith('/ota-store-runtime.mjs')) {
  assertStoreRuntime(process.argv[2], process.argv[3]);
  console.log(
    `${process.argv[2]}: computed fingerprint matches the reviewed ${STORE_BUILDS[process.argv[2]].version} store runtime`,
  );
}
