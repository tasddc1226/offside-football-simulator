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
    dpos: 'ST',
    peak: 90,
    roles: { GK: 25, CB: 50, FB: 62, DM: 60, CM: 70, AM: 82, W: 84, ST: 90 },
    attrs: { pac: 88, sho: 91, pas: 70, dri: 84, def: 35, phy: 78 },
    number: 9,
    publicName: '공개 골잡이',
    legendScore: 500,
  },
  {
    careerId: 'c-gk',
    pos: 'GK',
    dpos: null,
    peak: 80,
    roles: null,
    attrs: null,
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
    lines: { atk: 60, mid: 52, def: 48, gk: 50 },
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
  // T-10-092 공격·중원·수비·골문 힘이 보이고, 포메이션을 바꾸면 무게가 옮겨 간다.
  const lines = page.locator('[data-team-lines]');
  await expect(lines).toContainText('공격');
  await expect(lines).toContainText('골문');
  const atk433 = await lines.locator('dd').first().textContent();
  await page.locator('[data-formation="4-4-2"]').click();
  await expect(lines.locator('dd').first()).not.toHaveText(atk433!);
  await page.locator('[data-formation="4-3-3"]').click();
  await expectNoA11yViolations(page);

  // 자리를 눌러 고르는 시트 — 그 자리 능력치로 센 실력 순이다(스트라이커의 윙어 실력 84 = 최고 90의 93%).
  await page.locator('[data-slot="10"]').click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toContainText('윙어');
  await expect(sheet.locator('[data-pick]').nth(1)).toContainText('84');
  await expect(sheet.locator('[data-pick]').nth(1)).toContainText('적합 93%');
  await expect(sheet.locator('[data-pick]').nth(1)).toContainText('SHO 91');
  await sheet.locator('[data-pick-sort="score"]').click();
  await expect(sheet.locator('[data-pick]').nth(1)).toContainText('공개 골잡이');
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

test('시즌 업적 — 단계별로 달성 수를 보이고, 펼치면 업적마다 상태를 보인다', async ({ page }) => {
  await stubOwner(page, true);
  await page.route(`${API}/v1/owner-team`, (route) =>
    route.fulfill(
      ok({ teams: [], slotsMax: 1, players: PLAYERS, matchesLeft: 10, matchesPerDay: 10 }),
    ),
  );
  const seasons: (number | null)[] = [];
  await page.route(`${API}/v1/owner-team/achievements**`, (route) => {
    const q = new URL(route.request().url()).searchParams.get('season');
    const season = q === null || q === '1' ? 1 : null;
    seasons.push(season);
    return route.fulfill(
      ok({
        season,
        seasons: [
          { id: null, name: '프리시즌' },
          { id: 1, name: '시즌 1' },
        ],
        players: season ? 2 : 5,
        groups: [
          {
            id: 'first',
            stage: '0단계',
            title: '축구 인생 출발',
            items: [
              { id: 'retire-FW', label: '공격수 1명 은퇴', done: true },
              { id: 'all-dpos', label: '전 세부 포지션 선수 배출', done: false, cur: 2, max: 8 },
            ],
          },
          {
            id: 'records',
            stage: '1단계',
            title: '기록 쌓기',
            items: [
              { id: 'goals', label: '골', done: true, cur: 370, level: 2, next: 1000, unit: '골' },
            ],
          },
        ],
      }),
    );
  });
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await page.locator('[data-act="team"]').click();
  await page.locator('[data-act="team-achievements"]').click();
  const box = page.locator('[data-club-achievements]');
  await expect(box).toContainText('시즌 1에 처음 뛰어 은퇴한 내 선수 2명');
  const first = box.locator('[data-ach-group="first"]');
  await expect(first).toContainText('1 / 2');
  await first.locator('summary').click();
  await expect(first).toContainText('달성 완료');
  await expect(first).toContainText('2 / 8');
  const records = box.locator('[data-ach-group="records"]');
  await records.locator('summary').click();
  await expect(records).toContainText('2단계 · 370골 · NEXT 1,000');
  await expectNoA11yViolations(page);

  await box.getByLabel('시즌').selectOption({ label: '프리시즌' });
  await expect(box).toContainText('프리시즌에 처음 뛰어 은퇴한 내 선수 5명');
  expect(seasons).toEqual([1, null]);
});
