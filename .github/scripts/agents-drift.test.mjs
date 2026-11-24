import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { AGENT_PATHS, lastDeployAt, main, undeployed } from './agents-drift.mjs';

test('가장 최근 Worker 배포 시각을 고른다', () => {
  assert.equal(
    lastDeployAt([{ created_on: '2026-11-20T06:29:59Z' }, { created_on: '2026-10-29T13:05:35Z' }]),
    Date.parse('2026-11-20T06:29:59Z'),
  );
  assert.equal(lastDeployAt([]), null);
  assert.throws(() => lastDeployAt({}), /array/);
});

test('배포 뒤에 main에 들어온 커밋만 밀린 것으로 본다', () => {
  const log = [
    'aaa\t2026-11-23T15:44:15+09:00\tT-11-818: 서포터 뱃지 (#1269)',
    'bbb\t2026-11-19T10:00:00+09:00\tT-11-700: 예전 변경',
    '',
  ];
  const c = undeployed(log, Date.parse('2026-11-20T06:29:59Z'));
  assert.deepEqual(
    c.map((x) => x.sha),
    ['aaa'],
  );
  assert.equal(undeployed(log, null).length, 2);
});

test('Worker 소스는 다른 워크스페이스 패키지를 import하지 않는다', () => {
  assert.deepEqual(AGENT_PATHS, ['apps/agents']);
  const pkg = JSON.parse(
    readFileSync(new URL('../../apps/agents/package.json', import.meta.url), 'utf8'),
  );
  const workspace = Object.keys({ ...pkg.dependencies }).filter((d) => d.startsWith('@offside/'));
  assert.deepEqual(workspace, []);
});

test('main: GITHUB_OUTPUT에 drift를 쓴다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agents-drift-'));
  const file = join(dir, 'd.json');
  const out = join(dir, 'out');
  writeFileSync(file, JSON.stringify([{ created_on: '2026-11-20T00:00:00Z' }]));
  writeFileSync(out, '');
  const exec = () => 'aaa\t2026-11-23T00:00:00Z\tchange\n';
  assert.equal(main([file], { GITHUB_OUTPUT: out }, exec), true);
  assert.equal(readFileSync(out, 'utf8'), 'drift=true\n');
});
