import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { exchangesAt } from '@offside/contracts/card-exchange-rules';
import { API, fail, ok } from './helpers.js';

// T-11-374 카드 과제 — 내 구단 화면 칸 → 과제 목록 → 선수 고르기(잠김 · 판매 중 · 선발 · 조건 밖) → 확인 → 결과.
// 서버는 page.route로 흉내 낸다. 2026-10-19 주에는 쉬움 과제가 '왼발잡이 모임'(왼발 3명)이다.

const NOW = '2026-10-20T03:00:00Z';
const EASY = exchangesAt(NOW, 1).find((d) => d.tier === 'easy')!;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const card = (n: number, extra: Record<string, unknown> = {}) => ({
  careerId: id(n),
  publicName: `과제선수${n}`,
  pos: 'MF',
  dpos: 'CM',
  number: n,
  peak: 70 + n,
  legendScore: 300,
  cardValue: 10_000 * n,
  raised: n % 2 === 1,
  locked: false,
  listing: null,
  roles: null,
  attrs: null,
  foot: '왼발',
  nation: 'KR',
  season: 1,
  ...extra,
});

async function stub(page: Page, opts: { claim?: 'ok' | 'gone' } = {}) {
  const s = {
    teamGets: 0,
    meGets: 0,
    claims: [] as { id: string; body: unknown; key: string | null }[],
  };
  let claimed = 0;
  await page.clock.setFixedTime(new Date(NOW));
  await page.route(`${API}/v1/profile`, (r) =>
    r.fulfill(
      ok({
        id: 'u1',
        linked: { google: true, toss: false },
        nickname: '과제구단주',
        createdAt: '2026-01-01T00:00:00Z',
      }),
    ),
  );
  await page.route(`${API}/v1/boards/viewer`, (r) =>
    r.fulfill(ok({ admin: false, google: true, nickname: '과제구단주' })),
  );
  await page.route(`${API}/v1/market/funds`, (r) =>
    r.fulfill(ok({ balance: 10_000, clubValue: 70_000 })),
  );
  await page.route(`${API}/v1/careers/mine**`, (r) => r.fulfill(ok({ linked: true, entries: [] })));
  await page.route(
    (u) => u.href.startsWith(API) && u.pathname === '/v1/owner-team',
    (r) => {
      s.teamGets++;
      const gone = new Set(claimed ? [id(1), id(2), id(3)] : []);
      return r.fulfill(
        ok({
          season: 1,
          current: 1,
          seasons: [
            { id: 0, name: '프리시즌' },
            { id: 1, name: '시즌 1' },
          ],
          team: {
            name: '과제FC',
            manager: '감독',
            formation: '4-3-3',
            slots: [{ careerId: id(4), slot: 0 }],
            ovr: 80,
            rating: 1000,
            record: { wins: 0, draws: 0, losses: 0 },
          },
          players: [
            card(1),
            card(2),
            card(3),
            card(4),
            card(5, { locked: true }),
            card(6, { listing: { id: 'sale', price: 10_000 } }),
            card(7, { foot: '오른발' }),
          ].filter((p) => !gone.has(p.careerId)),
          lastManager: null,
          matchesLeft: 10,
          matchesPerDay: 10,
        }),
      );
    },
  );
  await page.route(`${API}/v1/exchanges/me`, (r) => {
    s.meGets++;
    return r.fulfill(ok({ claims: claimed ? { [EASY.id]: claimed } : {} }));
  });
  await page.route(`${API}/v1/exchanges/*/claim`, (r) => {
    const req = r.request();
    s.claims.push({
      id: decodeURIComponent(new URL(req.url()).pathname.split('/')[3]!),
      body: req.postDataJSON(),
      key: req.headers()['idempotency-key'] ?? null,
    });
    if (opts.claim === 'gone')
      return r.fulfill(fail(409, 'EXCHANGE_CARDS_GONE', '고른 선수 중 낼 수 없는 선수가 있어요.'));
    claimed++;
    return r.fulfill(ok({ claimed: true, rewards: [{ item: 'reroll', qty: 2 }], titles: [] }));
  });
  return s;
}

const shot = (page: Page, name: string) =>
  page.screenshot({ path: test.info().outputPath(`${name}.png`), fullPage: false });

test('카드 과제: 목록 → 고르기 → 확인 → 결과, 다시 열어도 다시 묻지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const s = await stub(page);
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await expect(page.locator('[data-owner-exchange]')).toBeVisible();
  // 칸을 누르기 전에는 과제 API를 부르지 않는다.
  expect(s.meGets).toBe(0);
  await shot(page, 'exchange-entry');

  await page.locator('[data-act="exchange"]').click();
  const sheet = page.locator('[data-card-exchange]');
  await expect(sheet.locator('[data-exchange]')).toHaveCount(4);
  await expect(sheet.locator('[data-exchange="easy"]')).toContainText('왼발잡이 모임');
  await expect(sheet.locator('[data-exchange="easy"]')).toContainText('남은 횟수 3/3');
  await expect(sheet.locator('[data-exchange="season"]')).toContainText('레전드 점수 800 이상');
  const a11y = await new AxeBuilder({ page }).include('[data-card-exchange]').analyze();
  expect(a11y.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')).toEqual(
    [],
  );
  await shot(page, 'exchange-list');

  await sheet.locator('[data-exchange="easy"]').click();
  // 선발 · 잠김 · 판매 중 · 조건 밖(오른발)은 고를 수 없다.
  await expect(sheet.locator(`[data-exchange-player="${id(4)}"]`)).toContainText('선발');
  await expect(sheet.locator(`[data-exchange-player="${id(5)}"]`)).toContainText('잠김');
  await expect(sheet.locator(`[data-exchange-player="${id(6)}"]`)).toContainText('판매 중');
  await expect(sheet.locator(`[data-exchange-player="${id(7)}"]`)).toContainText('조건 밖');
  await expect(sheet.locator(`[data-exchange-player="${id(7)}"] input`)).toBeDisabled();
  await expect(sheet.locator('[data-act="exchange-submit"]')).toBeDisabled();
  await sheet.locator('[data-act="exchange-fill"]').click();
  await expect(sheet.locator('[data-exchange-picked]')).toHaveText('3/3명 골랐어요');
  await expect(sheet.locator('[data-exchange-checks] li.met')).toHaveCount(2);
  await shot(page, 'exchange-pick');

  await sheet.locator('[data-act="exchange-submit"]').click();
  await expect(sheet).toContainText('카드를 낼까요?');
  await expect(sheet).toContainText('직접 키운 선수 2명');
  await shot(page, 'exchange-confirm');
  await sheet.locator('[data-act="exchange-confirm"]').click();
  await expect(sheet.locator('[data-exchange-done]')).toContainText('리롤권 2장');
  expect(s.claims).toHaveLength(1);
  expect(s.claims[0]!.id).toBe(EASY.id);
  expect(new Set((s.claims[0]!.body as { careerIds: string[] }).careerIds)).toEqual(
    new Set([id(1), id(2), id(3)]),
  );
  expect(s.claims[0]!.key).toBeTruthy();
  await shot(page, 'exchange-done');

  await sheet.locator('[data-exchange-done] button').click();
  await expect(sheet.locator('[data-exchange="easy"]')).toContainText('남은 횟수 2/3');
  // 낸 뒤 새로 받은 뒤로는 닫았다 열어도 메모로 그린다.
  const gets = { team: s.teamGets, me: s.meGets };
  await sheet.locator('[data-act="exchange-close"]').click();
  await expect(sheet).toHaveCount(0);
  await page.locator('[data-act="exchange"]').click();
  await expect(page.locator('[data-card-exchange] [data-exchange]')).toHaveCount(4);
  expect({ team: s.teamGets, me: s.meGets }).toEqual(gets);
});

test('카드 과제: 서버가 카드를 받지 못하면 고른 화면에 이유를 보여 준다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 780 });
  const s = await stub(page, { claim: 'gone' });
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await page.locator('[data-act="exchange"]').click();
  const sheet = page.locator('[data-card-exchange]');
  await sheet.locator('[data-exchange="easy"]').click();
  await sheet.locator('[data-act="exchange-fill"]').click();
  await sheet.locator('[data-act="exchange-submit"]').click();
  await sheet.locator('[data-act="exchange-confirm"]').click();
  await expect(sheet.getByRole('alert')).toContainText('낼 수 없는 선수가 있어요');
  await expect(sheet.locator('[data-exchange-picked]')).toHaveText('3/3명 골랐어요');
  expect(s.claims).toHaveLength(1);
  await shot(page, 'exchange-error-320');
});
