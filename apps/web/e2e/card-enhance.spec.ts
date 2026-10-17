import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { API, fail, ok } from './helpers.js';

// T-11-373 카드 강화 — 라커룸 강화 버튼 · 강화 창(정상 · 실패 · 잔액 부족 · 오류) · 카드 배지 · 확률 도감 표.
// 서버는 page.route로 흉내 낸다(판정 · 차감은 서버가 한다). SHOTS가 있으면 리뷰용 화면을 그 폴더에 남긴다.

const SHOTS = process.env.ENHANCE_SHOTS;
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });
};
const ID = '00000000-0000-4000-8000-000000000071';
const RULES = { costScale: 1, rateScale: 1, pity: 0.1, dailyCap: 30, effectScale: 0.8 };

const player = (over: Record<string, unknown> = {}) => ({
  careerId: ID,
  pos: 'FW',
  dpos: 'ST',
  peak: 86,
  roles: null,
  attrs: null,
  number: 9,
  publicName: '강화 골잡이',
  legendScore: 320,
  cardValue: 900_000,
  raised: true,
  listing: null,
  ...over,
});

async function stub(page: Page, players: unknown[]) {
  await page.route(`${API}/v1/profile`, (r) =>
    r.fulfill(
      ok({
        id: 'u1',
        linked: { google: true, toss: false },
        googleEmailMasked: 'te***@gmail.com',
        recoveryCodeIssuedAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        nickname: '구단주',
      }),
    ),
  );
  await page.route(`${API}/v1/boards/viewer`, (r) =>
    r.fulfill(ok({ admin: false, google: true, nickname: '구단주' })),
  );
  await page.route(`${API}/v1/market/funds`, (r) =>
    r.fulfill(ok({ balance: 3_000_000, clubValue: 4_000_000 })),
  );
  await page.route(`${API}/v1/careers/mine**`, (r) => r.fulfill(ok({ linked: true, entries: [] })));
  await page.route(
    (u) => u.href.startsWith(API) && u.pathname === '/v1/owner-team',
    (r) =>
      r.fulfill(
        ok({
          season: 0,
          current: 0,
          seasons: [{ id: 0, name: '프리시즌' }],
          team: null,
          players,
          lastManager: null,
          matchesLeft: 10,
          matchesPerDay: 10,
          enhanceEffectScale: 0.8,
        }),
      ),
  );
}

async function openLocker(page: Page) {
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await page.locator('[data-act="team"]').click();
  const locker = page.locator('[data-team-locker]');
  await locker.getByLabel('선발 선수 포함').check();
  return locker;
}

test('라커룸에서 카드를 강화하면 단계 · 잔액이 바뀌고, 창을 다시 열 때만 상태를 다시 부른다', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await stub(page, [player({ enhance: 6, enhanceFails: 2 })]);
  let balance = 3_000_000;
  let level = 6;
  let fails = 2;
  let used = 3;
  const calls = { state: 0, tries: [] as unknown[] };
  await page.route(`${API}/v1/cards/enhance`, (r) => {
    calls.state++;
    return r.fulfill(ok({ rules: RULES, used, balance }));
  });
  let succeed = true;
  await page.route(`${API}/v1/cards/${ID}/enhance`, (r) => {
    const body = r.request().postDataJSON() as { level: number; cost: number };
    calls.tries.push(body);
    const from = level;
    balance -= body.cost;
    used++;
    if (succeed) {
      level++;
      fails = 0;
    } else {
      level = level >= 6 ? level - 1 : level;
      fails++;
    }
    return r.fulfill(
      ok({ success: succeed, from, to: level, fails, cost: body.cost, balance, used }),
    );
  });

  const locker = await openLocker(page);
  const card = locker.locator(`[data-locker-player="${ID}"]`);
  await expect(card.locator('[data-card-enhance]')).toHaveText('+6');
  await expect(card.locator('[data-act="enhance"]')).toHaveText('+6');
  await card.scrollIntoViewIfNeeded();
  await shot(page, 'web-locker');
  expect(calls.state).toBe(0);

  await card.locator('[data-act="enhance"]').click();
  const sheet = page.locator('[data-enhance-sheet]');
  await expect(sheet.locator('[data-enhance-rate]')).toHaveText('60%');
  await expect(sheet.locator('[data-enhance-cost]')).toHaveText('90억');
  await expect(sheet.locator('[data-enhance-fail]')).toHaveText('실패하면 +5 단계로 내려가요.');
  await expect(sheet.locator('[data-enhance-pity]')).toContainText('2번');
  await shot(page, 'web-sheet');
  const { violations } = await new AxeBuilder({ page }).include('[data-enhance-sheet]').analyze();
  expect(violations.map((v) => `${v.id} (${v.impact})`)).toEqual([]);

  await sheet.locator('[data-act="enhance-go"]').click();
  await expect(sheet.locator('[data-enhance-result="success"]')).toHaveText(
    '+7 강화에 성공했어요.',
  );
  await expect(sheet.locator('[data-enhance-level]')).toHaveText('+7');
  await expect(sheet.locator('[data-enhance-balance]')).toHaveText('210억');
  await shot(page, 'web-success');

  succeed = false;
  await sheet.locator('[data-act="enhance-go"]').click();
  await expect(sheet.locator('[data-enhance-result="fail"]')).toHaveText(
    '강화에 실패해 +6 단계로 내려갔어요.',
  );
  await shot(page, 'web-fail');
  expect(calls.tries).toEqual([
    { level: 6, cost: 900_000 },
    { level: 7, cost: 1_300_000 },
  ]);
  expect(calls.state).toBe(1);

  await sheet.getByRole('button', { name: '닫기' }).click();
  await expect(card.locator('[data-card-enhance]')).toHaveText('+6');
  await card.locator('[data-act="enhance"]').click();
  await expect(sheet.locator('[data-enhance-rate]')).toBeVisible();
  expect(calls.state).toBe(2);
});

test('자금이 모자라면 버튼이 막히고, 상태를 못 불러오면 다시 시도할 수 있다', async ({ page }) => {
  await stub(page, [player()]);
  let failState = true;
  await page.route(`${API}/v1/cards/enhance`, (r) =>
    r.fulfill(
      failState
        ? fail(503, 'SERVICE_UNAVAILABLE', 'x')
        : ok({ rules: RULES, used: 0, balance: 10_000 }),
    ),
  );
  const locker = await openLocker(page);
  const card = locker.locator(`[data-locker-player="${ID}"]`);
  await expect(card.locator('[data-card-enhance]')).toHaveCount(0);
  await expect(card.locator('[data-act="enhance"]')).toHaveText('강화');
  await card.locator('[data-act="enhance"]').click();
  const sheet = page.locator('[data-enhance-sheet]');
  await expect(sheet.locator('[data-enhance-error]')).toHaveText('강화 정보를 불러오지 못했어요.');
  await shot(page, 'web-error');
  failState = false;
  await sheet.getByRole('button', { name: '다시 시도' }).click();
  await expect(sheet.locator('[data-enhance-block]')).toHaveText('구단 자금이 모자라요.');
  await expect(sheet.locator('[data-act="enhance-go"]')).toBeDisabled();
  await shot(page, 'web-short');
});

test('확률 도감 → 확률과 공정성에 카드 강화 표가 있다', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-act="dex"]').click();
  await page.locator('#fairness > summary').click();
  const table = page.locator('[data-fair-enhance]');
  await expect(table.locator('tbody tr')).toHaveCount(10);
  await expect(table.locator('tbody tr').nth(9)).toContainText('+9 → +10');
  await expect(table.locator('tbody tr').nth(9)).toContainText('20.0%');
  await table.scrollIntoViewIfNeeded();
  await shot(page, 'web-fairness');
});
