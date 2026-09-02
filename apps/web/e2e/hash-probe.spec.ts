// ADR-003, T-0-011 잔여: 브라우저 Web Worker에서 실행한 career-01의 state hash가 golden과 같다.
//
// golden은 `@offside/fixtures`에서 직접 import하지 않는다: Node 22의 ESM 로더는 import
// attribute(`with { type: 'json' }`) 없는 JSON import를 거부하는데, fixtures의 career-01은 그
// attribute 없이 JSON을 import한다(다른 패키지라 이 작업 범위 밖). 대신 같은 golden 파일을 직접
// 읽는다 — golden이 바뀌면 이 값도 파일을 통해 그대로 따라간다.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const GOLDEN_URL = new URL(
  '../../../packages/fixtures/src/career-01/career-01.golden.json',
  import.meta.url,
);
const golden = JSON.parse(readFileSync(fileURLToPath(GOLDEN_URL), 'utf8')) as {
  revision: number;
  stateHash: string;
};

test('브라우저 Web Worker의 career-01 state hash가 golden과 같다', async ({ page }) => {
  await page.goto('/__dev/hash-probe');

  const result = page.getByTestId('hash-probe-result');
  await expect(result).toHaveText(/"revision"/, { timeout: 15_000 });

  const parsed = JSON.parse((await result.textContent()) ?? 'null') as unknown;
  expect(parsed).toEqual({
    revision: golden.revision,
    stateHash: golden.stateHash,
  });
});
