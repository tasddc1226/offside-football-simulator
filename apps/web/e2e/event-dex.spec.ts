import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// T-10-012 확률 도감. 일반 이벤트는 처음부터 공개, 스토리·특별 이벤트는 겪어야(ft_dex) 열린다.
test('확률 도감: 홈 타일 → 공통 규칙 · 선택지 확률 · 잠긴 스토리', async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem('ft_dex', JSON.stringify(['bench-talk', 'rival-1'])),
  );
  await page.goto('/');
  const tile = page.locator('[data-act="dex"]');
  await expect(tile).toContainText('확률 도감 보기');
  await tile.click();

  await expect(page.getByRole('heading', { name: '확률 도감' })).toBeVisible();
  await expect(page.locator('.dex-rules')).toContainText('프리시즌 55%');
  await expect(page.locator('[data-dex-progress]')).toHaveText(/발견 2\/\d+/);

  // 일반 이벤트: 선택지와 확률 범위·영향 요인이 보인다.
  const bench = page.locator('[data-dex="bench-talk"]');
  await bench.locator('summary').click();
  await expect(bench.locator('.dex-check')).toBeVisible();
  const demand = bench.locator('.dex-choices > li', { hasText: '출전 기회를 강하게 요구한다' });
  await expect(demand.locator('.dex-odds')).toHaveText(/^\d+~\d+%$/);
  await expect(demand.locator('.chip.up').first()).toBeVisible();

  // 스토리: 겪은 1단계는 열리고, 아직인 2단계는 잠겨 있다.
  await page.locator('[data-dex-filter="story"]').click();
  await expect(page.locator('[data-dex="rival-1"] summary')).toContainText('또래 라이벌의 등장');
  const locked = page.locator('[data-dex="rival-2"]');
  await expect(locked).toHaveAttribute('data-locked', 'true');
  await expect(locked).not.toContainText('운명의 맞대결');
  await expect(page.locator('[data-dex]:not([data-locked])')).toHaveCount(1);

  const a11y = await new AxeBuilder({ page }).include('.card').analyze();
  expect(a11y.violations).toEqual([]);

  await page.locator('[data-act="home"]').click();
  await expect(page.locator('[data-act="dex"]')).toBeVisible();
});
