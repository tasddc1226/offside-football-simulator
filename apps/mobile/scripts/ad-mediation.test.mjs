import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import configure from '../app.config.js';
import mediation from '../plugins/withAdMediation.js';

const base = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8')).expo;
const ads = JSON.parse(
  readFileSync(
    new URL('../node_modules/react-native-google-mobile-ads/package.json', import.meta.url),
    'utf8',
  ),
).sdkVersions;

test('the app config applies the mediation adapters', () => {
  const config = configure({ config: structuredClone(base) });
  assert.ok(config.plugins.includes('./plugins/withAdMediation'));
});

// 어댑터 버전 앞자리는 네트워크 SDK 버전이고, 각 어댑터가 받는 Google Mobile Ads SDK 범위는 저장소 명세에서 골랐다.
// react-native-google-mobile-ads를 올려 고정 SDK가 바뀌면 어댑터를 다시 골라야 하므로 여기서 멈춘다.
test('adapters were chosen for the Google Mobile Ads SDK that react-native-google-mobile-ads pins', () => {
  assert.equal(ads.ios.googleMobileAds, '13.6.0');
  assert.equal(ads.android.googleMobileAds, '25.4.0');
});

test('Podfile gets the adapters inside the app target once', () => {
  const podfile = "target 'OFFSIDE' do\n  use_expo_modules!\n  config = use_native_modules!\nend\n";
  const once = mediation.podfile(podfile);
  for (const [name, version] of Object.entries(mediation.IOS_PODS))
    assert.ok(once.includes(`  pod '${name}', '${version}'`));
  assert.ok(once.indexOf('use_expo_modules!') < once.indexOf('GoogleMobileAdsMediationFacebook'));
  assert.equal(mediation.podfile(once), once);
});

test('Android adapters are runtime-only and Pangle comes from its own repository after the defaults', () => {
  const app = mediation.appGradle('dependencies {\n    implementation("x:y")\n}\n');
  for (const [name, version] of Object.entries(mediation.ANDROID_DEPS))
    assert.ok(app.includes(`    runtimeOnly("${name}:${version}")`));
  const project = mediation.projectGradle(
    "allprojects {\n  repositories {\n    google()\n    mavenCentral()\n    maven { url = uri('https://www.jitpack.io') }\n  }\n}\n",
  );
  assert.ok(project.indexOf('mavenCentral()') < project.indexOf('artifact.bytedance.com'));
  assert.match(project, /includeGroup\('com\.pangle\.global'\)/);
  assert.equal(mediation.projectGradle(project), project);
});

test('template changes fail closed instead of building without adapters', () => {
  assert.throws(() => mediation.podfile("target 'OFFSIDE' do\nend\n"), /Podfile/);
  assert.throws(() => mediation.appGradle('android {}\n'), /app\/build\.gradle/);
  assert.throws(() => mediation.projectGradle('buildscript {}\n'), /build\.gradle/);
});

test('SKAdNetwork IDs keep existing entries and add the missing ones without duplicates', () => {
  const items = mediation.withSkAdNetworkIds([{ SKAdNetworkIdentifier: 'CSTR6SUWN9.skadnetwork' }]);
  const ids = items.map((i) => i.SKAdNetworkIdentifier.toLowerCase());
  assert.equal(new Set(ids).size, ids.length);
  // Google · Meta · Pangle · Liftoff 대표 ID
  for (const id of [
    'cstr6suwn9.skadnetwork',
    'v9wttpbfk9.skadnetwork',
    '22mmun2rn5.skadnetwork',
    'gta9lk7p23.skadnetwork',
  ])
    assert.ok(ids.includes(id), id);
});
