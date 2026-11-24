import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addedDependencies,
  isNativePackage,
  judgeNative,
  LABEL,
  nativeConfigChanges,
  patchKeys,
} from './native-guard.mjs';

test('지문에 들어가는 네이티브 설정만 고른다(11-04 plugins 주석)', () => {
  assert.deepEqual(
    nativeConfigChanges([
      'apps/mobile/app.json',
      'apps/mobile/plugins/withAudio.js',
      'apps/mobile/src/screens/Home.tsx',
      'apps/mobile/app.json.bak',
    ]),
    ['apps/mobile/app.json', 'apps/mobile/plugins/withAudio.js'],
  );
});

test('새로 더한 dependencies와 패치 키를 읽는다', () => {
  assert.deepEqual(
    addedDependencies('{"dependencies":{"a":"1"}}', '{"dependencies":{"a":"1","expo-audio":"1"}}'),
    ['expo-audio'],
  );
  assert.deepEqual(addedDependencies('', '{"dependencies":{"a":"1"}}'), ['a']);
  assert.deepEqual(
    patchKeys(
      "packages:\n  - apps/*\npatchedDependencies:\n  react-native-reanimated@4.5.1: patches/x.patch\n  'foo@1.0.0': patches/y.patch\nother: 1\n",
    ),
    ['react-native-reanimated@4.5.1', 'foo@1.0.0'],
  );
  assert.deepEqual(patchKeys('packages: []\n'), []);
});

test('NATIVE_ADDED에 없는 새 네이티브 모듈은 실패한다(11-17 expo-audio 크래시)', () => {
  const r = judgeNative({
    configChanges: [],
    addedNative: ['expo-camera'],
    addedPatches: [],
    labeled: false,
  });
  assert.match(r.errors[0], /expo-camera.*NATIVE_ADDED/);
  const ok = judgeNative({
    configChanges: [],
    addedNative: ['expo-audio'],
    addedPatches: [],
    labeled: false,
  });
  assert.deepEqual(ok.errors, []);
});

test('NATIVE_PATCHED에 없는 새 네이티브 패치는 실패한다', () => {
  const r = judgeNative({
    configChanges: [],
    addedNative: [],
    addedPatches: ['react-native-svg@15.0.0'],
    labeled: false,
  });
  assert.match(r.errors[0], /NATIVE_PATCHED/);
  const ok = judgeNative({
    configChanges: [],
    addedNative: [],
    addedPatches: ['react-native-reanimated@4.5.1'],
    labeled: false,
  });
  assert.deepEqual(ok.errors, []);
});

test('네이티브 설정 변경은 라벨이 없으면 실패하고, 라벨이 있으면 경고만 한다', () => {
  const args = { configChanges: ['apps/mobile/app.json'], addedNative: [], addedPatches: [] };
  assert.match(judgeNative({ ...args, labeled: false }).errors[0], new RegExp(LABEL));
  const labeled = judgeNative({ ...args, labeled: true });
  assert.deepEqual(labeled.errors, []);
  assert.equal(labeled.warnings.length, 1);
});

test('설치 폴더 모양으로 네이티브 패키지를 가린다', () => {
  const fake = (map) => (dir) => {
    const hit = Object.entries(map).find(([k]) => dir.endsWith(`/node_modules/${k}`));
    if (!hit) throw new Error('ENOENT');
    return hit[1];
  };
  const list = fake({
    'expo-audio': ['expo-module.config.json', 'build'],
    'react-native-reanimated': ['android', 'apple', 'RNReanimated.podspec'],
    valtio: ['index.js', 'package.json'],
  });
  assert.equal(isNativePackage('expo-audio', '/r', list), true);
  assert.equal(isNativePackage('react-native-reanimated', '/r', list), true);
  assert.equal(isNativePackage('valtio', '/r', list), false);
  assert.equal(isNativePackage('missing', '/r', list), false);
});
