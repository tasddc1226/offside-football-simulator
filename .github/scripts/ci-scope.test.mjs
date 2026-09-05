import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyPaths, main, readChangedPaths } from './ci-scope.mjs';

test('classifies allowed documentation and images as non-code', () => {
  assert.equal(
    classifyPaths([
      'docs/qa/report.md',
      'docs/qa/screenshot.PNG',
      'README.md',
      'packages/foo/README.md',
    ]),
    false,
  );
});

test('classifies code and unknown paths as code changes', () => {
  assert.equal(classifyPaths(['docs/qa/report.ts']), true);
  assert.equal(classifyPaths(['docs/qa/report.html']), true);
  assert.equal(classifyPaths(['packages/domain/src/index.ts']), true);
  assert.equal(classifyPaths(['notes.txt']), true);
});

test('classifies a no-renames rename pair conservatively from both paths', () => {
  assert.equal(classifyPaths(['old/src/feature.ts', 'docs/feature.md']), true);
  assert.equal(classifyPaths(['old/README.md', 'docs/new-readme.md']), false);
});

test('classifies provider and git comparison failures as code changes', () => {
  const writes = [];
  const result = main(
    { CI_BASE_SHA: 'a'.repeat(40), CI_HEAD_SHA: 'b'.repeat(40), GITHUB_OUTPUT: 'unused' },
    () => {
      throw new Error('missing object');
    },
    (_path, value) => writes.push(value),
  );
  assert.equal(result, true);
  assert.deepEqual(writes, ['code_changed=true\n']);
  assert.throws(() =>
    readChangedPaths('0'.repeat(40), 'a'.repeat(40), () => {
      throw new Error('missing object');
    }),
  );
});
