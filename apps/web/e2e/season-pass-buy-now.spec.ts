import { test, expect, type Page } from '@playwright/test';
import { API, fail, ok } from './helpers.js';

// T-11-748 시즌 패스 구매 칸. 패스가 없는 구단주에게 진행 띠 바로 아래(단계표 위)에 "지금 사면 바로 받는 보상"을 보인다.
// 합계는 열린 단계까지만이다(앞으로 열릴 단계를 지금 받는 보상처럼 보이지 않는다). 패스가 있거나 웹에서 팔지 않으면 칸이 없다.

const PASS_ID = 'com.offsidelab.app.season_pass';
// 패스 입구는 시즌 2가 열려야 보인다. 시즌 2 일정은 서버가 내려 주므로(시즌 게이지) 저장된 일정으로 넣고 시계를 시즌 2 안에 둔다.
const NOW = new Date('2026-11-17T12:00:00+09:00');
const SCHEDULE = [
  { id: 1, startsAt: '2026-10-05T15:00:00.000Z', endsAt: '2026-10-30T15:00:00.000Z', retireAt: 45 },
  { id: 2, startsAt: '2026-10-30T15:00:00.000Z', endsAt: null, retireAt: 46 },
];

async function setup(
  page: Page,
  season: { owned: boolean; progress: number; tier: number; claimed: number },
  webPass: boolean,
) {
  await page.clock.setFixedTime(NOW);
  await page.addInitScript((schedule) => {
    localStorage.setItem('ft_session', '1');
    localStorage.setItem('ft_season_schedule', JSON.stringify(schedule));
  }, SCHEDULE);
  await page.route(`${API}/v1/**`, (r) => r.fulfill(fail(503, 'UNAVAILABLE', 'unavailable')));
  await page.route(`${API}/v1/profile`, (r) =>
    r.fulfill(
      ok({
        id: 'owner-pass',
        nickname: '패스구단주',
        linked: { google: true },
        googleEmailMasked: 'p***@example.com',
        recoveryCodeIssuedAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        avatarId: null,
      }),
    ),
  );
  await page.route(`${API}/v1/items`, (r) =>
    r.fulfill(ok({ reroll: 0, boost: 0, scout: 0, rename: 0 })),
  );
  await page.route(`${API}/v1/web-pay/config`, (r) =>
    r.fulfill(
      ok(
        webPass
          ? { enabled: true, pass: { productId: PASS_ID, amount: 9900 } }
          : { enabled: false },
      ),
    ),
  );
  await page.route(`${API}/v1/season-pass`, (r) =>
    r.fulfill(ok({ onSale: true, stores: [], seasons: [{ season: 2, ...season }] })),
  );
}

async function openPass(page: Page) {
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await page.locator('[data-act="season-pass"]').click();
  await expect(page.locator('[data-season-pass] [data-pass-tiers="2"]')).toBeVisible();
}

test('패스가 없으면 단계표 위에 열린 단계까지의 보상과 사기 버튼을 보인다', async ({ page }) => {
  await setup(page, { owned: false, progress: 12, tier: 8, claimed: 0 }, true);
  await openPass(page);
  const box = page.locator('[data-pass-buy-now]');
  await expect(box).toContainText('지금 사면 바로 받는 보상');
  await expect(box).toContainText(
    '리롤권 33장, 잠재력 강화권 23장, 프리미엄 스카우트권 5장, 선수 이름 변경권 1장',
  );
  await expect(box).toContainText('열린 8단계까지의 보상을 합쳤어요.');
  await expect(box.locator('[data-act="pass-web-buy"]')).toContainText('웹에서 사기 · 9,900원');
  // 구매 칸이 단계표보다 먼저 나온다.
  const boxY = (await box.boundingBox())!.y;
  const tiersY = (await page.locator('[data-pass-tiers="2"]').boundingBox())!.y;
  expect(boxY).toBeLessThan(tiersY);
});

test('패스가 있으면 구매 칸이 없다', async ({ page }) => {
  await setup(page, { owned: true, progress: 12, tier: 8, claimed: 3 }, true);
  await openPass(page);
  await expect(page.locator('[data-pass-buy-now]')).toHaveCount(0);
  await expect(page.locator('[data-act="pass-claim"]')).toBeVisible();
});

test('웹에서 팔지 않으면 구매 칸 없이 앱 안내를 보인다', async ({ page }) => {
  await setup(page, { owned: false, progress: 0, tier: 1, claimed: 0 }, false);
  await openPass(page);
  await expect(page.locator('[data-pass-buy-now]')).toHaveCount(0);
  await expect(page.locator('[data-pass-web-buy]')).toContainText('패스는 앱에서 살 수 있어요.');
});
