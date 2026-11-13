// Compare computed fingerprints with existing store builds; never override runtimeVersion.
// T-11-600 1.1.6 added @shopify/react-native-skia (lounge field). The fingerprint also hashes app.config.js and
// plugins/withAdMediation.js (comments included), so changing them needs a new store build.
// T-11-563 1.1.7 added the Meta app events module (Android native).
// T-11-698 1.1.8 added expo-tracking-transparency (iOS ATT). 1.1.7 moved to the legacy lane (prepare-ota-legacy.mjs).
// 1.1.2 and 1.1.3 OTA ended in T-11-559, 1.1.4 to 1.1.6 in T-11-719.
export const STORE_RUNTIMES = Object.freeze({
  ios: '6b0fc3a98f174fbdb4e0a6182a0796d1daec4d47', // 1.1.8 iOS build 25
  android: 'd6b29abc7828406cba1120a9f24a8de8d6dfe2b2', // 1.1.8 Android build 28
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
