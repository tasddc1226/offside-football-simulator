// Compare computed fingerprints with existing store builds; never override runtimeVersion.
export const STORE_RUNTIMES = Object.freeze({
  ios: '5493303a029b8c9943bb72166e91ffb14a5f1a6b', // 1.1.3(17), build05b6cd35-42f5-4ec6-9232-ce7a0cc92a9c
  android: 'bdab3b94672d81e85bba4b2a98ca7a8b825d8a66', // 1.1.3(21), builde67af8ac-804e-4ed8-baa9-00ff75e7ab54
});
export function assertStoreRuntime(platform, fingerprint) {
  if (!STORE_RUNTIMES[platform] || STORE_RUNTIMES[platform] !== fingerprint)
    throw new Error(
      `${platform}: computed native fingerprint differs from the reviewed1.1.3 store build; do not publish (${fingerprint})`,
    );
}
if (process.argv[1]?.endsWith('/ota-store-runtime.mjs')) {
  assertStoreRuntime(process.argv[2], process.argv[3]);
  console.log(`${process.argv[2]}: computed fingerprint matches the reviewed1.1.3 store runtime`);
}
