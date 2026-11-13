import { test, expect, type Page } from '@playwright/test';
import { API, ok, usePreseason } from './helpers.js';

// T-11-722 랭크 연패 안내 — 내가 건 랭크 경기를 세 번 연달아 지면 결과 화면에 한 번 알려 준다. 서버는 page.route로 흉내 낸다.
usePreseason();

const MY_TEAM = 'tem_00000000-0000-4000-8000-000000000001';
const RIVAL = 'tem_00000000-0000-4000-8000-000000000002';
const STRIKER = '00000000-0000-4000-8000-000000000011';
const FORMATION_433 = ['GK', 'FB', 'CB', 'CB', 'FB', 'DM', 'CM', 'AM', 'W', 'ST', 'W'];
type Lines = { atk: number; mid: number; def: number; gk: number };

const team = {
  id: MY_TEAM,
  season: 0,
  name: '우리 동네 FC',
  manager: '홍감독',
  formation: '4-3-3',
  layout: null,
  logo: null,
  slots: FORMATION_433.map((slot, i) => ({
    slot,
    careerId: i === 9 ? STRIKER : null,
    name: i === 9 ? '선수' : '유스 선수',
    pos: i === 9 ? 'FW' : null,
    rating: i === 9 ? 90 : 50,
    fit: 1,
  })),
  ovr: 56,
  lines: { atk: 60, mid: 52, def: 48, gk: 50 },
  rating: 1000,
  record: { w: 0, d: 0, l: 0 },
  likes: 0,
  views: 0,
  createdAt: '2026-09-29T00:00:00.000Z',
  updatedAt: '2026-09-29T00:00:00.000Z',
};

/** 경기마다 정한 결과로 답하는 서버. plan[i] = i번째 경기의 스코어 · 기대 득점 · 줄 힘. */
async function stub(
  page: Page,
  plan: { score: [number, number]; xg: [number, number]; mine: Lines; opp: Lines }[],
) {
  await page.route(`${API}/v1/profile`, (route) =>
    route.fulfill(
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
  await page.route(`${API}/v1/boards/viewer`, (route) =>
    route.fulfill(ok({ admin: false, google: true, nickname: '구단주' })),
  );
  await page.route(
    (u) => u.href.startsWith(API) && u.pathname === '/v1/owner-team',
    (route) =>
      route.fulfill(
        ok({
          season: 0,
          current: 0,
          seasons: [{ id: 0, name: '프리시즌' }],
          team,
          players: [
            {
              careerId: STRIKER,
              pos: 'FW',
              dpos: 'ST',
              peak: 90,
              roles: { GK: 25, CB: 50, FB: 62, DM: 60, CM: 70, AM: 82, W: 84, ST: 90 },
              attrs: { pac: 88, sho: 91, pas: 70, dri: 84, def: 35, phy: 78 },
              number: 9,
              publicName: '공개 골잡이',
              legendScore: 500,
              cardValue: 543_000,
            },
          ],
          lastManager: null,
          matchesLeft: 10,
          matchesPerDay: 10,
        }),
      ),
  );
  await page.route(`${API}/v1/owner-team/opponents`, (route) =>
    route.fulfill(
      ok({
        items: [
          {
            teamId: RIVAL,
            name: '라이벌 FC',
            owner: '라이벌 감독',
            formation: '4-4-2',
            ovr: 55,
            rating: 1012,
            record: { w: 3, d: 1, l: 2 },
          },
        ],
      }),
    ),
  );
  let n = 0;
  await page.route(`${API}/v1/owner-team/matches`, (route) => {
    const p = plan[n]!;
    n++;
    const lost = p.score[0] < p.score[1];
    return route.fulfill(
      ok(
        {
          match: {
            id: `mat_${n}`,
            home: {
              teamId: MY_TEAM,
              name: '우리 동네 FC',
              owner: '구단주',
              formation: '4-3-3',
              ovr: 56,
              goals: p.score[0],
              ratingChange: lost ? -14 : 20,
              xg: p.xg[0],
              lines: p.mine,
            },
            away: {
              teamId: RIVAL,
              name: '라이벌 FC',
              owner: '라이벌 감독',
              formation: '4-4-2',
              ovr: 55,
              goals: p.score[1],
              ratingChange: lost ? 20 : -7,
              xg: p.xg[1],
              lines: p.opp,
            },
            events: Array.from({ length: p.score[1] }, (_, i) => ({
              minute: 31 + 40 * i,
              side: 'away',
              scorer: '익명의 공격수 No.7',
              assist: null,
              scorerId: null,
              assistId: null,
              slot: 'ST',
            })),
            mine: 'home',
            createdAt: '2026-09-29T03:00:00.000Z',
          },
          record: { w: 0, d: 0, l: n },
          rating: 1000 - 14 * n,
          matchesLeft: 10 - n,
        },
        201,
      ),
    );
  });
}

async function openOpponents(page: Page) {
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await page.locator('[data-act="team"]').click();
  await page.locator('[data-team-tab="opponents"]').click();
}
/** 한 판 걸고 중계를 넘겨 결과 화면까지. */
async function playOne(page: Page) {
  await page.locator('[data-act="team-challenge"]').click();
  await page.locator('[data-team-live] [data-act="live-skip"]').click();
  await expect(page.locator('[data-team-result]')).toBeVisible();
}
const again = (page: Page) =>
  page
    .locator('[data-team-result]')
    .getByRole('button', { name: /다시 경기하기/ })
    .click();

/** PR 설명용 캡처 — STREAK_SHOT_DIR을 줄 때만 찍는다. */
async function shot(page: Page, name: string) {
  if (!SHOT) return;
  await page.setViewportSize({ width: 360, height: 1180 });
  await page.screenshot({ path: `${SHOT}/web-${name}.png` });
  await page.setViewportSize({ width: 360, height: 780 });
}

const EVEN: Lines = { atk: 60, mid: 55, def: 55, gk: 55 };
const SHOT = process.env.STREAK_SHOT_DIR;

test('기대 득점이 앞선 3연패에는 골이 따라오지 않았다고 알리고, 같은 날 다시 띄우지 않는다', async ({
  page,
}) => {
  const unlucky = { score: [0, 1] as [number, number], xg: [2.2, 1.5] as [number, number] };
  await stub(
    page,
    [0, 1, 2, 3].map(() => ({ ...unlucky, mine: EVEN, opp: EVEN })),
  );
  await openOpponents(page);
  const hint = page.locator('[data-streak-hint]');
  await playOne(page);
  await expect(hint).toHaveCount(0);
  await again(page);
  await playOne(page);
  await expect(hint).toHaveCount(0);
  await again(page);
  await playOne(page);
  await expect(hint).toHaveAttribute('data-streak-hint', 'luck');
  await expect(hint.locator('b')).toHaveText('3연패 중이에요');
  await expect(hint.locator('p')).toHaveText(
    '최근 3경기 기대 득점은 6.6 : 4.5로 앞섰어요. 전력은 밀리지 않았고 골이 따라오지 않았어요.',
  );
  await expect(hint.locator('[data-act="team-streak-fix"]')).toHaveCount(0);
  await shot(page, 'luck');
  // 다시 보기를 다녀와도 그대로 있고, 같은 날 네 번째 패배에는 다시 띄우지 않는다.
  await page.locator('[data-act="team-replay"]').click();
  await page.locator('[data-team-live] [data-act="live-skip"]').click();
  await expect(hint).toHaveCount(1);
  await again(page);
  await playOne(page);
  await expect(hint).toHaveCount(0);
});

test('기대 득점이 밀린 3연패에는 가장 밀린 줄을 알리고, 그 자리 바꾸기 버튼은 하나만 둔다', async ({
  page,
}) => {
  const weak = {
    score: [0, 2] as [number, number],
    xg: [1.1, 2.3] as [number, number],
    mine: { atk: 60, mid: 55, def: 46, gk: 48 },
    opp: { atk: 58, mid: 54, def: 57, gk: 56 },
  };
  await stub(page, [weak, weak, weak]);
  await openOpponents(page);
  const hint = page.locator('[data-streak-hint]');
  await playOne(page);
  await again(page);
  await playOne(page);
  await again(page);
  await playOne(page);
  await expect(hint).toHaveAttribute('data-streak-hint', 'weak');
  await expect(hint.locator('p')).toHaveText(
    '최근 3경기에서 수비벽이 상대 공격보다 평균 11 약했어요.',
  );
  await expect(hint.locator('[data-act="team-streak-fix"]')).toContainText(' 바꾸기');
  await expect(page.locator('[data-act="team-report-fix"]')).toHaveCount(0);
  await shot(page, 'weak');
  await hint.locator('[data-act="team-streak-fix"]').click();
  await expect(page.locator('[data-team-result]')).toHaveCount(0);
});

test('이기면 연패가 끊겨 안내가 뜨지 않는다', async ({ page }) => {
  const lose = { score: [0, 1] as [number, number], xg: [2, 1.5] as [number, number] };
  const win = { score: [2, 0] as [number, number], xg: [2, 1.5] as [number, number] };
  await stub(
    page,
    [lose, lose, win, lose].map((x) => ({ ...x, mine: EVEN, opp: EVEN })),
  );
  await openOpponents(page);
  for (let i = 0; i < 4; i++) {
    if (i) await again(page);
    await playOne(page);
    await expect(page.locator('[data-streak-hint]')).toHaveCount(0);
  }
});
