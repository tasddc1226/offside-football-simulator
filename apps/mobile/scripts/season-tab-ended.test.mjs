// T-11-438 시즌이 끝난 화면(이적시장 대기)에서 웹 SeasonTab.svelte처럼 앱도 준비 · 투자 카드를 그리지 않는다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/screens/game/SeasonTab.tsx', import.meta.url), 'utf8');

test('invest card is rendered only when the season has not ended', () => {
  const at = src.indexOf("<Spotlight reg={reg('invest')}");
  assert.ok(at > 0, 'invest spotlight exists');
  const guard = src.lastIndexOf('{ended ? null : (', at);
  assert.ok(guard > 0 && at - guard < 200, 'invest spotlight sits right inside an ended guard');
});
