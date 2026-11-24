import assert from 'node:assert/strict';
import test from 'node:test';
import { judgeRelease, LIMITS, main, NEW_ERRORS_SQL, splitBuckets } from './release-watch.mjs';

const DEPLOY = '2026-11-24T06:00:00Z';
const bucket = (min, requests, errors = 0, slow = 0, avgMs = 120) => ({
  at: new Date(Date.parse(DEPLOY) + min * 60_000).toISOString(),
  requests,
  errors,
  slow,
  avgMs,
});
const steady = [-70, -60, -55, -10, -5, 0, 5, 10].map((m) => bucket(m, 700, 1, 4));

test('배포 전 1시간(걸친 칸 제외)과 배포 뒤 칸을 나눈다', () => {
  const { before, after } = splitBuckets([...steady, bucket(-2, 999)], DEPLOY);
  assert.equal(before.requests, 700 * 4); // -60, -55, -10, -5 (-70은 1시간 밖, -2는 배포에 걸침)
  assert.equal(after.requests, 700 * 3);
});

test('평소와 같으면 문제가 없다', () => {
  const r = judgeRelease(splitBuckets(steady, DEPLOY));
  assert.deepEqual(r.problems, []);
  assert.match(r.lines[2], /새 앱 오류: 없음/);
});

test('오류율이 1%와 배포 전 2배를 넘으면 문제로 본다(11-08 명예의 전당 503)', () => {
  const after = [0, 5].map((m) => bucket(m, 700, 60));
  const r = judgeRelease(splitBuckets([...steady.slice(0, 5), ...after], DEPLOY));
  assert.equal(r.problems.length, 1);
  assert.match(r.problems[0], /오류율/);
});

test('요청이 적으면 비율로 실패시키지 않고, 비어 있으면 실패시킨다', () => {
  assert.deepEqual(
    judgeRelease(splitBuckets([...steady.slice(0, 5), bucket(0, 50, 20)], DEPLOY)).problems,
    [],
  );
  assert.match(judgeRelease(splitBuckets(steady.slice(0, 5), DEPLOY)).problems[0], /비어/);
});

test('느린 요청이 5%와 2배를 넘으면 문제다', () => {
  const r = judgeRelease(splitBuckets([...steady.slice(0, 5), bucket(0, 700, 0, 80)], DEPLOY));
  assert.match(r.problems[0], /느린 요청/);
});

test('배포 뒤 처음 보인 앱 오류가 기준 이상이면 문제이고, 메시지 원문은 옮기지 않는다', () => {
  const newErrors = [
    { platform: 'ios', kind: 'crash', version: '1.1.10', count: 25, message: '선수이름' },
  ];
  const r = judgeRelease({ ...splitBuckets(steady, DEPLOY), newErrors });
  assert.equal(r.problems.length, 1);
  assert.ok(!r.lines.join('\n').includes('선수이름'));
  assert.match(r.lines[2], /ios\/crash 1\.1\.10 ×25/);
  assert.ok(LIMITS.newErrorCount <= 25);
});

test('공개 주소 확인 실패를 문제로 올린다', () => {
  const probes = [{ name: '웹 첫 화면', ok: false, detail: 'HTTP 503' }];
  assert.match(judgeRelease({ ...splitBuckets(steady, DEPLOY), probes }).problems[0], /HTTP 503/);
});

test('새 앱 오류 쿼리는 배포 전 사흘 안에 본 지문을 뺀다', () => {
  assert.match(
    NEW_ERRORS_SQL,
    /NOT IN \(SELECT fingerprint FROM client_errors WHERE day >= \?3 AND first_at < \?1\)/,
  );
});

const fakeFetch =
  (buckets, web = '<title>오프사이드</title>') =>
  async (url) => {
    const body = url.endsWith('/v1/status')
      ? JSON.stringify({ data: { buckets }, meta: {} })
      : url.endsWith('/v1/health')
        ? '{"ok":true}'
        : web;
    return { ok: true, status: 200, text: async () => body, json: async () => JSON.parse(body) };
  };

test('main: 남은 시간만큼 기다리고 결과를 보낸 뒤 문제 수로 종료 코드를 정한다', async () => {
  const sent = [];
  const waits = [];
  const code = await main(
    {
      DEPLOY_AT: DEPLOY,
      EXPECTED_SHA: 'abcdef1234567890',
      SLACK_RELEASES_WEBHOOK: 'x',
      AGENTS_DRIFT: 'true',
    },
    {
      fetcher: fakeFetch(steady),
      now: () => Date.parse(DEPLOY) + 4 * 60_000,
      sleep: async (ms) => waits.push(ms),
      opsDb: async () => ({ query: async () => [] }),
      send: async (_url, message) => sent.push(message.text),
    },
  );
  assert.equal(code, 0);
  assert.deepEqual(waits, [6 * 60_000]);
  assert.match(sent[0], /이상 없음/);
  assert.match(sent[0], /에이전트 Worker: 배포 안 된 변경/);

  const bad = await main(
    { DEPLOY_AT: DEPLOY, SLACK_RELEASES_WEBHOOK: 'x' },
    {
      fetcher: fakeFetch(steady, 'maintenance'),
      now: () => Date.parse(DEPLOY) + 20 * 60_000,
      sleep: async () => assert.fail('no wait after the window'),
      opsDb: async () => ({ query: async () => [] }),
      send: async (_url, message) => sent.push(message.text),
    },
  );
  assert.equal(bad, 1);
  assert.match(sent[1], /mode=rollback/);
});

test('main: 배포 시각이 없으면 실패한다', async () => {
  await assert.rejects(main({}, {}), /DEPLOY_AT/);
});
