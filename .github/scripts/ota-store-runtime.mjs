// Compare computed fingerprints with existing store builds; never override runtimeVersion.
// T-11-600 1.1.6 added @shopify/react-native-skia (lounge field). The fingerprint also hashes app.config.js and
// plugins/withAdMediation.js (comments included), so changing them needs a new store build.
// T-11-563 1.1.7 added the Meta app events module (Android native).
// T-11-698 1.1.8 added expo-tracking-transparency (iOS ATT). T-11-738 1.1.10 added expo-audio (result sounds). 1.1.7 moved to the legacy lane (prepare-ota-legacy.mjs).
// T-11-750 Android 1.1.11 added the Reanimated ANR pnpm patch (Android only; iOS stays on 1.1.10).
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
    version: '1.1.11',
    source: '0880b145cc2146a33f84ea693edd601424832b2e',
    runtime: '95bfcf3a45de2e324e6df073992d359fcc5e0605', // Android build 32; 20% on 2026-11-18, 100% since 2026-11-19
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
