import { expect, test, type Page } from '@playwright/test';
import { API, ok } from './helpers.js';

// T-11-373 강화 창은 열 때 상태를 한 번만 읽는다. 시도와 응답이 창 상태를 다시 부르지 않는지 요청 횟수로 고정한다.
const CAREER = '00000000-0000-4000-8000-000000000011';
const PLAYER = {
  careerId: CAREER,
  pos: 'FW',
  dpos: 'ST',
  peak: 85,
  roles: { GK: 25, CB: 50, FB: 62, DM: 60, CM: 70, AM: 82, W: 84, ST: 85 },
  attrs: { pac: 88, sho: 91, pas: 70, dri: 84, def: 35, phy: 78 },
  number: 9,
  publicName: '강화 선수',
  legendScore: 500,
  cardValue: 1_000_000,
};

async function stub(page: Page) {
  const hits = { state: 0, attempt: 0 };
  await page.route(`${API}/**`, async (r) => {
    const path = new URL(r.request().url()).pathname;
    if (path === '/v1/profile')
      return r.fulfill(
        ok({
          id: 'u1',
          linked: { google: true, toss: false },
          googleEmailMasked: 'te***@gmail.com',
          recoveryCodeIssuedAt: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          nickname: '구단주',
        }),
      );
    if (path === '/v1/boards/viewer')
      return r.fulfill(ok({ admin: false, google: true, nickname: '구단주' }));
    if (path === '/v1/owner-team')
      return r.fulfill(
        ok({
          season: 1,
          current: 1,
          seasons: [{ id: 1, name: '시즌 1' }],
          team: null,
          players: [PLAYER],
          lastManager: null,
          matchesLeft: 10,
          matchesPerDay: 10,
          enhanceOpen: true,
        }),
      );
    if (path === `/v1/cards/${CAREER}/enhance`) {
      if (r.request().method() === 'GET') {
        hits.state += 1;
        return r.fulfill(
          ok({
            rules: { open: true, costScale: 1, rateScale: 1 },
            card: { level: 0, fails: 0, tier: 'normal' },
            balance: 100_000_000,
          }),
        );
      }
      hits.attempt += 1;
      return r.fulfill(
        ok({
          success: true,
          from: 0,
          to: 1,
          cost: 100_000,
          balance: 99_900_000,
          card: { level: 1, fails: 0, tier: 'normal' },
        }),
      );
    }
    return r.fulfill({ status: 503, body: '' });
  });
  return hits;
}

test('강화 창은 열 때 상태를 한 번만 읽고, 시도 뒤에도 다시 읽지 않는다', async ({ page }) => {
  const hits = await stub(page);
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await page.locator('[data-act="team"]').click();
  await page.locator('[data-act="enhance"]').first().click();
  const sheet = page.locator('[data-enhance-sheet]');
  await expect(sheet.locator('[data-act="enhance-go"]')).toBeEnabled();
  // 응답을 받아 그린 뒤에도 요청이 이어지지 않는다.
  await page.waitForTimeout(500);
  expect(hits.state).toBe(1);

  await sheet.locator('[data-act="enhance-go"]').click();
  // T-11-639 누르면 게이지가 차고, 결과가 나오면 결과 연출로 바뀐다.
  await expect(sheet.locator('[data-enhance-stage] .gauge i')).toBeVisible();
  await expect(sheet.locator('[data-enhance-level]')).toHaveText('+1');
  await expect(sheet.locator('[data-enhance-stage]')).toHaveAttribute('data-fx', 'success');
  await expect(sheet.locator('[data-enhance-stage] .gauge i')).toHaveCount(0);
  // 전체 화면 연출은 눌림을 막지 않는다.
  await expect(page.locator('[data-enhance-burst="success"]')).toHaveCSS('pointer-events', 'none');
  await expect(sheet.locator('[data-enhance-result]')).toBeVisible();
  await page.waitForTimeout(300);
  expect(hits.attempt).toBe(1);
  expect(hits.state).toBe(1);
});
