import assert from 'node:assert/strict';
import test from 'node:test';
import { rollbackTarget } from './rollback-target.mjs';

const d = (created_on, by, id) => ({
  created_on,
  annotations: { 'workers/triggered_by': by },
  versions: [{ version_id: id, percentage: 100 }],
});

test('API: 코드 배포 뒤 비밀값 버전 두 개를 건너뛰고 지난 배포의 마지막 버전으로 간다(11-24 운영 기록 모양)', () => {
  const list = [
    d('2026-11-23T08:48:40Z', 'deployment', 'old-code'),
    d('2026-11-23T08:48:50Z', 'secret', 'old-secret-1'),
    d('2026-11-23T08:48:55Z', 'secret', 'old-secret-2'),
    d('2026-11-24T02:31:00Z', 'deployment', 'new-code'),
    d('2026-11-24T02:31:10Z', 'secret', 'new-secret-1'),
    d('2026-11-24T02:31:20Z', 'secret', 'new-secret-2'),
  ];
  const t = rollbackTarget([...list].reverse());
  assert.equal(t.versionId, 'old-secret-2');
  assert.equal(t.skipped, 3);
});

test('웹: 비밀값 버전이 없으면 바로 전 배포로 간다', () => {
  const t = rollbackTarget([
    d('2026-11-23T08:30:00Z', 'deployment', 'a'),
    d('2026-11-23T08:49:00Z', 'deployment', 'b'),
    d('2026-11-24T02:31:00Z', 'deployment', 'c'),
  ]);
  assert.equal(t.versionId, 'b');
});

test('되돌릴 곳이 없거나 나눠 배포한 버전이면 멈춘다', () => {
  assert.throws(() => rollbackTarget([d('2026-11-24T02:31:00Z', 'deployment', 'c')]), /No earlier/);
  assert.throws(
    () =>
      rollbackTarget([
        {
          created_on: '2026-11-23T00:00:00Z',
          versions: [
            { version_id: 'x', percentage: 50 },
            { version_id: 'y', percentage: 50 },
          ],
        },
        d('2026-11-24T00:00:00Z', 'deployment', 'z'),
      ]),
    /split rollout/,
  );
});
