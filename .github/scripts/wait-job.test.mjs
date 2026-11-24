import assert from 'node:assert/strict';
import test from 'node:test';
import { jobState, waitForJob } from './wait-job.mjs';

const env = { GITHUB_REPOSITORY: 'o/r', GITHUB_RUN_ID: '1', GH_TOKEN: 't' };
const seq = (...pages) => {
  let i = 0;
  return async () => {
    const jobs = pages[Math.min(i++, pages.length - 1)];
    return { ok: true, status: 200, json: async () => ({ jobs }) };
  };
};
const deploy = (status, conclusion = null) => ({ name: 'Deploy production', status, conclusion });

test('잡 상태를 읽는다', () => {
  assert.deepEqual(jobState([], 'Deploy production'), { done: false, missing: true });
  assert.equal(jobState([deploy('in_progress')], 'Deploy production').done, false);
  assert.equal(jobState([deploy('completed', 'success')], 'Deploy production').ok, true);
  assert.equal(jobState([deploy('completed', 'failure')], 'Deploy production').ok, false);
});

test('웹 · API 배포가 성공할 때까지 기다린다', async () => {
  let slept = 0;
  const ok = await waitForJob('Deploy production', env, {
    fetcher: seq([], [deploy('in_progress')], [deploy('completed', 'success')]),
    sleep: async () => slept++,
  });
  assert.equal(ok, true);
  assert.equal(slept, 2);
});

test('배포가 실패 · 취소되면 OTA를 게시하지 않는다', async () => {
  await assert.rejects(
    waitForJob('Deploy production', env, {
      fetcher: seq([deploy('completed', 'cancelled')]),
      sleep: async () => {},
    }),
    /cancelled; not publishing/,
  );
});

test('시간을 넘기면 실패한다', async () => {
  let t = 0;
  await assert.rejects(
    waitForJob('Deploy production', env, {
      fetcher: seq([deploy('queued')]),
      sleep: async () => {},
      now: () => (t += 60_000),
      timeoutMs: 120_000,
    }),
    /Timed out/,
  );
});

test('자격 정보가 없으면 바로 실패한다', async () => {
  await assert.rejects(waitForJob('Deploy production', {}), /GH_TOKEN/);
});
