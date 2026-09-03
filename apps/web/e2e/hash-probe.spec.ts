// ADR-003, T-0-011 잔여 + T-2-006 08: 브라우저 Web Worker에서 실행한 career-01, 이어서
// career-02 FAST 시즌의 state hash가 golden과 같다. 시즌 구간 소요 시간(ms)도 기록한다.
//
// golden은 `@offside/fixtures`에서 직접 import하지 않는다: Node 22의 ESM 로더는 import
// attribute(`with { type: 'json' }`) 없는 JSON import를 거부하는데, fixtures의 career-01/02는 그
// attribute 없이 JSON을 import한다(다른 패키지라 이 작업 범위 밖). 대신 같은 golden 파일을 직접
// 읽는다 — golden이 바뀌면 이 값도 파일을 통해 그대로 따라간다.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const CAREER01_GOLDEN_URL = new URL(
  '../../../packages/fixtures/src/career-01/career-01.golden.json',
  import.meta.url,
);
const career01Golden = JSON.parse(readFileSync(fileURLToPath(CAREER01_GOLDEN_URL), 'utf8')) as {
  revision: number;
  stateHash: string;
};

const CAREER02_SEASON_GOLDEN_URL = new URL(
  '../../../packages/fixtures/src/career-02-season/career-02-season.golden.json',
  import.meta.url,
);
const career02SeasonGolden = JSON.parse(readFileSync(fileURLToPath(CAREER02_SEASON_GOLDEN_URL), 'utf8')) as {
  FAST: { revision: number; stateHash: string };
};

const SEASON_ELAPSED_MS_CAP = 5000;

test('브라우저 Web Worker의 career-01·career-02 FAST 시즌 state hash가 golden과 같다', async ({ page }) => {
  await page.goto('/__dev/hash-probe');

  const result = page.getByTestId('hash-probe-result');
  await expect(result).toHaveText(/"career02Fast"/, { timeout: 15_000 });

  const parsed = JSON.parse((await result.textContent()) ?? 'null') as {
    career01: { revision: number; stateHash: string };
    career02Fast: { revision: number; stateHash: string; seasonElapsedMs: number };
  };

  expect(parsed.career01).toEqual({
    revision: career01Golden.revision,
    stateHash: career01Golden.stateHash,
  });
  expect(parsed.career02Fast.revision).toBe(career02SeasonGolden.FAST.revision);
  expect(parsed.career02Fast.stateHash).toBe(career02SeasonGolden.FAST.stateHash);

  // T-2-006 08: 상한 5,000ms. 실제 값은 PR 본문 Worker 계산 시간 표에 옮긴다.
  console.log(JSON.stringify({ label: 'browser-worker-career02Fast', seasonElapsedMs: parsed.career02Fast.seasonElapsedMs }));
  expect(parsed.career02Fast.seasonElapsedMs).toBeLessThanOrEqual(SEASON_ELAPSED_MS_CAP);
});
