import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { API, fail, ok } from './helpers.js';

// T-10-092 구단주 팀. 서버는 page.route로 흉내 낸다(경기 결과는 서버가 정한다 — 웹은 받은 결과를 그린다).

const profile = (google: boolean) =>
  ok({
    id: 'u1',
    linked: { google, toss: false },
    googleEmailMasked: google ? 'te***@gmail.com' : null,
    recoveryCodeIssuedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    nickname: google ? '구단주' : null,
  });

const PLAYERS = [
  {
    careerId: 'c-st',
    pos: 'FW',
    dpos: null,
    peak: 90,
    number: 9,
    publicName: '공개 골잡이',
    legendScore: 500,
  },
  {
    careerId: 'c-gk',
    pos: 'GK',
    dpos: null,
    peak: 80,
    number: 1,
    publicName: null,
    legendScore: 300,
  },
];
const FORMATION_433 = ['GK', 'FB', 'CB', 'CB', 'FB', 'DM', 'CM', 'AM', 'W', 'ST', 'W'];
const REC = { w: 0, d: 0, l: 0 };

function teamFrom(body: { name: string; formation: string; slots: (string | null)[] }) {
  return {
    id: 'tem_00000000-0000-4000-8000-000000000001',
    name: body.name,
    formation: body.formation,
    slots: FORMATION_433.map((slot, i) => {
      const id = body.slots[i] ?? null;
      return {
        slot,
        careerId: id,
        name: id ? '선수' : '유스 선수',
        pos: id ? 'FW' : null,
        rating: id ? 80 : 50,
        fit: 1,
      };
    }),
    ovr: 56,
    record: REC,
    createdAt: '2026-09-29T00:00:00.000Z',
    updatedAt: '2026-09-29T00:00:00.000Z',
  };
}

/** 게임 화면처럼 moderate까지 접근성 위반 0(T-10-004). */
async function expectNoA11yViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map((v) => `${v.id} (${v.impact})`)).toEqual([]);
}

async function stubOwner(page: Page, google: boolean) {
  await page.route(`${API}/v1/profile`, (route) => route.fulfill(profile(google)));
  await page.route(`${API}/v1/boards/viewer`, (route) =>
    route.fulfill(ok({ admin: false, google, nickname: google ? '구단주' : null })),
  );
}

test('익명 구단주는 내 팀 대신 구글 로그인 안내를 본다', async ({ page }) => {
  await stubOwner(page, false);
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  const card = page.locator('[data-owner-team]');
  await expect(card).toContainText('구글로 로그인한 구단주만');
  await expect(card.getByRole('button', { name: '구글로 로그인' })).toBeVisible();
  await expect(page.locator('[data-act="team"]')).toHaveCount(0);
});

test('팀을 만들고(자동 배치) 다른 구단주와 경기한다', async ({ page }) => {
  await stubOwner(page, true);
  let getCount = 0;
  let saved: ReturnType<typeof teamFrom> | null = null;
  await page.route(`${API}/v1/owner-team`, async (route) => {
    if (route.request().method() === 'GET') {
      getCount++;
      return route.fulfill(
        ok({
          teams: saved ? [saved] : [],
          slotsMax: 1,
          players: PLAYERS,
          matchesLeft: 10,
          matchesPerDay: 10,
        }),
      );
    }
    saved = teamFrom(route.request().postDataJSON());
    return route.fulfill(ok({ team: saved }));
  });
  await page.route(`${API}/v1/owner-team/opponents`, (route) =>
    route.fulfill(
      ok({
        items: [
          {
            teamId: 'tem_00000000-0000-4000-8000-000000000002',
            name: '라이벌 FC',
            owner: '익명 구단주',
            formation: '4-4-2',
            ovr: 55,
            record: { w: 3, d: 1, l: 2 },
          },
        ],
      }),
    ),
  );
  let played: unknown = null;
  await page.route(`${API}/v1/owner-team/matches`, (route) => {
    if (route.request().method() !== 'POST') return route.fulfill(fail(500, 'X', 'x'));
    played = route.request().postDataJSON();
    return route.fulfill(
      ok(
        {
          match: {
            id: 'mat_1',
            home: {
              teamId: saved!.id,
              name: saved!.name,
              owner: '구단주',
              formation: '4-3-3',
              ovr: 56,
              goals: 2,
            },
            away: {
              teamId: 'tem_00000000-0000-4000-8000-000000000002',
              name: '라이벌 FC',
              owner: '익명 구단주',
              formation: '4-4-2',
              ovr: 55,
              goals: 1,
            },
            events: [
              {
                minute: 12,
                side: 'home',
                scorer: '공개 골잡이',
                assist: null,
                scorerId: 'c-st',
                assistId: null,
              },
              {
                minute: 40,
                side: 'away',
                scorer: '익명의 공격수 No.7',
                assist: '유스 선수',
                scorerId: null,
                assistId: null,
              },
              {
                minute: 77,
                side: 'home',
                scorer: '유스 선수',
                assist: '공개 골잡이',
                scorerId: null,
                assistId: 'c-st',
              },
            ],
            mine: 'home',
            createdAt: '2026-09-29T03:00:00.000Z',
          },
          record: { w: 1, d: 0, l: 0 },
          matchesLeft: 9,
        },
        201,
      ),
    );
  });

  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await page.locator('[data-act="team"]').click();
  await expect(page.locator('h1')).toHaveText('팀 만들기');
  // 저장 전에는 경기할 수 없다.
  await expect(page.locator('[data-act="team-play"]')).toBeDisabled();

  // 구단주 화면을 오가도 같은 요청을 다시 하지 않는다(메모).
  await page.locator('[data-act="team-back"]').click();
  await page.locator('[data-act="team"]').click();
  await expect(page.locator('h1')).toHaveText('팀 만들기');
  expect(getCount).toBe(1);

  await page.locator('[data-team-name]').fill('우리 동네 FC');
  await page.locator('[data-act="team-auto"]').click();
  // 스트라이커 자리(9)에 공격수, 골키퍼 자리(0)에 골키퍼가 들어간다.
  await expect(page.locator('[data-slot="9"]')).toContainText('공개 골잡이');
  await expect(page.locator('[data-slot="0"]')).toContainText('No.1');
  await expect(page.locator('[data-slot="1"]')).toContainText('유스 선수');
  await expectNoA11yViolations(page);

  // 자리를 눌러 고르는 시트 — 적합도와 함께 실력 순이다.
  await page.locator('[data-slot="10"]').click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toContainText('윙어');
  await expect(sheet.locator('[data-pick]').nth(1)).toContainText('적합 95%');
  await sheet.getByRole('button', { name: '닫기' }).first().click();
  await expect(sheet).toHaveCount(0);

  await page.locator('[data-act="team-save"]').click();
  await expect(page.locator('#toast')).toContainText('팀을 만들었어요');
  await expect(page.locator('h1')).toHaveText('우리 동네 FC');

  await page.locator('[data-act="team-play"]').click();
  await expect(page.locator('[data-opponent]')).toContainText('라이벌 FC');
  await page.locator('[data-act="team-challenge"]').click();
  expect(played).toEqual({ opponentTeamId: 'tem_00000000-0000-4000-8000-000000000002' });
  const result = page.locator('[data-team-result]');
  await expect(result.locator('h1')).toHaveText('승리');
  await expect(result.locator('.tm-goals')).toContainText('2:1');
  await expect(result).toContainText('익명의 공격수 No.7');
  await expect(result).toContainText('1승 0무 0패');
  await expectNoA11yViolations(page);
});
