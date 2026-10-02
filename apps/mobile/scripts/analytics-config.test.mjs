import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import configure from '../app.config.js';
const base = JSON.parse(fs.readFileSync(new URL('../app.json', import.meta.url), 'utf8')).expo;
const keys = [
  'OFFSIDE_NATIVE_ANALYTICS_ENABLED',
  'OFFSIDE_ANALYTICS_ENVIRONMENT',
  'OFFSIDE_FIREBASE_IOS_FILE',
  'OFFSIDE_FIREBASE_ANDROID_FILE',
];
function config(values = {}) {
  const previous = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  try {
    for (const k of keys) {
      if (values[k] === undefined) delete process.env[k];
      else process.env[k] = values[k];
    }
    return configure({ config: structuredClone(base) });
  } finally {
    for (const k of keys) {
      if (previous[k] === undefined) delete process.env[k];
      else process.env[k] = previous[k];
    }
  }
}
test('unconfigured builds deactivate collection and remove advertising permission', () => {
  const c = config();
  assert.equal(c.extra.nativeAnalytics.enabled, false);
  assert.equal(c.ios.infoPlist.FIREBASE_ANALYTICS_COLLECTION_DEACTIVATED, true);
  assert.ok(c.android.blockedPermissions.includes('com.google.android.gms.permission.AD_ID'));
  assert.ok(!c.plugins.includes('@react-native-firebase/app'));
  assert.deepEqual(c.runtimeVersion, { policy: 'fingerprint' });
});
test('enabled config needs explicit environment and actual platform file', () => {
  assert.throws(() => config({ OFFSIDE_NATIVE_ANALYTICS_ENABLED: 'true' }), /ENVIRONMENT/);
  assert.throws(
    () =>
      config({ OFFSIDE_NATIVE_ANALYTICS_ENABLED: 'true', OFFSIDE_ANALYTICS_ENVIRONMENT: 'test' }),
    /registered Firebase/,
  );
  assert.throws(
    () => config({ OFFSIDE_FIREBASE_IOS_FILE: '/does-not-exist/offside.plist' }),
    /does not exist/,
  );
});
test('platform gating does not enable unconfigured platforms', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'offside-config-test-'));
  const file = path.join(dir, 'path-only-fixture');
  fs.writeFileSync(file, ''); // Only tests path gating; no Firebase identifiers or native build.
  try {
    const c = config({
      OFFSIDE_NATIVE_ANALYTICS_ENABLED: 'true',
      OFFSIDE_ANALYTICS_ENVIRONMENT: 'test',
      OFFSIDE_FIREBASE_IOS_FILE: file,
    });
    assert.deepEqual(c.extra.nativeAnalytics, {
      enabled: true,
      environment: 'test',
      ios: true,
      android: false,
    });
    assert.equal(c.ios.infoPlist.FIREBASE_ANALYTICS_COLLECTION_DEACTIVATED, false);
    assert.ok(c.plugins.includes('@react-native-firebase/app'));
    assert.deepEqual(
      c.plugins.find((p) => Array.isArray(p) && p[0] === '@react-native-firebase/analytics')[1],
      { ios: { withoutAdIdSupport: true } },
    );
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});
test('SDK build defaults deny all collection and automatic screen reporting', () => {
  const settings = JSON.parse(
    fs.readFileSync(new URL('../firebase.json', import.meta.url), 'utf8'),
  )['react-native'];
  for (const [key, value] of Object.entries(settings)) assert.equal(value, false, key);
});
