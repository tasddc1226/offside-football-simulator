import assert from 'node:assert/strict';
import test from 'node:test';
import { lanes, laneUsage } from './ota-lane-usage.mjs';

const store = { ios: { version: '1.1.10' }, android: { version: '1.1.11' } };
const legacy = {
  '1.1.7': { runtimes: { ios: 'a', android: 'b' } },
  '1.1.8': { runtimes: { ios: 'c' } },
};

test('플랫폼별 OTA 경로를 만든다', () => {
  assert.deepEqual(
    lanes(store, legacy).map((l) => `${l.platform}:${l.lane}`),
    ['ios:current', 'ios:1.1.7', 'ios:1.1.8', 'android:current', 'android:1.1.7'],
  );
});

test('2% 밑인 옛 경로만 정리 후보로 내고 current는 내지 않는다(11-24 iOS 1.1.7 1.5%)', () => {
  const rows = [
    { platform: 'ios', app_version: '1.1.10', n: 1461 },
    { platform: 'ios', app_version: '1.1.8', n: 463 },
    { platform: 'ios', app_version: '1.1.7', n: 29 },
    { platform: 'ios', app_version: '1.1.5', n: 2 },
    { platform: 'android', app_version: '1.1.11', n: 1 },
  ];
  const u = laneUsage(rows, lanes(store, legacy));
  const by = (p, l) => u.find((x) => x.platform === p && x.lane === l);
  assert.equal(by('ios', '1.1.7').prune, true);
  assert.equal(by('ios', '1.1.8').prune, false);
  assert.equal(by('ios', 'current').prune, false);
  assert.equal(by('ios', '(경로 없음)').n, 2);
  assert.equal(by('android', '1.1.7').prune, true);
});
