import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { API, ok } from './helpers.js';
import { resumeFixture } from './fixtures/career-save.js';

// 소개 페이지(/ja/app/ 등) 스크린샷을 그 언어 게임 화면으로 찍는다. 평소 e2e에서는 건너뛰고, 다시 찍을 때만
// `LANDING_SHOTS=ja pnpm --filter @offside/web exec playwright test e2e/landing-shots.spec.ts`로 돌린다.
// 결과는 apps/web/landing-shots/<언어>/<화면>.png(540×1169)이고, webp 변환은 `node scripts/landing-shots.mjs <언어>`가 한다.
const LANG = process.env.LANDING_SHOTS ?? '';
test.skip(!LANG, 'LANDING_SHOTS=<lang>일 때만 찍는다');

const LOCALE: Record<string, string> = { ja: 'ja-JP', en: 'en-US', zh: 'zh-TW', ko: 'ko-KR' };
// 소개 페이지 이미지 비율(540×1169)과 같은 390×844 화면을 540px 폭으로 찍는다.
test.use({
  locale: LOCALE[LANG] ?? 'ko-KR',
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 540 / 390,
});
const NAMES: Record<string, { player: string; home: string; away: string; scorer: string }> = {
  ja: { player: '佐藤 翔', home: 'FCサムライ', away: 'ライバルFC', scorer: '佐藤 翔' },
  en: { player: 'Jamie Hart', home: 'Hometown FC', away: 'Rival FC', scorer: 'Jamie Hart' },
  zh: { player: '林子軒', home: '台北之星', away: '對手FC', scorer: '林子軒' },
  ko: { player: '한재혁', home: '우리 동네 FC', away: '라이벌 FC', scorer: '한재혁' },
};
const N = NAMES[LANG] ?? NAMES.ko!;
const out = (name: string) => {
  const dir = new URL(`../landing-shots/${LANG}/`, import.meta.url);
  mkdirSync(dir, { recursive: true });
  return new URL(`${name}.png`, dir).pathname;
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript((lang) => {
    localStorage.setItem('ft_lang', JSON.stringify(lang));
    // 처음 보는 안내 · 제휴 팝업이 화면을 가리지 않게.
    localStorage.setItem('offside_lp_seen', '1');
  }, LANG);
});

async function hideOverlays(page: Page) {
  await page.addStyleTag({
    content:
      '#toast,.news-banner,.partner-popup,.nav-intro,[data-comp-hint],[data-upload-status],.upload-status{display:none!important}',
  });
}

/** career.spec.ts처럼 지금 화면에서 누를 수 있는 다음 버튼을 하나 누른다. */
async function step(page: Page): Promise<boolean> {
  for (const sel of [
    '#sheet [data-key-moment-choice="auto"]:visible',
    '.choice:visible',
    '[data-opt]:visible',
    '#sheet [data-sign="ok"]:enabled',
    '#sheet [data-sheet]:visible',
    '[data-act="resume"]:visible',
    '[data-act="advance"]:visible',
  ]) {
    const el = page.locator(sel).first();
    if (await el.count()) {
      try {
        await el.click({ timeout: 1500 });
        return true;
      } catch {
        /* 다음 후보 */
      }
    }
  }
  return false;
}

test('season', async ({ page }) => {
  test.setTimeout(120_000);
  await page.route(/\/v1\/careers\/.*/, (r) => r.fulfill(ok({})));
  await page.goto('/');
  // 하이드레이션 전에 누르면 반응이 없어 다음 단계가 보일 때까지 다시 누른다.
  await expect(async () => {
    await page.locator('[data-act="new"]').last().click();
    await expect(page.locator('[data-act="next-candidates"]')).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 20_000 });
  await page.locator('[data-act="next-candidates"]').click();
  await page.locator('[data-cand="0"]').click();
  await page.locator('[data-act="start"]').click();
  await expect(page.locator('.player h1')).toBeVisible();
  await page.evaluate((name) => {
    const g = JSON.parse(localStorage.getItem('ft_save')!);
    localStorage.setItem('ft_save', JSON.stringify({ ...g, name }));
  }, N.player);
  await page.reload();
  await page.locator('[data-act="continue"]').click();
  // 프리시즌 → 전반기 첫 구간을 치러 순위표에 경기 수가 쌓일 때까지.
  for (let i = 0; i < 40; i++) {
    const played = await page.evaluate(
      () => JSON.parse(localStorage.getItem('ft_save')!).season?.played ?? 0,
    );
    if (played >= 10) break;
    if (!(await step(page))) await page.waitForTimeout(500);
  }
  // 구간 결과 · 이벤트 시트를 닫는다(다음 구간은 진행하지 않는다).
  for (let i = 0; i < 20 && (await page.locator('#sheet').isVisible()); i++) {
    const btn = page
      .locator(
        '#sheet [data-key-moment-choice="auto"]:visible, #sheet .choice:visible, #sheet [data-sheet]:visible, #sheet button:has-text("スキップ"):visible, #sheet button:has-text("Skip"):visible',
      )
      .first();
    if (await btn.count()) await btn.click({ timeout: 1500 }).catch(() => {});
    else await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }
  await hideOverlays(page);
  const table = page.locator('[data-comp-hint], table').first();
  await page.locator('table').first().scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 120));
  await page.waitForTimeout(500);
  void table;
  await page.screenshot({ path: out('season') });
});

test('pk', async ({ page }) => {
  await resumeFixture(page, { name: N.player, pending: { type: 'event', id: 'penalty' } });
  await hideOverlays(page);
  const sheet = page.locator('#sheet');
  await sheet.locator('[data-choice="0"]').click();
  await expect(sheet.locator('[data-mg-tap]')).toBeVisible();
  await page.waitForTimeout(900);
  await page.screenshot({ path: out('pk') });
});

test('credits', async ({ page }) => {
  test.setTimeout(90_000);
  await page.route(/\/v1\/careers\/.*/, (r) => r.fulfill(ok({})));
  await page.route(
    (u) => u.href.startsWith(API) && u.pathname === '/v1/profile',
    (r) =>
      r.fulfill(
        ok({
          id: 'u1',
          linked: { google: false, toss: false },
          googleEmailMasked: null,
          recoveryCodeIssuedAt: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          nickname: null,
        }),
      ),
  );
  // 다른 언어 번역에 실제 구단 이름이 보이는 가상 구단은 홍보 이미지에 싣지 않는다.
  const fixture = JSON.parse(
    readFileSync(
      new URL('../../../packages/game/src/__fixtures__/save-fw26.json', import.meta.url),
      'utf8',
    ),
  ) as { career: Record<string, unknown>[] };
  const career = JSON.parse(
    JSON.stringify(fixture.career).replaceAll('가시마 사슴뿔', '요코하마 트리콜로레'), // i18n-ignore 저장값
  ) as unknown;
  await resumeFixture(page, {
    name: N.player,
    career,
    age: 34,
    pending: { type: 'market', res: null, m: null },
  });
  const sheet = page.locator('#sheet');
  await sheet
    .locator('button')
    .filter({ hasText: /引退する|Retire|退休|은퇴하기/ })
    .first()
    .click();
  await sheet
    .locator('button')
    .filter({ hasText: /引退する|Retire|退休|은퇴한다/ })
    .first()
    .click();
  await expect(page.locator('[data-credit="player"]')).toBeVisible();
  await hideOverlays(page);
  // 원본처럼 거쳐 온 구단 이력(journey) 가운데를 찍는다.
  const journey = page.locator('[data-credit="journey"]');
  await journey.scrollIntoViewIfNeeded();
  await journey.evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(2500);
  await page.screenshot({ path: out('credits') });
});

test('live', async ({ page }) => {
  test.setTimeout(180_000);
  // 랭크 매칭(시즌 2) 대신 상대를 바로 고르는 프리시즌 친선 흐름으로 찍는다.
  await page.clock.install({ time: new Date('2026-10-01T12:00:00+09:00') });
  const MY = 'tem_00000000-0000-4000-8000-000000000001';
  const RIVAL = 'tem_00000000-0000-4000-8000-000000000002';
  const ME = '00000000-0000-4000-8000-000000000011';
  await page.route(
    (u) => u.href.startsWith(API) && u.pathname === '/v1/profile',
    (r) =>
      r.fulfill(
        ok({
          id: 'u1',
          linked: { google: true, toss: false },
          googleEmailMasked: 'te***@gmail.com',
          recoveryCodeIssuedAt: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          nickname: 'owner',
        }),
      ),
  );
  await page.route(
    (u) => u.href.startsWith(API) && u.pathname === '/v1/boards/viewer',
    (r) => r.fulfill(ok({ admin: false, google: true, nickname: 'owner' })),
  );
  const slots = ['GK', 'FB', 'CB', 'CB', 'FB', 'DM', 'CM', 'AM', 'W', 'ST', 'W'].map((slot, i) => ({
    slot,
    careerId: i === 9 ? ME : null,
    name: i === 9 ? N.scorer : 'Youth',
    pos: i === 9 ? 'FW' : null,
    rating: i === 9 ? 88 : 70,
    fit: 1,
  }));
  const team = {
    id: MY,
    season: 0,
    name: N.home,
    manager: 'Coach',
    formation: '4-3-3',
    layout: null,
    logo: null,
    slots,
    ovr: 74,
    lines: { atk: 76, mid: 72, def: 70, gk: 71 },
    rating: 1240,
    record: { w: 12, d: 3, l: 5 },
    likes: 0,
    views: 0,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  };
  await page.route(
    (u) => u.href.startsWith(API) && u.pathname === '/v1/owner-team',
    (r) =>
      r.fulfill(
        ok({
          season: 0,
          current: 0,
          seasons: [{ id: 0, name: 'preseason' }],
          team,
          players: [
            {
              careerId: ME,
              pos: 'FW',
              dpos: 'ST',
              peak: 88,
              roles: null,
              attrs: null,
              number: 9,
              publicName: N.scorer,
              legendScore: 900,
            },
          ],
          lastManager: null,
          matchesLeft: 8,
          matchesPerDay: 10,
        }),
      ),
  );
  await page.route(
    (u) => u.href.startsWith(API) && u.pathname === '/v1/owner-team/opponents',
    (r) =>
      r.fulfill(
        ok({
          items: [
            {
              teamId: RIVAL,
              name: N.away,
              owner: 'Rival',
              formation: '4-4-2',
              ovr: 73,
              rating: 1252,
              record: { w: 11, d: 4, l: 5 },
            },
          ],
        }),
      ),
  );
  const side = (teamId: string, name: string, goals: number) => ({
    teamId,
    name,
    owner: 'owner',
    formation: '4-3-3',
    ovr: 74,
    goals,
    ratingChange: 0,
    xg: 1.4,
    lines: { atk: 70, mid: 70, def: 70, gk: 70 },
  });
  await page.route(
    (u) => u.href.startsWith(API) && u.pathname === '/v1/owner-team/matches',
    (r) =>
      r.fulfill(
        ok(
          {
            match: {
              id: 'mat_shot',
              home: side(MY, N.home, 2),
              away: side(RIVAL, N.away, 1),
              events: [
                {
                  minute: 21,
                  side: 'home',
                  scorer: N.scorer,
                  assist: null,
                  scorerId: ME,
                  assistId: null,
                },
                {
                  minute: 40,
                  side: 'away',
                  scorer: 'No.7',
                  assist: null,
                  scorerId: null,
                  assistId: null,
                },
                {
                  minute: 81,
                  side: 'home',
                  scorer: N.scorer,
                  assist: null,
                  scorerId: ME,
                  assistId: null,
                },
              ],
              mine: 'home',
              createdAt: '2026-11-18T03:00:00.000Z',
            },
            record: { w: 13, d: 3, l: 5 },
            rating: 1256,
            matchesLeft: 7,
          },
          201,
        ),
      ),
  );
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await page.locator('[data-act="team"]').click();
  await page.locator('[data-team-tab="opponents"]').click();
  await page.locator('[data-act="team-challenge"]').click();
  const live = page.locator('[data-team-live]');
  await expect(live).toBeVisible();
  await hideOverlays(page);
  // 후반 중반(약 68분)까지 흘려 보낸다.
  const clock = live.locator('[data-live-clock]').first();
  for (let i = 0; i < 400; i++) {
    await page.clock.runFor(250);
    const minute = Number.parseInt((await clock.textContent()) ?? '', 10);
    if (minute >= 66) break;
  }
  await page.waitForTimeout(300);
  await page.screenshot({ path: out('live') });
});
