import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const workflow = readFileSync(
  new URL('../workflows/deploy-production.yml', import.meta.url),
  'utf8',
);
const step = workflow.split('      - name: Publish production update\n')[1].split('\n  #')[0];
const script = step.split('        run: |\n')[1].replace(/^ {10}/gm, '');

function publish(platform, failedPlatform) {
  const dir = mkdtempSync(join(tmpdir(), 'offside-ota-'));
  try {
    writeFileSync(
      join(dir, 'eas'),
      '#!/bin/bash\nwhile [ "$1" != "--platform" ]; do shift; done\n' +
        'echo "$2" >> "$OTA_CALLS"\necho "export output"\n' +
        '[ "$2" != "$OTA_FAIL_PLATFORM" ]\n',
      { mode: 0o755 },
    );
    const result = spawnSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', script], {
      encoding: 'utf8',
      timeout: 3000,
      env: {
        ...process.env,
        PATH: `${dir}:${process.env.PATH}`,
        EXPECTED_SHA: '1234567890abcdef',
        PLATFORM: platform,
        OTA_TARGET: '1.1.2',
        GITHUB_STEP_SUMMARY: join(dir, 'summary'),
        OTA_CALLS: join(dir, 'calls'),
        OTA_FAIL_PLATFORM: failedPlatform,
      },
    });
    return {
      status: result.status,
      calls: readFileSync(join(dir, 'calls'), 'utf8').trim().split('\n'),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('each matrix lane publishes only its own native platform', () => {
  assert.match(step, /^ {8}shell: bash$/m);
  for (const platform of ['ios', 'android']) {
    assert.deepEqual(publish(platform, ''), { status: 0, calls: [platform] });
  }
});

test('tee cannot hide an export/upload failure in either platform lane', () => {
  for (const platform of ['ios', 'android']) {
    assert.deepEqual(publish(platform, platform), { status: 1, calls: [platform] });
  }
});
