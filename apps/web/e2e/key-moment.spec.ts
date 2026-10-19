import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { clearPendingEvent, resumeWithSave } from './helpers.js';

// T-11-390 리그 구간 중계가 결정적 장면에서 멈추고 선택 카드를 띄운다. 고르면 결과 줄이 나오고 남은 경기가 이어진다.
test('리그 구간 중계가 결정적 장면에서 멈추고, 고른 결과가 나온 뒤 이어진다', async ({ page }) => {
  test.setTimeout(60_000);
  // 주전 · 컨디션 좋은 선수로 만들어 구간에서 꼭 뛰게 한다(장면은 내가 뛴 경기에만 뜬다).
  await resumeWithSave(page, { trust: 95, cond: 100, injury: 0 });
  const sheet = page.locator('#sheet');
  await page.locator('[data-act="advance"]').click(); // 프리시즌
  await expect(sheet).toBeHidden({ timeout: 10_000 });
  await clearPendingEvent(page);

  await page.locator('[data-act="advance"]').click(); // 전반기
  const card = sheet.locator('[data-key-moment="league"]');
  // 건너뛰기도 장면에서는 멈춘다.
  await page.locator('#an-skip').click();
  await expect(card).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('#an-skip')).toHaveCount(0);
  await expect(card).toContainText(/결정적 찬스|실점 위기/);
  await expect(card).toContainText('초 뒤 감독에게 맡겨요');
  const choices = card.locator('[data-key-moment-choice]');
  expect(await choices.count()).toBeGreaterThanOrEqual(3); // 선택지 2~3개 + 맡기기
  await expect(choices.first()).toContainText(/성공 \d+%/);
  const a11y = await new AxeBuilder({ page }).include('#sheet').analyze();
  expect(a11y.violations).toEqual([]);

  await choices.first().click();
  const result = card.locator('[data-key-moment-result]');
  await expect(result).toBeVisible();
  await expect(result).toContainText('선택:');
  // 결과 줄이 지나면 남은 경기를 채우고 확인 버튼이 뜬다(건너뛴 상태 그대로).
  const ok = sheet.locator('[data-sheet="0"]');
  await expect(ok).toHaveText('확인', { timeout: 10_000 });
  await expect(card).toHaveCount(0);
  const wdl = (await sheet.locator('[data-block-wdl]').textContent())!;
  await ok.click();
  await expect(sheet).toBeHidden();
  await expect(page.locator('[data-report]')).toContainText(wdl.replace(/\s+/g, ' ').trim());
  // 고른 결과로 다시 진행한 상태가 저장된다(구간이 끝나 전반기를 지났다).
  const phase = await page.evaluate(() => JSON.parse(localStorage.getItem('ft_save')!).phase);
  expect(phase).toBe(2);
});

test('장면에서 고르지 않으면 15초 뒤 감독에게 맡기고 이어진다', async ({ page }) => {
  test.setTimeout(60_000);
  await page.clock.install();
  await resumeWithSave(page, { trust: 95, cond: 100, injury: 0 });
  const sheet = page.locator('#sheet');
  await page.locator('[data-act="advance"]').click();
  await page.clock.runFor(10_000);
  await expect(sheet).toBeHidden({ timeout: 10_000 });
  await clearPendingEvent(page);
  await page.locator('[data-act="advance"]').click();
  await page.locator('#an-skip').click();
  const card = sheet.locator('[data-key-moment="league"]');
  await expect(card).toBeVisible();
  await page.clock.runFor(16_000);
  await expect(card.locator('[data-key-moment-result]')).toContainText('감독에게 맡기기');
  await page.clock.runFor(3_000);
  await expect(sheet.locator('[data-sheet="0"]')).toHaveText('확인');
});
