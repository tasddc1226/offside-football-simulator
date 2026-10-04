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
const script = step.split('        run: |\n')[1].replace(/^          /gm, '');

function publish(failedPlatform) {
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

test('production OTA uses the fail-fast bash shell and publishes only iOS and Android', () => {
  assert.match(step, /^        shell: bash$/m);
  assert.deepEqual(publish(''), { status: 0, calls: ['ios', 'android'] });
});

test('tee cannot hide an iOS export/upload failure or continue to Android', () => {
  assert.deepEqual(publish('ios'), { status: 1, calls: ['ios'] });
});

test('an Android export/upload failure makes the OTA step fail', () => {
  assert.deepEqual(publish('android'), { status: 1, calls: ['ios', 'android'] });
});
