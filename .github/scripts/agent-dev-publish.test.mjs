import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blockedFiles, parsePrFile, patchFiles } from './agent-dev-publish.mjs';

test('patch가 바꾸는 파일을 읽고 .github · 비밀 파일은 막는다', () => {
  const patch = [
    'diff --git a/apps/web/src/a.ts b/apps/web/src/a.ts',
    '--- a/apps/web/src/a.ts',
    'diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml',
    'diff --git a/apps/api/.env.local b/apps/api/.env.local',
  ].join('\n');
  const files = patchFiles(patch);
  assert.deepEqual(files, ['apps/web/src/a.ts', '.github/workflows/ci.yml', 'apps/api/.env.local']);
  assert.deepEqual(blockedFiles(files), ['.github/workflows/ci.yml', 'apps/api/.env.local']);
});

test('pr.md 첫 줄은 제목, 나머지는 본문', () => {
  assert.deepEqual(parsePrFile('# T-11-300: 고침\n\n본문\nrelease-notes: none\n', 'x'), {
    title: 'T-11-300: 고침',
    body: '본문\nrelease-notes: none',
  });
  assert.equal(parsePrFile('', '대신 제목').title, '대신 제목');
});
