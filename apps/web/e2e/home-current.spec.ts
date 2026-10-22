import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { API, ok, startCareer } from './helpers.js';

// T-10-016 진행 중인 커리어가 있으면 홈 첫 카드가 '이번 커리어는 ○○ 입니다'로 바뀌고 이어하기가 맨 앞에 온다.
test('홈: 진행 중인 커리어가 있으면 첫 카드에서 바로 이어 한다', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-home-current]')).toHaveCount(0);
  await expect(page.locator('.hero-home [data-act="new"]')).toHaveText(/새 커리어 킥오프/);

  await startCareer(page);
  const name = (await page.locator('.player h1').innerText()).trim();
  await page.locator('[data-act="home"]').click();

  const hero = page.locator('[data-home-current]');
  await expect(hero.locator('strong')).toHaveText(name);
  // T-11-221 버튼 글자는 '이어서 하기', 이름이 든 전체 문구는 접근성 이름으로 남는다.
  await expect(hero.locator('[data-act="continue"]')).toContainText('이어서 하기');
  await expect(hero.locator('[data-act="continue"]')).toHaveAccessibleName(/(으)?로 계속/);
  await expect(page.locator('[data-act="continue"]')).toHaveCount(1); // 아래쪽 이어하기 타일은 없다.
  expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id)).toEqual([]);

  await hero.locator('[data-act="continue"]').click();
  await expect(page.locator('.player h1')).toHaveText(name);
});

// T-11-275 홈 선물: 로그인한 구단주는 홈에서 한 번 받고, 받으면 사라진다. T-11-435 받을 선물이 있으면 히어로 바로 아래로 올라온다.
const CUP_HOME = {
  cup: {
    id: 's1-1',
    season: 1,
    edition: 1,
    opensAt: '2026-10-08T15:00:00.000Z',
    closesAt: '2026-10-08T19:00:00.000Z',
    drawAt: '2026-10-09T01:00:00.000Z',
    rounds: [{ round: 'f', at: '2026-10-16T12:00:00.000Z', lockAt: '2026-10-16T11:00:00.000Z' }],
    capacity: 64,
    minFilled: 8,
  },
  phase: 'knockout',
  entries: 64,
  teamCount: 64,
  round: 'sf',
  championName: null,
};
const GIFT = { id: 'gift-2026-10', boost: 20, scout: 5 };
// T-11-386 시즌 1 업적 보상(같은 칸). 0장인 아이템은 문장에서 뺀다.
const SEASON_GIFT = { id: 'ach-season-1', kind: 'achSeason', season: 1, boost: 3, scout: 0 };

async function giftStub(page: Page, owner: '1' | null, gift: 'ok' | 'login', offer: object = GIFT) {
  await page.addInitScript((owner) => {
    localStorage.setItem('ft_session', '1');
    if (owner && localStorage.getItem('ft_owner') === null) localStorage.setItem('ft_owner', owner);
  }, owner);
  await page.route(`${API}/v1/cups/home`, (r) => r.fulfill(ok(CUP_HOME)));
  const calls = { get: 0, claim: 0, body: [] as unknown[] };
  await page.route(`${API}/v1/items/gift`, (r) => {
    calls.get++;
    return r.fulfill(
      gift === 'ok'
        ? ok({ gift: offer })
        : {
            status: 403,
            json: {
              error: {
                code: 'FORBIDDEN',
                message: '로그인하면 팀을 만들 수 있어요.',
                retryable: false,
                details: { reason: 'GOOGLE_LOGIN_REQUIRED' },
              },
            },
          },
    );
  });
  await page.route(`${API}/v1/items/gift/claim`, (r) => {
    calls.claim++;
    calls.body.push(r.request().postDataJSON());
    return r.fulfill(ok({ reroll: 0, boost: 20, scout: 5 }));
  });
  return calls;
}

test('홈 선물: 히어로 바로 아래에서 한 번 받으면 사라지고 다시 묻지 않는다', async ({ page }) => {
  const calls = await giftStub(page, '1', 'ok');
  await page.goto('/');
  const card = page.locator('[data-home-gift]');
  await expect(card).toContainText('잠재력 강화권 20장과 프리미엄 스카우트권 5장');
  await expect(page.locator('[data-cup-banner]')).toBeVisible();
  // 받을 선물은 시즌 게이지 · 컵 배너보다 위, 히어로 바로 다음 칸이다.
  await expect
    .poll(() =>
      page.evaluate(() => {
        const hero = document.querySelector('.hero-home')!;
        const gift = document.querySelector('[data-home-gift]')!;
        const cup = document.querySelector('[data-cup-banner]')!;
        return (
          hero.nextElementSibling === gift &&
          !!(gift.compareDocumentPosition(cup) & Node.DOCUMENT_POSITION_FOLLOWING)
        );
      }),
    )
    .toBe(true);
  expect((await new AxeBuilder({ page }).include('[data-home-gift]').analyze()).violations).toEqual(
    [],
  );

  await card.locator('[data-act="home-gift-claim"]').click();
  // T-11-440 받은 뒤 토스트 대신 같은 자리에 결과 · 쓰는 곳 안내 · 내 구단 버튼이 남는다.
  const done = page.locator('[data-home-gift-done]');
  await expect(done).toContainText('잠재력 강화권 20장과 프리미엄 스카우트권 5장을 받았어요');
  await expect(done).toContainText('선수 탭 잠재력 강화');
  await expect(card).toHaveCount(0);
  expect(calls).toMatchObject({ get: 1, claim: 1, body: [{ id: GIFT.id }] });
  await done.locator('[data-act="home-gift-owner"]').click();
  await expect(page.locator('.hero-home')).toHaveCount(0);

  await page.goto('/');
  await expect(page.locator('[data-cup-banner]')).toBeVisible();
  await expect(card).toHaveCount(0);
  expect(calls).toMatchObject({ get: 1, claim: 1 });
});

test('홈 선물: 로그인하지 않은 기기는 한 번 확인한 뒤 다시 묻지 않는다', async ({ page }) => {
  const calls = await giftStub(page, null, 'login');
  await page.goto('/');
  await expect(page.locator('[data-cup-banner]')).toBeVisible();
  await expect.poll(() => calls.get).toBe(1);
  await expect(page.locator('[data-home-gift]')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('[data-cup-banner]')).toBeVisible();
  expect(calls.get).toBe(1);
});

test('T-11-386 시즌 1 업적 보상: 같은 칸에서 받은 장수만 보이고, 그 선물 id로 받는다', async ({
  page,
}) => {
  const calls = await giftStub(page, '1', 'ok', SEASON_GIFT);
  await page.goto('/');
  const card = page.locator('[data-home-gift="ach-season-1"]');
  await expect(card).toContainText('시즌 1 업적 보상이 도착했어요');
  await expect(card).toContainText('시즌 1 업적으로 잠재력 강화권 3장을 받을 수 있어요.');
  await expect(card).not.toContainText('스카우트권');
  await card.locator('[data-act="home-gift-claim"]').click();
  await expect(page.locator('[data-home-gift-done]')).toContainText(
    '잠재력 강화권 3장을 받았어요.',
  );
  await expect(card).toHaveCount(0);
  expect(calls).toMatchObject({ get: 1, claim: 1, body: [{ id: 'ach-season-1' }] });
});
