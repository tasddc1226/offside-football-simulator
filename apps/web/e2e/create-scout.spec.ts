import { test, expect, type Page } from '@playwright/test';

// T-10-111·112 스카우트 연출과 리세 방지: 후보는 스카우트 시드로 고정되고(뒤로 가기·새로 고침으로 다시 뽑아도
// 같은 조건이면 같은 후보), 잠재력은 고3 첫 시즌을 마쳐야 공개된다.
async function scout(page: Page): Promise<string> {
  await page.locator('[data-act="next-candidates"]').click();
  const scan = page.locator('[data-scout-scan]');
  await expect(scan).toBeVisible();
  await scan.click(); // 탭하면 건너뛴다
  await expect(scan).toBeHidden();
  await page.locator('[data-act="open-all"]').click();
  return (await page.locator('.cand-list').innerText()).replace(/\s+/g, ' ');
}

test('다시 뽑아도 같은 후보가 나오고, 시작 직후엔 잠재력이 평가 전이다', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /새 커리어 킥오프/ }).click();
  const first = await scout(page);

  await page.locator('[data-act="home"]').click(); // ← 다시 입력
  expect(await scout(page)).toBe(first);

  await page.reload();
  await page.getByRole('button', { name: /새 커리어 킥오프/ }).click();
  expect(await scout(page)).toBe(first);

  // 조건(주력)이 바뀌면 그 조건의 후보를 새로 계산한다.
  await page.locator('[data-act="home"]').click();
  await page.locator('[data-set="focus"][data-val="pac"]').click();
  expect(await scout(page)).not.toBe(first);

  await page.locator('[data-cand="0"]').click();
  await page.locator('[data-act="start"]').click();
  await expect(page.locator('.player h1')).toBeVisible();
  await expect(page.locator('.pill', { hasText: '잠재력' })).toHaveText('잠재력 평가 전');
});
