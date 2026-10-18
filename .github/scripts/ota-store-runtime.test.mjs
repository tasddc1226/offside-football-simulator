import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STORE_RUNTIMES, assertStoreRuntime } from './ota-store-runtime.mjs';
test('only exact platform-specific store fingerprints are eligible', () => {
  for (const platform of ['ios', 'android']) {
    assert.doesNotThrow(() => assertStoreRuntime(platform, STORE_RUNTIMES[platform]));
    assert.throws(() => assertStoreRuntime(platform, 'unmatched-native-change'));
    assert.throws(() =>
      assertStoreRuntime(platform, STORE_RUNTIMES[platform === 'ios' ? 'android' : 'ios']),
    );
  }
  assert.throws(() => assertStoreRuntime('web', STORE_RUNTIMES.ios));
});
test('preflight can verify native runtimes but cannot publish updates', () => {
  const workflow = readFileSync(
    new URL('../workflows/deploy-production.yml', import.meta.url),
    'utf8',
  );
  const job = workflow.split('  app-update:')[1].split('  release-tag:')[0];
  assert.match(job, /if: inputs.mode == 'deploy' \|\| inputs.mode == 'preflight'/);
  const publish = job.split('      - name: Publish production update')[1];
  assert.match(publish, /if: inputs.mode == 'deploy' && steps.changed.outputs.publish == 'true'/);
  assert.match(job, /ota-store-runtime.mjs/);
  assert.match(job, /EXPO_PUBLIC_ACCOUNT_PURCHASES_ENABLED/);
  assert.match(job, /Require approved purchase recording bundle flag/);
  assert.doesNotMatch(job, /::warning::.*no completed production build/);
});
