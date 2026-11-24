import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { API, fail, ok } from './helpers.js';

// T-11-825 원정 투어 — 내 구단 화면 칸 → 여정 지도 → 편성(자동 편성 · 전술) → 작전 경기(30분 · 60분 작전 타임) → 결과 → 주간 순위.
// 서버는 page.route로 흉내 낸다. 입구는 내 팀 응답의 tourOpen이 켜졌을 때만 보인다.

const NOW = '2026-11-24T03:00:00Z';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const POS = [
  ['GK', 'GK'],
  ['DF', 'CB'],
  ['DF', 'CB'],
  ['DF', 'LB'],
  ['DF', 'RB'],
  ['MF', 'CM'],
  ['MF', 'CM'],
  ['MF', 'CM'],
  ['FW', 'ST'],
  ['FW', 'LW'],
  ['FW', 'RW'],
] as const;
const card = (n: number, extra: Record<string, unknown> = {}) => ({
  careerId: id(n),
  publicName: `원정선수${n}`,
  pos: POS[(n - 1) % POS.length]![0],
  dpos: POS[(n - 1) % POS.length]![1],
  number: n,
  peak: 90,
  legendScore: 300,
  cardValue: 10_000 * n,
  raised: true,
  locked: false,
  listing: null,
  roles: null,
  attrs: null,
  foot: '오른발',
  nation: ['KR', 'JP', 'GB', 'FR', 'DE', 'BR'][n % 6],
  type: ['maker', 'speed', 'power', 'tech', 'all'][n % 5],
  season: 2,
  ...extra,
});
const stageOf = (stage: number, stars = 0) => ({
  stage,
  opp: [70, 76, 82, 86, 90, 93, 96][stage - 1],
  formation: '4-4-2',
  tactic: 'counter',
  rules: [{ kind: 'nationCap', max: 6 }],
  fee: [500000, 650000, 900000, 1100000, 1350000, 1600000, 1900000][stage - 1],
  merc: 58,
  stars,
});

async function stub(page: Page, opts: { open?: boolean; start?: 'ok' | 'noTries' } = {}) {
  const s = {
    tourGets: 0,
    rankGets: 0,
    starts: [] as { body: Record<string, unknown>; key: string | null }[],
    orders: [] as Record<string, unknown>[],
  };
  let cleared = 0;
  let live: Record<string, unknown> | null = null;
  const match = (over: Record<string, unknown>) => ({
    id: 'tur_1',
    stage: 1,
    tryNo: 1,
    status: 'live',
    done: 1,
    formation: '4-3-3',
    slotIds: (s.starts[0]?.body.slotIds as string[]) ?? [],
    bench: (s.starts[0]?.body.bench as string[]) ?? [],
    subsLeft: 3,
    tactic: 'possession',
    stamina: Array.from({ length: 11 }, () => 78),
    oppTactic: 'counter',
    goalsFor: 1,
    goalsAgainst: 0,
    events: [
      {
        minute: 12,
        side: 'away',
        scorer: '원정선수9',
        assist: null,
        scorerId: id(9),
        assistId: null,
        slot: 'ST',
      },
    ],
    chances: { press: 0.5, possession: 0.7, wings: 0.62, counter: 0.6, park: 0.66 },
    result: null,
    ...over,
  });
  await page.clock.setFixedTime(new Date(NOW));
  await page.route(`${API}/v1/profile`, (r) =>
    r.fulfill(
      ok({
        id: 'u1',
        linked: { google: true, toss: false },
        nickname: '원정구단주',
        createdAt: '2026-01-01T00:00:00Z',
      }),
    ),
  );
  await page.route(`${API}/v1/boards/viewer`, (r) =>
    r.fulfill(ok({ admin: false, google: true, nickname: '원정구단주' })),
  );
  await page.route(`${API}/v1/market/funds`, (r) =>
    r.fulfill(ok({ balance: 10_000, clubValue: 70_000 })),
  );
  await page.route(`${API}/v1/careers/mine**`, (r) => r.fulfill(ok({ linked: true, entries: [] })));
  await page.route(
    (u) => u.href.startsWith(API) && u.pathname === '/v1/owner-team',
    (r) =>
      r.fulfill(
        ok({
          season: 2,
          current: 2,
          seasons: [{ id: 2, name: '시즌 2' }],
          team: {
            name: '원정FC',
            manager: '감독',
            formation: '4-3-3',
            slots: [{ careerId: id(1), slot: 0 }],
            ovr: 90,
            rating: 1000,
            record: { wins: 0, draws: 0, losses: 0 },
          },
          players: [
            ...Array.from({ length: 16 }, (_, i) => card(i + 1)),
            card(17, { listing: { id: 'sale', price: 10_000 } }),
          ],
          lastManager: null,
          matchesLeft: 10,
          matchesPerDay: 10,
          tourOpen: opts.open ?? true,
        }),
      ),
  );
  await page.route(`${API}/v1/tour`, (r) => {
    s.tourGets++;
    return r.fulfill(
      ok({
        open: true,
        week: '2026-11-23',
        season: 2,
        cleared,
        score: cleared ? 170 : 0,
        rank: cleared ? 3 : null,
        triesLeft: 3 - s.starts.length,
        stages: Array.from({ length: 7 }, (_, i) => stageOf(i + 1, i < cleared ? 3 : 0)),
        live,
      }),
    );
  });
  await page.route(`${API}/v1/tour/ranking`, (r) => {
    s.rankGets++;
    return r.fulfill(
      ok({
        week: '2026-11-23',
        rows: [{ rank: 1, teamId: 't1', name: '선두FC', cleared: 7, score: 3150, stars: 20 }],
      }),
    );
  });
  await page.route(`${API}/v1/tour/matches`, (r) => {
    const req = r.request();
    if (opts.start === 'noTries')
      return r.fulfill(fail(409, 'TOUR_NO_TRIES', '오늘 도전을 모두 썼어요.'));
    s.starts.push({
      body: req.postDataJSON() as Record<string, unknown>,
      key: req.headers()['idempotency-key'] ?? null,
    });
    live = match({});
    return r.fulfill(ok({ match: live, triesLeft: 2, balance: null }));
  });
  await page.route(`${API}/v1/tour/matches/*/orders`, (r) => {
    const body = r.request().postDataJSON() as Record<string, unknown>;
    s.orders.push(body);
    if (body.done === 1) {
      live = match({
        done: 2,
        tactic: body.tactic ?? 'possession',
        subsLeft: 3 - ((body.subs as unknown[] | undefined)?.length ?? 0),
        stamina: Array.from({ length: 11 }, () => 56),
        oppTactic: 'press',
        goalsFor: 2,
      });
      return r.fulfill(ok({ match: live, triesLeft: 2, balance: null }));
    }
    cleared = 1;
    const done = match({
      status: 'won',
      done: 3,
      goalsFor: 3,
      chances: null,
      result: { pens: false, stars: 3, score: 180, fee: 500000 },
    });
    live = null;
    return r.fulfill(ok({ match: done, triesLeft: 2, balance: 510_000 }));
  });
  return s;
}

const shot = (page: Page, name: string) =>
  page.screenshot({ path: test.info().outputPath(`${name}.png`), fullPage: false });

test('원정 투어: 지도 → 편성 → 작전 경기 → 결과, 순위는 열 때만 받는다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const s = await stub(page);
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await expect(page.locator('[data-owner-tour]')).toBeVisible();
  // 칸을 누르기 전에는 투어 API를 부르지 않는다.
  expect(s.tourGets).toBe(0);

  await page.locator('[data-act="tour"]').click();
  const sheet = page.locator('[data-squad-tour]');
  await expect(sheet.locator('[data-tour-stage]')).toHaveCount(7);
  await expect(sheet.locator('[data-tour-stage="1"]')).toHaveAttribute('data-state', 'next');
  await expect(sheet.locator('[data-tour-stage="2"]')).toHaveAttribute('data-state', 'locked');
  await expect(sheet.locator('[data-tour-tries]')).toContainText('3 / 3');
  await expect(sheet.locator('[data-tour-stage="1"]')).toContainText('같은 국적은 6명까지');
  await expect(sheet.locator('[data-tour-stage="1"]')).toContainText('대전료 50억');
  expect(s.rankGets).toBe(0);
  await shot(page, 'tour-map');
  const axe = await new AxeBuilder({ page }).include('[data-squad-tour]').analyze();
  expect(axe.violations).toEqual([]);

  // 편성: 자동 편성이 선발 11명과 교체 명단 5명을 채운다. 판매에 올린 카드(17번)는 들어가지 않는다.
  await sheet.locator('[data-act="tour-go"]').click();
  await expect(sheet.locator('[data-tour-scout]')).toContainText('역습');
  await expect(sheet.locator('[data-tour-bench-count]')).toContainText('5 / 5');
  // 상대가 역습이면 점유가 상성에서 앞선다.
  await expect(sheet.locator('[data-tour-tactic="possession"]')).toContainText(
    '상대 전술에 강해요',
  );
  await sheet.locator('[data-tour-tactic="possession"]').click();
  await shot(page, 'tour-prep');
  await sheet.locator('[data-act="tour-depart"]').click();
  await expect(sheet.locator('[data-tour-match]')).toHaveAttribute('data-done', '1');
  expect(s.starts).toHaveLength(1);
  const body = s.starts[0]!.body as { slotIds: (string | null)[]; bench: string[]; tactic: string };
  expect(body.slotIds.filter(Boolean)).toHaveLength(11);
  expect(body.bench).toHaveLength(5);
  expect([...body.slotIds, ...body.bench]).not.toContain(id(17));
  expect(body.tactic).toBe('possession');
  expect(s.starts[0]!.key).toBeTruthy();

  // 30분 작전 타임: 전술을 바꾸고 한 명 교체한다.
  await expect(sheet.locator('[data-tour-score]')).toHaveText('0 : 1');
  await expect(sheet.locator('[data-tour-events]')).toContainText('원정선수9');
  await expect(sheet.locator('[data-tour-tactic="possession"]')).toContainText('70%');
  await sheet.locator('[data-tour-tactic="park"]').click();
  await sheet.locator('[data-slot="10"]').click();
  await sheet.locator('[data-tour-sub-in]').first().click();
  await expect(sheet.locator('[data-tour-sub]')).toHaveCount(1);
  await expect(sheet.locator('[data-tour-subs]')).toContainText('2');
  await shot(page, 'tour-timeout');
  await sheet.locator('[data-act="tour-continue"]').click();
  await expect(sheet.locator('[data-tour-match]')).toHaveAttribute('data-done', '2');
  expect(s.orders[0]).toMatchObject({ done: 1, tactic: 'park' });
  expect((s.orders[0]!.subs as unknown[]).length).toBe(1);

  // 60분 작전 타임: 그대로 진행하면 경기가 끝난다.
  await sheet.locator('[data-act="tour-continue"]').click();
  await expect(sheet.locator('[data-tour-match]')).toHaveAttribute('data-status', 'won');
  expect(s.orders[1]).toEqual({ done: 2 });
  await expect(sheet.locator('[data-tour-result-stars]')).toHaveAttribute(
    'data-tour-result-stars',
    '3',
  );
  await expect(sheet.locator('[data-tour-fee]')).toContainText('50억');
  await shot(page, 'tour-result');

  // 여정 지도로 돌아가면 1차전은 통과, 2차전이 열려 있다.
  await sheet.locator('[data-act="tour-map"]').click();
  await expect(sheet.locator('[data-tour-stage="1"]')).toHaveAttribute('data-state', 'done');
  await expect(sheet.locator('[data-tour-stage="2"]')).toHaveAttribute('data-state', 'next');
  const gets = s.tourGets;

  // 주간 순위는 열 때 한 번만 받는다.
  await sheet.locator('[data-act="tour-rank"]').click();
  await expect(sheet.locator('[data-tour-ranking]')).toContainText('선두FC');
  await sheet.locator('[data-act="tour-back"]').click();
  await sheet.locator('[data-act="tour-rank"]').click();
  await expect(sheet.locator('[data-tour-ranking]')).toContainText('선두FC');
  expect(s.rankGets).toBe(1);
  expect(s.tourGets).toBe(gets);
});

test('원정 투어: 닫혀 있으면 입구가 없고, 출발이 거절되면 이유를 보여 준다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await stub(page, { open: false });
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await expect(page.locator('[data-owner-exchange]')).toBeVisible();
  await expect(page.locator('[data-owner-tour]')).toHaveCount(0);

  await page.unrouteAll();
  const s = await stub(page, { start: 'noTries' });
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await page.locator('[data-act="tour"]').click();
  const sheet = page.locator('[data-squad-tour]');
  await sheet.locator('[data-act="tour-go"]').click();
  await sheet.locator('[data-act="tour-depart"]').click();
  await expect(sheet.getByRole('alert')).toContainText('오늘 도전을 모두 썼어요');
  expect(s.starts).toHaveLength(0);
});
