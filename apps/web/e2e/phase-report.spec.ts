import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { startCareer } from './helpers.js';

// T-10-024: 구간 진행은 짧은 진행 시트만 보여 주고 닫힌 뒤, 결과는 시즌 탭 맨 위 리포트 카드에 그린다.
// 이어지는 이벤트는 액션바 버튼(이벤트 확인)으로 연다.
async function clearPendingEvent(page: Page) {
  const resume = page.locator('[data-act="resume"]');
  if (!(await resume.count())) return;
  await expect(resume).toContainText('이벤트 확인');
  await resume.click();
  await page.locator('.choice').first().click();
  await page.locator('#sheet [data-sheet]').first().click();
  await expect(page.locator('#sheet')).toBeHidden();
}

test('구간 결과가 팝업이 아니라 시즌 탭 리포트로 나오고, 이벤트는 버튼으로 연다', async ({ page }) => {
  await startCareer(page);
  const report = page.locator('[data-report]');

  await page.locator('[data-act="advance"]').click();
  await expect(page.locator('#sheet')).toContainText('프리시즌 진행 중');
  await expect(page.locator('#sheet')).toBeHidden({ timeout: 10_000 });
  await expect(report).toContainText('시즌 준비를 마쳤습니다');
  await clearPendingEvent(page);

  await page.locator('[data-act="advance"]').click();
  await expect(page.locator('#sheet')).toContainText('전반기 진행 중');
  await expect(page.locator('#sheet')).toBeHidden({ timeout: 10_000 });
  await expect(report).toContainText('전반기 결과');
  const games = await report.locator('.rp-dots li').count();
  expect(games).toBeGreaterThan(0);
  await report.getByText(`경기별 기록 ${games}경기`).click();
  await expect(report.locator('.rp-games .ticker > div')).toHaveCount(games);

  // 리그 순위표: 고교 리그 12팀, 내 팀이 한 줄 강조되고, 순위가 리포트의 팀 순위와 같다.
  const table = page.locator('[data-league-table]');
  const me = table.locator('tr[aria-current="true"]');
  await expect(me).toHaveCount(1);
  const myRank = (await me.locator('td').first().textContent())!.trim();
  await expect(report.locator('.rp-rank')).toContainText(`팀 ${myRank}위`);
  const toggle = table.locator('[data-act="table-toggle"]');
  if (await toggle.count()) {
    await toggle.click();
    await expect(table.locator('tbody tr')).toHaveCount(12);
  }

  // 등장 애니메이션이 끝난 뒤 리포트 카드에 접근성 위반이 없어야 한다(moderate까지).
  await page.waitForTimeout(2500);
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    const results = await new AxeBuilder({ page }).include('[data-report]').include('[data-league-table]').analyze();
    expect(results.violations.map((v) => `${colorScheme} ${v.id} ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  }
});
