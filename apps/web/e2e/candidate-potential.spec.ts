import { test, expect, type Page } from '@playwright/test';
import { API, ok } from './helpers.js';

// The web has no rewarded ad. Seed the shared persisted reward only to verify
// range rendering, reload recovery and selection → actual saved potential.
test('revealed candidate ranges survive reload and the selected potential reaches the save', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-10-06T01:00:00Z'));
  await page.goto('/');
  await page.locator('[data-act="new"]').click();
  await page.locator('[data-act="next-candidates"]').click();
  await page.locator('[data-cand="0"]').click();
  await expect(page.locator('[data-cand="0"]')).toContainText('잠재력 비공개');
  await page.evaluate(() =>
    localStorage.setItem('ft_scout_reveal', localStorage.getItem('ft_scout_seed')!),
  );
  await page.reload();
  await page.locator('[data-act="new"]').click();
  await page.locator('[data-act="next-candidates"]').click();
  await page.locator('[data-cand="1"]').click();
  const text = await page.locator('[data-cand="1"]').textContent();
  const [, min, upper] = text!.match(/초기 잠재력 ([DCBAS])(?:–([DCBAS]))?등급/)!;
  const max = upper ?? min;
  expect(text).not.toMatch(/초기 잠재력 \d+/);
  await page.locator('[data-act="start"]').click();
  const saved = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('ft_save')!);
    return { cid: s.cid, value: s.pot + s.bloom };
  });
  const grade =
    saved.value >= 90
      ? 'S'
      : saved.value >= 84
        ? 'A'
        : saved.value >= 78
          ? 'B'
          : saved.value >= 70
            ? 'C'
            : 'D';
  expect('DCBAS'.indexOf(grade)).toBeGreaterThanOrEqual('DCBAS'.indexOf(min!));
  expect('DCBAS'.indexOf(grade)).toBeLessThanOrEqual('DCBAS'.indexOf(max!));
  await page.reload();
  await page.locator('[data-act="continue"]').click();
  expect(
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('ft_save')!);
      return { cid: s.cid, value: s.pot + s.bloom };
    }),
  ).toEqual(saved);
});

// T-11-610 구단주가 구단 자금으로 후보 잠재력을 볼 수 없으면 이유를 접지 않고 보인다.
async function openAsOwner(
  page: Page,
  shop: { balance: number; price: number | null; bought: number },
) {
  await page.addInitScript(() => localStorage.setItem('ft_session', '1'));
  await page.route(`${API}/v1/items`, (r) =>
    r.fulfill(
      ok({ reroll: 0, scout: 0, boost: 0, mileage: 0, pity: { used: 0, streak: 0, elites: 0 } }),
    ),
  );
  const offer = { price: shop.price, bought: shop.bought, cap: 5 };
  await page.route(`${API}/v1/items/rewards`, (r) =>
    r.fulfill(
      ok({ balance: shop.balance, offers: { candidates: offer, peek: offer, boost: offer } }),
    ),
  );
  await page.goto('/');
  await page.locator('[data-act="new"]').click();
  await page.locator('[data-act="next-candidates"]').click();
}

test('로그인하지 않으면 잠재력 로그인 입구가 접히지 않고 구단주 화면으로 데려간다', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('[data-act="new"]').click();
  await page.locator('[data-act="next-candidates"]').click();
  await expect(page.locator('[data-cand-login]')).toContainText('앱에서는 광고를 보면');
  await expect(page.locator('[data-cand-app-hint]')).toHaveCount(0);
  await page.locator('[data-act="potential-login-go"]').click();
  await expect(page.getByRole('heading', { level: 1, name: '내 구단' })).toBeVisible();
});

test('자금이 충분한 구단주는 버튼을 보고 이유 줄은 보지 않는다', async ({ page }) => {
  await openAsOwner(page, { balance: 500_000, price: 300_000, bought: 0 });
  await expect(page.locator('[data-act="candidate-potential-club"]')).toContainText('30억');
  await expect(page.locator('[data-cand-club-lock]')).toHaveCount(0);
  // T-11-628 웹에서 볼 수 있는데 앱에서만 된다는 안내를 같이 띄우지 않는다.
  await expect(page.locator('[data-cand-app-hint]')).toHaveCount(0);
});

test('자금이 모자란 구단주는 필요한 금액과 지금 자금을 본다', async ({ page }) => {
  await openAsOwner(page, { balance: 100_000, price: 300_000, bought: 0 });
  const lock = page.locator('[data-cand-club-lock="short"]');
  await expect(lock).toBeVisible();
  await expect(lock).toContainText('구단 자금 30억이 필요해요');
  await expect(lock).toContainText('지금은 10억 있어요');
  await expect(page.locator('[data-cand-app-hint]')).toHaveCount(0);
  await expect(page.locator('[data-act="candidate-potential-club"]')).toHaveCount(0);
});

test('오늘 상한을 다 쓴 구단주는 내일 다시 볼 수 있다고 본다', async ({ page }) => {
  await openAsOwner(page, { balance: 500_000, price: null, bought: 5 });
  await expect(page.locator('[data-cand-club-lock="capped"]')).toContainText('내일 다시');
  await expect(page.locator('[data-cand-app-hint]')).toHaveCount(0);
  await expect(page.locator('[data-act="candidate-potential-club"]')).toHaveCount(0);
});
