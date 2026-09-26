import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { startCareer, ok, API } from './helpers.js';

// T-10-027 서버 최초 기록: 홈 카드(최근 기록) → 전체 화면 날짜별 연대기 → 분류 탭(미달성 포함), 내 선수 표시.
const OTHER = '0b000000-0000-4000-8000-00000000000b';
const holder = (careerId: string, name: string | null) => ({ careerId, name, pos: 'FW', number: name ? 9 : null });
const items = (mine: string) => [
  { id: 'goals100', cat: 'total', label: '통산 100골 최초 달성!', achievedAt: '2026-09-24T15:30:00.000Z', holder: holder(OTHER, '김오프') },
  { id: 'goals150', cat: 'total', label: '통산 150골 최초 달성!', achievedAt: null, holder: null },
  { id: 'sgoals30', cat: 'season', label: '한 시즌 30골 최초 달성!', achievedAt: '2026-09-25T03:05:00.000Z', holder: holder(mine, null) },
  { id: 'ballon', cat: 'honor', label: '발롱도르 최초 수상!', achievedAt: '2026-09-25T01:00:00.000Z', holder: holder(OTHER, null) },
];

test('홈 카드 → 서버 최초 기록 화면(연대기·분류 탭·내 선수)', async ({ page }) => {
  await startCareer(page);
  const cid = await page.evaluate(() => (JSON.parse(localStorage.getItem('ft_save')!) as { cid: string }).cid);
  await page.route(`${API}/v1/firsts`, (r) =>
    r.fulfill(ok({ items: items(cid) })),
  );
  await page.goto('/');

  const card = page.locator('[data-act="firsts"]');
  await expect(card).toContainText('한 시즌 30골 최초 달성!'); // 가장 최근 기록
  await expect(card).toContainText('3 / 4');
  await card.click();

  const view = page.locator('[data-firsts]');
  await expect(view.locator('[data-firsts-count]')).toHaveText('3/4');
  // 최근 기록: 한국 시간 날짜별(09-24 15:30Z = 09-25 00:30 KST), 최근 것부터.
  await expect(view.locator('.first-day')).toHaveText(['26.09.25']);
  await expect(view.locator('[data-first]')).toHaveCount(3);
  await expect(view.locator('[data-first]').first()).toContainText('12:05');
  await expect(view.locator('[data-first="sgoals30"]')).toContainText('내 선수');
  await expect(view.locator('[data-first="goals100"]')).toContainText('김오프');
  await expect(view.locator('[data-first="ballon"]')).toContainText('익명의');

  await view.locator('[data-firsts-tab="total"]').click();
  await expect(view.locator('[data-first]')).toHaveCount(2);
  await expect(view.locator('[data-first="goals150"]')).toContainText('미달성');

  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    const axe = await new AxeBuilder({ page }).include('[data-firsts]').analyze();
    expect(axe.violations.map((v) => `${scheme}: ${v.id} ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  }

  await page.locator('[data-act="home"]').click();
  await expect(card).toBeVisible();
});

test('서버에 연결하지 못하면 안내 문구를 보여 준다', async ({ page }) => {
  await page.route(`${API}/v1/firsts`, (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.goto('/');
  await page.locator('[data-act="firsts"]').click();
  await expect(page.locator('[data-firsts]')).toContainText('불러오지 못했어요');
});
