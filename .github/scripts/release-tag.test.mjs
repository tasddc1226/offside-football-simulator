import assert from 'node:assert/strict';
import test from 'node:test';
import { kstDate, planReleaseTag } from './release-tag.mjs';

const A = 'a'.repeat(40);
const B = 'b'.repeat(40);
const C = 'c'.repeat(40);

test('KST 날짜로 자른다 — UTC 15시 이후는 다음 날', () => {
  assert.equal(kstDate(new Date('2026-09-25T14:59:00Z')), '2026.09.25');
  assert.equal(kstDate(new Date('2026-09-25T15:00:00Z')), '2026.09.26');
});

test('첫 배포는 그날 1번, 이전 태그 없음', () => {
  assert.deepEqual(planReleaseTag([], A, new Date('2026-09-25T10:00:00Z')), {
    tag: 'v2026.09.25.1',
    existing: false,
    previous: null,
  });
});

test('같은 날 두 번째 배포는 순번을 올리고, 가장 최근 태그를 노트 시작점으로 쓴다', () => {
  const tags = [
    { name: 'v2026.09.24.1', sha: A },
    { name: 'v2026.09.25.1', sha: B },
    { name: 'offside-final', sha: A },
  ];
  assert.deepEqual(planReleaseTag(tags, C, new Date('2026-09-25T11:00:00Z')), {
    tag: 'v2026.09.25.2',
    existing: false,
    previous: 'v2026.09.25.1',
  });
});

test('순번은 문자열이 아니라 숫자로 비교한다', () => {
  const tags = Array.from({ length: 10 }, (_, i) => ({
    name: `v2026.09.25.${i + 1}`,
    sha: String(i).repeat(40),
  }));
  assert.equal(
    planReleaseTag(tags, C, new Date('2026-09-26T01:00:00Z')).previous,
    'v2026.09.25.10',
  );
});

test('같은 커밋을 다시 배포하면 새 태그를 만들지 않는다', () => {
  const tags = [{ name: 'v2026.09.25.1', sha: B }];
  assert.deepEqual(planReleaseTag(tags, B.toUpperCase(), new Date('2026-09-25T11:00:00Z')), {
    tag: 'v2026.09.25.1',
    existing: true,
    previous: null,
  });
});

test('SHA 형식이 아니면 거부한다', () => {
  assert.throws(() => planReleaseTag([], 'main', new Date()), /40-character/);
});
