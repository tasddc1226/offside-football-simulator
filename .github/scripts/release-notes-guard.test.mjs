import assert from 'node:assert/strict';
import test from 'node:test';
import { isUserFacing, missingReleaseNote, optedOut } from './release-notes-guard.mjs';

test('treats app and package sources as user-facing, tests and tooling as not', () => {
  assert.equal(isUserFacing('apps/web/src/ui/Market.svelte'), true);
  assert.equal(isUserFacing('apps/mobile/src/screens/Team.tsx'), true);
  assert.equal(isUserFacing('apps/api/src/routes/teams.ts'), true);
  assert.equal(isUserFacing('packages/game/src/engine.ts'), true);
  assert.equal(isUserFacing('apps/api/src/routes/teams.test.ts'), false);
  assert.equal(isUserFacing('apps/api/src/test/helpers.ts'), false);
  assert.equal(isUserFacing('packages/app-core/src/__tests__/x.ts'), false);
  assert.equal(isUserFacing('packages/game/package.json'), false);
  assert.equal(isUserFacing('apps/web/e2e/market.spec.ts'), false);
  assert.equal(isUserFacing('apps/api/migrations/0080_x.sql'), false);
  assert.equal(isUserFacing('tooling/scripts/sim-smoke.mjs'), false);
  assert.equal(isUserFacing('docs/tracking/board.md'), false);
});

test('opt-out accepts a body line or the label', () => {
  assert.equal(optedOut('## 요약\nrelease-notes: none\n'), true);
  assert.equal(optedOut('Release-Notes:  None'), true);
  assert.equal(optedOut('release-notes: none 아님'), false);
  assert.equal(optedOut('', ['no-release-note']), true);
  assert.equal(optedOut('', ['bug']), false);
});

test('flags user-facing changes without a new release note', () => {
  const changed = ['apps/web/src/ui/Market.svelte', 'docs/tracking/board.md'];
  assert.deepEqual(missingReleaseNote({ changed, added: [], body: '', labels: [] }), [
    'apps/web/src/ui/Market.svelte',
  ]);
  assert.deepEqual(
    missingReleaseNote({
      changed,
      added: ['.release-notes/2026-10-09-06-x.json'],
      body: '',
      labels: [],
    }),
    [],
  );
  // 보관 폴더로 옮긴 파일은 새 항목이 아니다.
  assert.equal(
    missingReleaseNote({
      changed,
      added: ['.release-notes/archive/2026-10-01-01-x.json'],
      body: '',
      labels: [],
    }).length,
    1,
  );
  assert.deepEqual(
    missingReleaseNote({ changed: ['tooling/x.mjs'], added: [], body: '', labels: [] }),
    [],
  );
  assert.deepEqual(
    missingReleaseNote({ changed, added: [], body: 'release-notes: none', labels: [] }),
    [],
  );
});
