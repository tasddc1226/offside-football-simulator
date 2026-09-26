import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { startCareer, ok, API } from './helpers.js';

// 정적 공개 페이지는 serious/critical만, 게임 화면(T-10-004)은 moderate까지 위반 0을 요구한다.
async function expectNoViolations(page: Page, where: string, { seriousOnly = false } = {}) {
  const results = await new AxeBuilder({ page }).analyze();
  const found = results.violations
    .filter((v) => !seriousOnly || v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${where}: ${v.id} (${v.impact}) ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
  expect(found).toEqual([]);
}
const expectNoSeriousViolations = (page: Page) => expectNoViolations(page, page.url(), { seriousOnly: true });

test('홈 화면에 심각한 접근성 위반이 없다', async ({ page }) => {
  await page.goto('/');
  await expectNoSeriousViolations(page);
});

test('선수 탭에 심각한 접근성 위반이 없다', async ({ page }) => {
  await startCareer(page);
  await page.locator('[data-tab="player"]').click();
  await expectNoSeriousViolations(page);
});

// T-10-004: 게임 화면은 moderate(랜드마크·h1 등)까지 위반 0을 유지한다 — 라이트/다크 둘 다.
const HOF_ID = '0f2d7a51-6c1e-4a8b-9d3f-2b7c5e8a1d44';
const hofEntry = {
  id: HOF_ID, name: null, pos: 'MF', number: 10, retireAge: 36, peak: 88, legendScore: 540, apps: 600, goals: 120, assists: 210,
  trophies: 7, awards: 4, caps: 90, ballon: 0, lastClub: '테스트 FC', retiredAt: '2026-09-24T00:00:00.000Z', hasDetail: true,
};
const hofSnapshot = {
  number: 10, pos: 'MF', age: 36, peak: 88, lastClub: '테스트 FC',
  career: [{ year: 2026, age: 18, club: '테스트 고교', league: '고교리그', apps: 20, goals: 6, assists: 9, cs: 0, rating: 7.2, rank: 1, ovr: 57, honors: ['고교리그 우승'], ch: ['assists'] }],
  trophies: [{ year: 2026, t: '고교리그 우승', club: '테스트 고교' }], awards: [], ballon: [], nat: { caps: 90 }, storyLog: [], miles: [],
};

for (const scheme of ['light', 'dark'] as const) {
  test(`게임 화면 전체에 접근성 위반이 없다 (${scheme})`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.emulateMedia({ colorScheme: scheme });
    await page.route(/\/v1\/hof\?/, (r) => r.fulfill(ok({ entries: [hofEntry] })));
    await page.route(`${API}/v1/hof/${HOF_ID}`, (r) => r.fulfill(ok({ entry: hofEntry, snapshot: hofSnapshot })));
    await page.goto('/');
    await expect(page.locator(`[data-hof-id="${HOF_ID}"]`)).toBeVisible();
    await expectNoViolations(page, 'home');
    await page.locator(`[data-hof-id="${HOF_ID}"]`).click();
    await expect(page.locator('.player h1')).toBeVisible();
    await expectNoViolations(page, 'legend');
    await page.locator('[data-act="hof-back"]').click();
    await page.getByRole('button', { name: /새 커리어 킥오프/ }).click();
    await expectNoViolations(page, 'create-profile');
    await page.locator('[data-act="next-candidates"]').click();
    await expectNoViolations(page, 'create-candidates');
    await startCareer(page);
    for (const tab of ['season', 'player', 'career', 'trophy']) {
      await page.locator(`[data-tab="${tab}"]`).click();
      await expectNoViolations(page, `tab-${tab}`);
    }
  });
}

// 정적 페이지(/guide, /faq, /legal/*)는 크롤러/noscript용 콘텐츠이며 앱 번들 스크립트를
// 포함하지 않으므로, 실제 브라우저에서 JS가 켜져 있어도 그대로 남는다.
for (const path of ['/guide/', '/faq/', '/legal/terms/', '/legal/privacy/']) {
  test(`${path}에 심각한 접근성 위반이 없다`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('h1')).toBeVisible();
    await expectNoSeriousViolations(page);
  });
}
