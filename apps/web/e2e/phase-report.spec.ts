import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { startCareer } from './helpers.js';

// T-10-024: 구간 진행 시트가 닫힌 뒤, 결과는 시즌 탭 맨 위 리포트 카드에 그린다. 이어지는 이벤트는
// 액션바 버튼(이벤트 확인)으로 연다. T-10-028: 경기 구간은 중계 시트로 한 경기씩 보여 준 뒤 리포트로 넘어간다.
async function clearPendingEvent(page: Page) {
  const resume = page.locator('[data-act="resume"]');
  if (!(await resume.count())) return;
  await expect(resume).toContainText('이벤트 확인');
  await resume.click();
  await page.locator('.choice').first().click();
  await page.locator('#sheet [data-sheet]').first().click();
  await expect(page.locator('#sheet')).toBeHidden();
}

test('경기 중계 시트가 끝나면 확인을 눌러 시즌 탭 리포트로 넘어가고, 이벤트는 버튼으로 연다', async ({ page }) => {
  await startCareer(page);
  const report = page.locator('[data-report]');

  await page.locator('[data-act="advance"]').click();
  await expect(page.locator('#sheet')).toContainText('프리시즌 진행 중');
  await expect(page.locator('#sheet')).toBeHidden({ timeout: 10_000 });
  await expect(report).toContainText('시즌 준비를 마쳤습니다');
  await clearPendingEvent(page);

  await page.locator('[data-act="advance"]').click();
  const sheet = page.locator('#sheet');
  await expect(sheet).toContainText('전반기 진행 중');
  await expect(sheet.locator('.ticker.live > div').first()).toBeVisible();
  await expect(page.locator('#an-skip')).toBeVisible();
  // T-10-029: 다 나오면 바로 닫히지 않고 확인 버튼을 기다린다. 중계의 최종 승무패가 리포트와 같다.
  const ok = sheet.locator('[data-sheet="0"]');
  await expect(ok).toHaveText('확인', { timeout: 15_000 });
  await expect(page.locator('#an-skip')).toHaveCount(0);
  const finalWdl = (await sheet.locator('[data-block-wdl]').textContent())!;
  await page.waitForTimeout(500);
  await expect(sheet).toBeVisible();
  await ok.click();
  await expect(sheet).toBeHidden();
  await expect(report).toContainText('전반기 결과');
  await expect(report.locator('.rp-dots')).toHaveAttribute('aria-label', `경기 결과 ${finalWdl}`);
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

test('경기 중계는 건너뛰기로 최종 기록까지 채우고, 확인을 누르면 리포트로 간다 (T-10-029)', async ({ page }) => {
  await startCareer(page);
  await page.locator('[data-act="advance"]').click();
  await expect(page.locator('#sheet')).toBeHidden({ timeout: 10_000 });
  await clearPendingEvent(page);

  await page.locator('[data-act="advance"]').click();
  await page.locator('#an-skip').click();
  // 건너뛰면 남은 경기를 한 번에 채워 최종 기록과 확인 버튼을 보여 준다.
  const ok = page.locator('#sheet [data-sheet="0"]');
  await expect(ok).toHaveText('확인', { timeout: 1_500 });
  await expect(page.locator('#sheet .prog i')).toHaveAttribute('style', /width:\s*100%/);
  await ok.click();
  await expect(page.locator('#sheet')).toBeHidden();
  await expect(page.locator('[data-report]')).toContainText('전반기 결과');
});

test('경기 중계 시트에 접근성 위반이 없다 (T-10-028)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await startCareer(page);
  await page.locator('[data-act="advance"]').click();
  await expect(page.locator('#sheet')).toBeHidden({ timeout: 10_000 });
  await clearPendingEvent(page);

  await page.locator('[data-act="advance"]').click();
  await expect(page.locator('#sheet .ticker.live > div').nth(1)).toBeVisible();
  const results = await new AxeBuilder({ page }).include('#sheet').analyze();
  expect(results.violations.map((v) => `${v.id} ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
});
