import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanupPreview, deletePreviewWorker, previewWorkerNames } from './cleanup-preview.mjs';

function response(status, body = '') {
  return { ok: status >= 200 && status < 300, status, text: async () => body };
}

test('targets exactly the two preview Workers for a positive numeric PR', () => {
  assert.deepEqual(previewWorkerNames('97'), ['offside-api-pr-97', 'offside-web-pr-97']);
  for (const value of ['', '0', '-1', '97x', '97/other', '1.5']) {
    assert.throws(() => previewWorkerNames(value), /positive decimal integer/);
  }
});

test('treats successful deletion and already-absent Workers as success', async () => {
  const calls = [];
  const outcome = await cleanupPreview({
    accountId: 'account',
    token: 'secret',
    prNumber: '97',
    apiBase: 'https://api.example/client/v4',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return calls.length === 1
        ? response(200, JSON.stringify({ success: true, result: {} }))
        : response(404, JSON.stringify({ success: false, errors: [{ code: 10007 }] }));
    },
  });
  assert.equal(outcome.ok, true);
  assert.deepEqual(outcome.results.map(({ status }) => status), ['deleted', 'already-absent']);
  assert.match(calls[0].url, /\/accounts\/account\/workers\/scripts\/offside-api-pr-97$/);
  assert.equal(calls[0].options.method, 'DELETE');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer secret');
  for (const status of [200, 204]) {
    const deleted = await deletePreviewWorker({ accountId: 'account', token: 'secret',
      workerName: 'offside-api-pr-97', fetchImpl: async () => response(status) });
    assert.equal(deleted.status, 'deleted');
  }
});

test('reports both targets and fails on authorization or server errors', async () => {
  const outcome = await cleanupPreview({
    accountId: 'account',
    token: 'secret',
    prNumber: '97',
    fetchImpl: async (url) => response(url.includes('api-pr') ? 403 : 500, 'denied'),
  });
  assert.equal(outcome.ok, false);
  assert.equal(outcome.results.length, 2);
  assert.deepEqual(outcome.results.map(({ status }) => status), ['failed', 'failed']);
  assert.match(outcome.results[0].error, /HTTP 403/);
  assert.match(outcome.results[1].error, /HTTP 500/);
});

test('does not treat a 2xx failure envelope as a successful deletion', async () => {
  const outcome = await cleanupPreview({
    accountId: 'account',
    token: 'secret',
    prNumber: '97',
    fetchImpl: async () => response(200, JSON.stringify({ success: false, errors: [{ code: 10000 }] })),
  });
  assert.equal(outcome.ok, false);
  assert.deepEqual(outcome.results.map(({ status }) => status), ['failed', 'failed']);
  assert.match(outcome.results[0].error, /CF error codes: 10000/);
});

test('propagates network failures as a failed target', async () => {
  await assert.rejects(
    deletePreviewWorker({ accountId: 'account', token: 'secret', workerName: 'offside-api-pr-97', fetchImpl: async () => { throw new Error('offline'); } }),
    /offline/,
  );
});
