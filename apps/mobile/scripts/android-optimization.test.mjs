import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import configure from '../app.config.js';
import optimizer from '../plugins/withAndroidOptimization.js';

const base = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8')).expo;
test('native releases enable R8 and resource shrinking without changing iOS build properties', () => {
  const config = configure({ config: structuredClone(base) });
  const [, properties] = config.plugins.find(
    (p) => Array.isArray(p) && p[0] === 'expo-build-properties',
  );
  assert.deepEqual(properties.android, {
    enableMinifyInReleaseBuilds: true,
    enableShrinkResourcesInReleaseBuilds: true,
  });
  assert.deepEqual(properties.ios, { useFrameworks: 'dynamic' });
  assert.ok(config.plugins.includes('./plugins/withAndroidOptimization'));
});
test('prebuild switches the non-optimizing template default and preserves app keep rules', () => {
  const gradle = `proguardFiles getDefaultProguardFile('proguard-android.txt'), "proguard-rules.pro"`;
  const result = optimizer.optimizedDefaults(gradle);
  assert.equal(
    result,
    'proguardFiles getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro"',
  );
  assert.equal(optimizer.optimizedDefaults(result), result);
});
test('template changes fail closed instead of silently shipping without optimization', () => {
  assert.throws(
    () => optimizer.optimizedDefaults('proguardFiles "other-defaults.pro"'),
    /defaults changed/,
  );
});
