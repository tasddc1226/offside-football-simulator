import assert from 'node:assert/strict';
import test from 'node:test';
import { findViolations } from './public-hygiene.mjs';

const kinds = (text) => findViolations(text).map((v) => `${v.line}:${v.kind}`);

test('로컬 사용자 경로와 에이전트 임시 경로를 잡는다', () => {
  assert.deepEqual(kinds('x\nrun /Users/someone/dev/app\n/home/dev/x'), [
    '2:home-path',
    '3:home-path',
  ]);
  assert.deepEqual(kinds('see /private/tmp/claude-501/foo'), ['1:agent-tmp-path']);
});

test('GitHub runner 경로와 ~ 경로는 허용한다', () => {
  assert.deepEqual(kinds('/home/runner/work/x and ~/dev/app'), []);
});

test('실제 메일은 잡고, 예약 도메인·noreply 는 허용한다', () => {
  assert.deepEqual(kinds('mail someone@gmail.com'), ['1:email']);
  assert.deepEqual(
    kinds('a@example.com b@x.test c@users.noreply.github.com noreply@anthropic.com'),
    [],
  );
});

test('운영자 도메인 메일만 허용하고, 개인 메일은 어느 파일에서든 잡는다', () => {
  assert.deepEqual(kinds('mailto:contact@offside-lab.com'), []);
  assert.deepEqual(kinds('contact someone@gmail.com'), ['1:email']);
});
