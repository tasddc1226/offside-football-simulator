import assert from 'node:assert/strict';
import test from 'node:test';
import { findViolations } from './public-hygiene.mjs';

const kinds = (path, text) => findViolations(path, text).map((v) => `${v.line}:${v.kind}`);

test('로컬 사용자 경로와 에이전트 임시 경로를 잡는다', () => {
  assert.deepEqual(kinds('docs/a.md', 'x\nrun /Users/someone/dev/app\n/home/dev/x'), [
    '2:home-path',
    '3:home-path',
  ]);
  assert.deepEqual(kinds('docs/a.md', 'see /private/tmp/claude-501/foo'), ['1:agent-tmp-path']);
});

test('GitHub runner 경로와 ~ 경로는 허용한다', () => {
  assert.deepEqual(kinds('ci.md', '/home/runner/work/x and ~/dev/app'), []);
});

test('실제 메일은 잡고, 예약 도메인·noreply 는 허용한다', () => {
  assert.deepEqual(kinds('docs/a.md', 'mail someone@gmail.com'), ['1:email']);
  assert.deepEqual(
    kinds('a.ts', 'a@example.com b@x.test c@users.noreply.github.com noreply@anthropic.com'),
    [],
  );
});

test('운영자 공개 연락처 파일의 메일은 허용하지만 경로 규칙은 그대로 적용한다', () => {
  assert.deepEqual(kinds('apps/web/scripts/seo.mjs', 'contact someone@gmail.com'), []);
  assert.deepEqual(kinds('apps/web/scripts/seo.mjs', '/Users/someone/x'), ['1:home-path']);
});
