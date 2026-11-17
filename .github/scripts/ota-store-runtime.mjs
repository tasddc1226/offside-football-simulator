// Compare computed fingerprints with existing store builds; never override runtimeVersion.
// T-11-600 1.1.6 added @shopify/react-native-skia (lounge field). The fingerprint also hashes app.config.js and
// plugins/withAdMediation.js (comments included), so changing them needs a new store build.
// T-11-563 1.1.7 added the Meta app events module (Android native).
// T-11-698 1.1.8 added expo-tracking-transparency (iOS ATT). 1.1.7 moved to the legacy lane (prepare-ota-legacy.mjs).
// 1.1.2 and 1.1.3 OTA ended in T-11-559, 1.1.4 to 1.1.6 in T-11-719.
// Change each platform only after its store release is available. While a newer binary is in review,
// the disposable OTA checkout restores this exact native snapshot and keeps the latest JavaScript.
export const STORE_BUILDS = Object.freeze({
  ios: {
    version: '1.1.8',
    source: '05c79da6d0fd287c7a9bc9f6e7851e85ef2a8af8',
    runtime: '6b0fc3a98f174fbdb4e0a6182a0796d1daec4d47', // iOS build 25
  },
  android: {
    version: '1.1.9',
    source: '59fb22277f64b5150235e56a187224b1fcef368c',
    runtime: '84aa755bbc152b4088e0a0e4017b4c009552ad70', // Android build 30; public since 2026-11-16
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
