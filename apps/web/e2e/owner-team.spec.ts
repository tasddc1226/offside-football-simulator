import { test, expect, type Page } from '@playwright/test';

// 기본 은퇴 기록은 프리시즌이다. 실제 개막 날짜와 분리해 검증한다.
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-30T00:00:00.000Z'));
});
import type { TeamLayout } from '@offside/contracts/owner-team';
import type { TeamLogo } from '@offside/contracts/team-logo';
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
    careerId: '00000000-0000-4000-8000-000000000011',
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
  {
    careerId: '00000000-0000-4000-8000-000000000012',
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
const MY_TEAM = 'tem_00000000-0000-4000-8000-000000000001';
const RIVAL = 'tem_00000000-0000-4000-8000-000000000002';
const SEASONS = [
  { id: 0, name: '프리시즌' },
  { id: 1, name: '시즌 1' },
];

/** T-11-098 친구·신청 한 사람. */
const person = (code: string, name: string, over: Record<string, unknown> = {}) => ({
  code,
  name,
  team: null,
  h2h: REC,
  ...over,
});

/** GET /v1/owner-team(?season=) 응답. */
const ownerTeam = (over: Record<string, unknown> = {}) =>
  ok({
    season: 0,
    current: 0,
    seasons: SEASONS.slice(0, 1),
    team: null,
    players: PLAYERS,
    lastManager: null,
    matchesLeft: 10,
    matchesPerDay: 10,
    ...over,
  });
/** /v1/owner-team 자체(쿼리 포함) — 하위 경로(/matches 등)는 빼고. */
const ownerTeamUrl = (u: URL) => u.href.startsWith(API) && u.pathname === '/v1/owner-team';

function teamFrom(body: {
  name: string;
  manager?: string;
  formation: string;
  slots: (string | null)[];
  layout?: TeamLayout | null;
  logo?: TeamLogo | null;
}) {
  return {
    id: MY_TEAM,
    season: 0,
    name: body.name,
    manager: body.manager ?? '홍감독',
    formation: body.formation,
    layout: body.layout ?? null,
    logo: body.logo ?? null,
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
    rating: 1000,
    record: REC,
    likes: 0,
    views: 0,
    createdAt: '2026-09-29T00:00:00.000Z',
    updatedAt: '2026-09-29T00:00:00.000Z',
  };
}

/** 게임 화면처럼 moderate까지 접근성 위반 0(T-10-004). */
async function expectNoA11yViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(
    violations.map(
      (v) => `${v.id} (${v.impact}) ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
    ),
  ).toEqual([]);
}

async function stubOwner(page: Page, google: boolean) {
  await page.route(`${API}/v1/profile`, (route) => route.fulfill(profile(google)));
  await page.route(`${API}/v1/boards/viewer`, (route) =>
    route.fulfill(ok({ admin: false, google, nickname: google ? '구단주' : null })),
  );
}

// T-10-102 비로그인 구단주는 안내 카드와 로그인 버튼 하나만 — 로그인해야 쓰는 내 팀은 숨긴다.
test('익명 구단주는 내 팀 대신 구글 로그인 버튼 하나만 본다', async ({ page }) => {
  await stubOwner(page, false);
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await expect(page.locator('#account-slot')).toContainText('로그인하지 않았어요');
  await expect(page.getByRole('link', { name: '구글로 로그인' })).toHaveCount(1);
  await expect(page.getByRole('button', { name: '구글로 로그인' })).toHaveCount(0);
  await expect(page.locator('[data-owner-team]')).toHaveCount(0);
  await expect(page.locator('[data-act="team"]')).toHaveCount(0);
  await expect(page.locator('[data-settings-open="clubs"]')).toHaveCount(0); // 환경설정으로 옮겼다.
  // T-10-103 이 기기에 은퇴한 선수가 없으면 빈 '내 선수'도 숨긴다.
  await expect(page.locator('[data-my-players]')).toHaveCount(0);
});

test('익명 구단주도 이 기기에 은퇴한 선수가 있으면 내 선수를 본다', async ({ page }) => {
  await stubOwner(page, false);
  await page.route(`${API}/v1/careers/mine`, (r) => r.fulfill(ok({ linked: false, entries: [] })));
  await page.addInitScript(() =>
    localStorage.setItem(
      'ft_hof',
      JSON.stringify([
        {
          name: '기기왕',
          pos: 'FW',
          number: 9,
          peak: 80,
          age: 34,
          apps: 300,
          goals: 100,
          assists: 50,
          trophies: 0,
          awards: 0,
          caps: 0,
          ballon: 0,
          lastClub: '서울 FC',
          score: 400,
          date: '2026-09-01',
          // T-11-080a 서버 값이 없으면 이 기기 시즌 기록으로 은퇴 가치를 계산한다.
          detail: {
            career: [
              { league: 'K리그1', ovr: 78, age: 26 },
              { league: 'K리그1', ovr: 80, age: 27 },
              { league: 'K리그1', ovr: 79, age: 28 },
            ],
          },
        },
      ]),
    ),
  );
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await expect(page.locator('[data-my-players]')).toContainText('기기왕');
  await expect(page.locator('[data-my-source]')).toHaveAttribute('data-my-source', 'device');
  await expect(page.locator('[data-owner-value] dt')).toHaveText('구단 가치');
  await expect(page.locator('[data-owner-value] dd')).toContainText('억');
});

test('팀을 만들고(자동 배치) 다른 구단주와 경기한다', async ({ page }) => {
  await stubOwner(page, true);
  let getCount = 0;
  let saved: ReturnType<typeof teamFrom> | null = null;
  let body: Record<string, unknown> | null = null;
  await page.route(ownerTeamUrl, async (route) => {
    if (route.request().method() === 'GET') {
      getCount++;
      return route.fulfill(ownerTeam({ team: saved }));
    }
    body = route.request().postDataJSON();
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
              ratingChange: 16,
            },
            away: {
              teamId: 'tem_00000000-0000-4000-8000-000000000002',
              name: '라이벌 FC',
              owner: '익명 구단주',
              formation: '4-4-2',
              ovr: 55,
              goals: 1,
              ratingChange: -8,
            },
            events: [
              {
                minute: 12,
                side: 'home',
                scorer: '공개 골잡이',
                assist: null,
                scorerId: '00000000-0000-4000-8000-000000000011',
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
                assistId: '00000000-0000-4000-8000-000000000011',
              },
            ],
            mine: 'home',
            createdAt: '2026-09-29T03:00:00.000Z',
          },
          record: { w: 1, d: 0, l: 0 },
          rating: 1016,
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
  // 저장 전에는 경기할 수 없다 — 하단 '경기' 탭은 상대 대신 이유를 보인다.
  await page.locator('[data-team-tab="opponents"]').click();
  await expect(page.locator('[data-match-hint]')).toContainText('저장');
  await expect(page.locator('[data-opponent]')).toHaveCount(0);
  await page.locator('[data-team-tab="team"]').click();

  // 구단주 화면을 오가도 같은 요청을 다시 하지 않는다(메모).
  await page.locator('[data-act="team-back"]').click();
  await page.locator('[data-act="team"]').click();
  await expect(page.locator('h1')).toHaveText('팀 만들기');
  expect(getCount).toBe(1);

  await page.locator('[data-team-name]').fill('우리 동네 FC');
  // 감독 이름이 비면 저장할 수 없다.
  await expect(page.locator('[data-act="team-save"]')).toBeDisabled();
  await page.locator('[data-team-manager]').fill('홍감독');
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

  // 라커룸에서 선발도 보여 주고 선택한 선수를 다른 자리에 배치한다.
  const locker = page.locator('[data-team-locker]');
  await locker.getByLabel('선발 선수 포함').check();
  await locker
    .locator('[data-locker-player="00000000-0000-4000-8000-000000000011"] .locker-select')
    .click();
  await expect(page.locator('[data-act="team-to-pitch"]')).toBeVisible();
  await page.locator('[data-slot="10"]').click();
  await expect(page.locator('[data-slot="10"]')).toContainText('84');
  await expect(page.locator('[data-slot="9"]')).toContainText('유스 선수');
  await expect(locker).toContainText('LS');
  // T-11-080 카드 기준가. 기준가가 없는 선수(능력치 기록 없음)는 그 안내가 먼저다.
  await expect(locker).toContainText('기준가 54억 3천만');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.locator('[data-act="team-logo-open"]').click();
  await page.locator('[data-logo-text]').fill('FC');
  await page.locator('[data-logo-shape="r"]').click();
  await page.locator('[data-act="team-logo-apply"]').click();

  await page.locator('[data-act="team-save"]').click();
  await expect(page.locator('#toast')).toContainText('팀을 만들었어요');
  await expect(page.locator('h1')).toHaveText('우리 동네 FC');
  expect(body).toMatchObject({ name: '우리 동네 FC', manager: '홍감독', formation: '4-3-3' });
  await expect(page.locator('[data-team-record] dd').nth(1)).toHaveText('1,000');

  await page.locator('[data-team-tab="opponents"]').click();
  await expect(page.locator('[data-opponent]')).toContainText('라이벌 FC');
  await page.locator('[data-act="team-challenge"]').click();
  expect(played).toEqual({ opponentTeamId: 'tem_00000000-0000-4000-8000-000000000002' });
  // T-10-097 결과 전에 문자중계가 먼저 흐른다 — 킥오프 줄로 시작하고, 건너뛰면 결과 화면.
  const live = page.locator('[data-team-live]');
  await expect(live.locator('[data-live-line="kickoff"]')).toContainText('킥오프');
  await expect(live.locator('[data-live-score]')).toContainText('0');
  await expectNoA11yViolations(page);
  await live.locator('[data-act="live-skip"]').click();
  await expect(live).toHaveCount(0);
  const result = page.locator('[data-team-result]');
  await expect(result.locator('h1')).toHaveText('승리');
  await expect(result.locator('.tm-goals')).toContainText('2:1');
  await expect(result).toContainText('익명의 공격수 No.7');
  await expect(result).toContainText('1승 0무 0패');
  await expect(result.locator('[data-rating-change]')).toContainText('내 팀 레이팅 +16');
  await expectNoA11yViolations(page);
  await result.locator('[data-act="team-replay"]').click();
  await expect(live.locator('[data-live-line="kickoff"]')).toContainText('킥오프');
  await live.locator('[data-act="live-skip"]').click();
  await result.getByRole('button', { name: '편성으로' }).click();
  await expect(page.locator('[data-team-record] dd').nth(1)).toHaveText('1,016');
});

test('시즌 업적 — 등급·점수·랭킹 순위, 분류별 단계 묶음과 업적마다 상태·점수를 보인다', async ({
  page,
}) => {
  await stubOwner(page, true);
  await page.route(ownerTeamUrl, (route) =>
    route.fulfill(ownerTeam({ season: 1, current: 1, seasons: SEASONS })),
  );
  const seasons: number[] = [];
  await page.route(`${API}/v1/owner-team/achievements**`, (route) => {
    const q = new URL(route.request().url()).searchParams.get('season');
    const season = Number(q ?? 1);
    seasons.push(season);
    return route.fulfill(
      ok({
        season,
        seasons: SEASONS,
        players: season ? 2 : 5,
        score: 340,
        rank: 12,
        ranked: 297,
        groups: [
          {
            id: 'first',
            category: 'player',
            stage: '0단계',
            title: '축구 인생 출발',
            items: [
              { id: 'retire-FW', label: '공격수 1명 은퇴', done: true, points: 10, worth: 0 },
              {
                id: 'all-dpos',
                label: '전 세부 포지션 선수 배출',
                done: false,
                cur: 2,
                max: 8,
                points: 0,
                worth: 10,
              },
            ],
          },
          {
            id: 'records',
            category: 'player',
            stage: '1단계',
            title: '기록 쌓기',
            items: [
              {
                id: 'goals',
                label: '골',
                done: true,
                cur: 370,
                level: 2,
                next: 1000,
                unit: '골',
                points: 30,
                worth: 40,
              },
            ],
          },
          {
            id: 'owner',
            category: 'owner',
            stage: 'OWNER',
            title: '구단 운영',
            items: [
              {
                id: 'owner-nickname',
                label: '공개 닉네임 정하기',
                done: true,
                points: 10,
                worth: 0,
              },
            ],
          },
          {
            id: 'manager',
            category: 'manager',
            stage: 'MANAGER',
            title: '감독 커리어',
            items: [],
            locked: true,
          },
        ],
      }),
    );
  });
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await page.locator('[data-act="team"]').click();
  await page.locator('[data-team-tab="achievements"]').click();
  const box = page.locator('[data-club-achievements]');
  await expect(box).toContainText('시즌 1에 처음 뛰어 은퇴한 내 선수 2명');
  // T-11-028 맨 위 요약 — 등급·점수·다음 등급까지·업적 랭킹 순위, 그리고 다음 목표(얻을 점수).
  const sum = box.locator('[data-ach-summary]');
  await expect(sum).toContainText('브론즈');
  await expect(sum).toContainText('340');
  await expect(sum).toContainText('실버까지 160점 · 업적 3/4 달성');
  await expect(sum).toContainText('12위 · 297명 중');
  await expect(box.locator('[data-ach-near]')).toContainText('전 세부 포지션 선수 배출');
  await expect(box.locator('[data-ach-near]')).toContainText('+40점');
  // 분류 탭: 처음은 선수, 다 채우지 못한 첫 단계는 펼쳐 둔다.
  await expect(box.locator('[data-ach-cat]')).toHaveCount(3);
  await expect(box.locator('[data-ach-cat="player"]')).toHaveAttribute('aria-selected', 'true');
  const first = box.locator('[data-ach-group="first"]');
  await expect(first).toContainText('1/2');
  await expect(first).toHaveAttribute('open', '');
  await expect(first).toContainText('달성 완료');
  await expect(first).toContainText('+10점');
  await expect(first).toContainText('2 / 8');
  const records = box.locator('[data-ach-group="records"]');
  await records.locator('summary').click();
  await expect(records).toContainText('2단계 · 370골 · NEXT 1,000');
  await box.locator('[data-ach-cat="owner"]').click();
  await expect(box.locator('[data-ach-group="owner"]')).toContainText('공개 닉네임 정하기');
  await expect(box.locator('[data-ach-group="first"]')).toHaveCount(0);
  // 감독 업적은 감독 시뮬레이션이 열릴 때까지 잠금으로 예고만 한다.
  await box.locator('[data-ach-cat="manager"]').click();
  await expect(box.locator('[data-ach-group="manager"]')).toContainText('감독 시뮬레이션이 열리면');
  await expectNoA11yViolations(page);

  await box.getByLabel('시즌').selectOption({ label: '프리시즌' });
  await expect(box).toContainText('프리시즌에 처음 뛰어 은퇴한 내 선수 5명');
  expect(seasons).toEqual([1, 0]);
});

test('업적 랭킹 — 내 업적 요약에서 기록실 업적 랭킹으로 가고, 팀이 있는 줄은 팀 프로필을 연다', async ({
  page,
}) => {
  await stubOwner(page, true);
  await page.route(ownerTeamUrl, (route) =>
    route.fulfill(ownerTeam({ season: 1, current: 1, seasons: SEASONS })),
  );
  await page.route(`${API}/v1/owner-team/achievements**`, (route) =>
    route.fulfill(
      ok({
        season: 1,
        seasons: SEASONS,
        players: 0,
        score: 0,
        rank: null,
        ranked: 2,
        // 서버는 선수 업적과 잠긴 감독 업적을 늘 보낸다.
        groups: [
          {
            id: 'first',
            category: 'player',
            stage: '0단계',
            title: '첫 발자국',
            items: [{ id: 'first-retire', label: '첫 은퇴', done: false, points: 0, worth: 10 }],
          },
          {
            id: 'manager',
            category: 'manager',
            stage: 'MANAGER',
            title: '감독 커리어',
            items: [],
            locked: true,
          },
        ],
      }),
    ),
  );
  await page.route(`${API}/v1/achievements/ranking**`, (route) =>
    route.fulfill(
      ok({
        season: 1,
        seasons: SEASONS,
        page: 1,
        total: 2,
        items: [
          {
            rank: 1,
            nickname: '하람아빠',
            team: { id: RIVAL, name: '하람 유나이티드' },
            score: 2450,
            done: 40,
            players: 30,
          },
          { rank: 2, nickname: null, team: null, score: 120, done: 4, players: 3 },
        ],
      }),
    ),
  );
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await page.locator('[data-act="team"]').click();
  await page.locator('[data-team-tab="achievements"]').click();
  await expect(page.locator('[data-ach-summary]')).toContainText(
    '업적을 하나 달성하면 랭킹에 올라요',
  );
  await page.locator('[data-act="ach-ranking"]').click();
  await expect(page.locator('[data-hof-tab="ach"]')).toHaveAttribute('aria-selected', 'true');
  const board = page.locator('[data-ach-ranking]');
  await expect(board).toContainText('구단주 2명');
  await expect(board.locator('[data-ach-rank="1"]')).toContainText('하람아빠');
  await expect(board.locator('[data-ach-rank="1"] [data-ach-grade]')).toHaveAttribute(
    'aria-label',
    '다이아',
  );
  await expect(board.locator('[data-ach-rank="2"]')).toContainText('익명 구단주');
  await expect(board.locator('[data-ach-rank="2"] [data-ach-grade]')).toHaveAttribute(
    'aria-label',
    '루키',
  );
  await expect(board.locator('.achievement-row .grade-badge')).toHaveCount(2);
  await expect(board.locator('.achievement-row .ach-grade')).toHaveCount(0);
  await expect(board.locator('[data-ach-preview-toggle]')).toHaveCount(0);
  await board.locator('.ach-grades summary').click();
  await expect(board.locator('.ach-grades .grade-badge')).toHaveCount(7);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(board.locator('.ach-grades .badge-orbit').first()).toHaveCSS(
    'animation-name',
    'none',
  );
  await expect(board.locator('.achievement-row .badge-shine').first()).toBeHidden();
  await expectNoA11yViolations(page);
  await board.locator('[data-ach-rank="1"]').click();
  await expect(page.locator('[data-hof-tab="teams"]')).toHaveAttribute('aria-selected', 'true');
});

test('시즌별 팀 — 지난 시즌 팀은 보기만 하고, 라이브 랭킹에서 팀 프로필을 열어 좋아요를 누른다', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-10-06T00:01:00.000Z'));
  await stubOwner(page, true);
  const pre = {
    ...teamFrom({
      name: '프리 FC',
      formation: '4-3-3',
      slots: [
        '00000000-0000-4000-8000-000000000012',
        ...Array(8).fill(null),
        '00000000-0000-4000-8000-000000000011',
      ],
    }),
    record: { w: 5, d: 1, l: 2 },
    rating: 1040,
  };
  await page.route(ownerTeamUrl, (route) => {
    const q = new URL(route.request().url()).searchParams.get('season');
    return route.fulfill(
      q === '0'
        ? ownerTeam({ season: 0, current: 1, seasons: SEASONS, team: pre })
        : ownerTeam({
            season: 1,
            current: 1,
            seasons: SEASONS,
            players: [],
            lastManager: '홍감독',
          }),
    );
  });
  const rankQueries: string[] = [];
  await page.route(`${API}/v1/teams?*`, (route) => {
    const sp = new URL(route.request().url()).searchParams;
    rankQueries.push(sp.toString());
    return route.fulfill(
      ok({
        season: Number(sp.get('season') ?? 1),
        seasons: SEASONS,
        sort: sp.get('sort') ?? 'rating',
        page: 1,
        total: 2,
        items: [
          {
            rank: 1,
            teamId: RIVAL,
            name: '라이벌 FC',
            manager: '라이벌 감독',
            formation: '4-4-2',
            ovr: 70,
            rating: 1100,
            record: { w: 9, d: 0, l: 1 },
            likes: 3,
            createdAt: '2026-09-29T00:00:00.000Z',
          },
          {
            rank: 2,
            teamId: MY_TEAM,
            name: '프리 FC',
            manager: '홍감독',
            formation: '4-3-3',
            ovr: 56,
            rating: 1040,
            record: { w: 5, d: 1, l: 2 },
            likes: 0,
            createdAt: '2026-09-29T00:00:00.000Z',
          },
        ],
      }),
    );
  });
  let views = 0;
  const likes: string[] = [];
  await page.route(`${API}/v1/teams/${RIVAL}**`, (route) => {
    const req = route.request();
    if (req.url().endsWith('/views')) {
      views++;
      return route.fulfill({ status: 204, body: '' });
    }
    if (req.url().endsWith('/like')) {
      likes.push(req.method());
      return route.fulfill(
        ok({ liked: req.method() === 'PUT', likes: req.method() === 'PUT' ? 4 : 3 }),
      );
    }
    return route.fulfill(
      ok({
        team: {
          ...teamFrom({ name: '라이벌 FC', formation: '4-4-2', slots: Array(11).fill(null) }),
          id: RIVAL,
          season: 1,
          seasonName: '시즌 1',
          rank: 1,
          manager: '라이벌 감독',
          rating: 1100,
          record: { w: 9, d: 0, l: 1 },
          goals: { for: 31, against: 8 },
          likes: 3,
          views: 41,
          badges: [
            { id: 'final-1', label: '시즌 우승', desc: '프리시즌 최종 1위' },
            { id: 'streak-5', label: '5연승', desc: '5경기를 내리 이겼다' },
          ],
        },
        liked: false,
        mine: false,
        friend: 'none',
      }),
    );
  });
  const friendBodies: unknown[] = [];
  await page.route(`${API}/v1/friends/requests`, (route) => {
    friendBodies.push(route.request().postDataJSON());
    return route.fulfill(ok({ state: 'sent', friend: person('RIVA2345', '라이벌 감독') }, 201));
  });

  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await page.locator('[data-act="team"]').click();
  // 새 시즌 — 팀이 없고 감독 이름은 지난 팀에서 채워 둔다.
  await expect(page.locator('h1')).toHaveText('팀 만들기');
  await expect(page.locator('[data-team-manager]')).toHaveValue('홍감독');
  await expect(page.locator('.tm-head')).toContainText('시즌 1에 뛰고 은퇴한');

  // 지난 시즌 팀은 보기만 한다.
  await page.locator('[data-team-season]').selectOption({ label: '프리시즌' });
  await expect(page.locator('h1')).toHaveText('프리 FC');
  await expect(page.locator('[data-team-readonly]')).toBeVisible();
  await expect(page.locator('[data-act="team-save"]')).toHaveCount(0);
  await expect(page.locator('[data-team-record] dd').nth(1)).toHaveText('1,040');
  await expect(page.locator('button[data-slot]')).toHaveCount(0);
  await expect(page.locator('div[data-slot="9"]')).toContainText('공개 골잡이');
  await expectNoA11yViolations(page);

  // 기록실의 팀 랭킹 → 다른 팀 프로필(조회수 한 번) → 좋아요.
  await page.locator('[data-act="team-back"]').click();
  await page.locator('[data-act="hof"]').click();
  await page.locator('[data-hof-tab="teams"]').click();
  await expect(page.locator('[data-hof-tab="teams"]')).toHaveAttribute('aria-selected', 'true');
  const list = page.locator('[data-team-ranking]');
  await expect(list.locator('[data-rank-team]')).toHaveCount(2);
  await expect(list.locator('[data-rank-team]').first()).toContainText('라이벌 FC');
  await expect(list.locator('[data-rank-team]').first()).toContainText('1,100');
  await list.locator('[data-rank-sort="ovr"]').click();
  await expect.poll(() => rankQueries.at(-1)).toBe('sort=ovr&page=1');
  await list.locator(`[data-rank-team="${RIVAL}"]`).click();
  const prof = page.locator(`[data-team-profile="${RIVAL}"]`);
  await expect(prof).toContainText('라이벌 FC');
  await expect(prof).toContainText('감독 라이벌 감독');
  await expect(prof).toContainText('RANK #1');
  await expect(page.locator('[data-team-history]')).toContainText('시즌 우승');
  await expect(page.locator('[data-team-history]')).toContainText('5연승');
  await expect(page.getByText('조회수 42')).toBeVisible();
  expect(views).toBe(1);
  const like = page.locator('[data-act="team-like"]');
  await like.click();
  await expect(like).toHaveAttribute('aria-pressed', 'true');
  await expect(like).toContainText('4');
  await expectNoA11yViolations(page);
  await like.click();
  await expect(like).toContainText('3');
  expect(likes).toEqual(['PUT', 'DELETE']);
  // T-11-098 팀 프로필에서 그 구단주에게 친구 신청을 보낸다.
  const befriend = page.locator('[data-act="team-friend"]');
  await expect(befriend).toHaveText('친구 신청');
  await befriend.click();
  await expect(page.locator('#toast')).toContainText('친구 신청을 보냈어요');
  await expect(befriend).toHaveText('신청 보냄');
  await expect(befriend).toBeDisabled();
  expect(friendBodies).toEqual([{ teamId: RIVAL }]);
  await page.locator('[data-act="team-profile-back"]').click();
  await expect(list).toBeVisible();
});

// T-11-034 업적 달성 알림: 업적이 바뀌었을 수 있는 쓰기 뒤(dirty) 홈에 오면 업적을 받아 지난번 본 기록과 비교한다 —
// 새 업적이 있으면 시트(등급이 올랐으면 승급)와 하단 '구단주' 점, 업적 탭을 열면 NEW를 붙이고 점을 지운다.
test('업적 달성 알림 — 쓰기 뒤 홈에서 승급 시트, 업적 보기로 NEW를 보고 점이 사라진다', async ({
  page,
}) => {
  await stubOwner(page, true);
  await page.route(ownerTeamUrl, (route) =>
    route.fulfill(ownerTeam({ season: 1, current: 1, seasons: SEASONS })),
  );
  let calls = 0;
  await page.route(`${API}/v1/owner-team/achievements**`, (route) => {
    calls++;
    return route.fulfill(
      ok({
        season: 1,
        seasons: SEASONS,
        players: 2,
        score: 210,
        rank: 40,
        ranked: 297,
        groups: [
          {
            id: 'first',
            category: 'player',
            stage: '0단계',
            title: '축구 인생 출발',
            items: [
              { id: 'retire-FW', label: '공격수 1명 은퇴', done: true, points: 190, worth: 0 },
              { id: 'retire-GK', label: '골키퍼 1명 은퇴', done: true, points: 20, worth: 0 },
            ],
          },
        ],
      }),
    );
  });
  await page.addInitScript(() => {
    // 새로고침에도 다시 심지 않게 첫 로드에만.
    if (sessionStorage.getItem('__ach_seeded')) return;
    sessionStorage.setItem('__ach_seeded', '1');
    localStorage.setItem(
      'ft_ach_seen',
      JSON.stringify({ season: 1, pts: { 'retire-FW': 190 }, score: 190, unseen: [] }),
    );
    localStorage.setItem('ft_ach_dirty', 'true');
  });
  await page.goto('/');
  const sheet = page.locator('[data-ach-sheet]');
  await expect(sheet).toContainText('브론즈 등급이 됐어요');
  await expect(sheet).toHaveAttribute('class', /grade/);
  await expect(page.locator('.sheet')).toContainText('골키퍼 1명 은퇴');
  await expect(page.locator('.sheet')).toContainText('실버까지 290점');
  await expect(page.locator('[data-act="owner"] .tab-dot')).toContainText('새 업적 1개');
  // 시트가 떠오르는 모션(페이드·엠블럼 팝)이 끝난 뒤 명도 대비를 잰다.
  await page.waitForFunction(() =>
    document
      .querySelector('.modal')!
      .getAnimations({ subtree: true })
      .filter((a) => a.effect?.getTiming().iterations !== Infinity)
      .every((a) => a.playState !== 'running'),
  );
  await expectNoA11yViolations(page);

  await page.getByRole('button', { name: '업적 보기' }).click();
  const box = page.locator('[data-club-achievements]');
  await expect(box.locator('.tm-ach-new')).toHaveCount(1);
  await expect(box.locator('[data-ach-group="first"]')).toContainText('골키퍼 1명 은퇴NEW');
  await expect(page.locator('.tab-dot')).toHaveCount(0);
  // 알림 확인 한 번 + 업적 탭 한 번. 본 기록을 적었으니 다시 열어도 점·시트가 돌아오지 않는다.
  expect(calls).toBe(2);
  await page.reload();
  await expect(page.locator('[data-club-achievements], [data-act="owner"]').first()).toBeVisible();
  await expect(page.locator('.tab-dot')).toHaveCount(0);
  await expect(page.locator('[data-ach-sheet]')).toHaveCount(0);
});

test('모바일 편성 초안은 화면 왕복·새로고침에도 복원되고 저장 실패에는 남는다', async ({
  page,
}) => {
  await stubOwner(page, true);
  let saved = teamFrom({
    name: '우리 FC',
    manager: '홍감독',
    formation: '4-3-3',
    slots: Array(11).fill(null),
  });
  let failSave = true;
  let puts = 0;
  await page.route(ownerTeamUrl, async (route) => {
    if (route.request().method() === 'GET') return route.fulfill(ownerTeam({ team: saved }));
    puts++;
    if (failSave)
      return route.fulfill(fail(503, 'SERVICE_UNAVAILABLE', '잠시 뒤 다시 저장해 주세요.'));
    saved = teamFrom(route.request().postDataJSON());
    return route.fulfill(ok({ team: saved }));
  });
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await page.locator('[data-act="team"]').click();
  await expect(page.locator('[data-act="team-save"]')).toHaveCount(0);
  await page
    .locator('[data-locker-player="00000000-0000-4000-8000-000000000011"] .locker-select')
    .click();
  await page.locator('[data-slot="9"]').click();
  await expect(page.locator('[data-act="team-save"]')).toBeVisible();
  await page.locator('[data-act="team-back"]').click();
  await page.locator('[data-act="team"]').click();
  await expect(page.locator('[data-slot="9"]')).toContainText('공개 골잡이');
  await expect(page.locator('[data-act="team-draft-discard"]')).toBeVisible();
  await page.reload();
  await page.locator('[data-act="owner"]').click();
  await page.locator('[data-act="team"]').click();
  await expect(page.locator('[data-slot="9"]')).toContainText('공개 골잡이');
  await page.locator('[data-act="team-save"]').click();
  await expect(page.locator('#toast')).toContainText('잠시 뒤');
  await expect(page.locator('[data-slot="9"]')).toContainText('공개 골잡이');
  await expect(page.locator('[data-act="team-save"]')).toBeEnabled();
  failSave = false;
  await page.locator('[data-act="team-save"]').click();
  await expect(page.locator('[data-act="team-save"]')).toHaveCount(0);
  expect(puts).toBe(2);
  await expectNoA11yViolations(page);
});

// ───────── T-11-098 친구 · 친선전 ─────────

const FRIEND_TEAM = {
  id: RIVAL,
  name: '친구 FC',
  logo: null,
  ovr: 61,
  filled: 4,
};
/** GET /v1/friends 응답. */
const friendsBody = (over: Record<string, unknown> = {}) => ({
  code: 'MYCD2345',
  friends: [] as unknown[],
  received: [] as unknown[],
  sent: [] as unknown[],
  recent: [] as unknown[],
  matchesLeft: 10,
  matchesPerDay: 10,
  max: 50,
  canPlay: true,
  ...over,
});
const FRIENDLY = {
  id: 'fmt_1',
  home: {
    teamId: MY_TEAM,
    name: '우리 FC',
    owner: '홍감독',
    formation: '4-3-3',
    ovr: 56,
    goals: 1,
    ratingChange: null,
  },
  away: {
    teamId: RIVAL,
    name: '친구 FC',
    owner: '친구 감독',
    formation: '4-4-2',
    ovr: 61,
    goals: 1,
    ratingChange: null,
  },
  events: [
    {
      minute: 20,
      side: 'home',
      scorer: '공개 골잡이',
      assist: null,
      scorerId: null,
      assistId: null,
    },
    { minute: 70, side: 'away', scorer: '유스 선수', assist: null, scorerId: null, assistId: null },
  ],
  mine: 'home',
  friendly: true,
  createdAt: '2026-09-29T03:00:00.000Z',
};

test('친구 — 코드로 신청하고 받은 신청을 수락하고 친선전을 치른다', async ({ page }) => {
  await stubOwner(page, true);
  const myTeam = teamFrom({
    name: '우리 FC',
    formation: '4-3-3',
    slots: [
      PLAYERS[1]!.careerId,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      PLAYERS[0]!.careerId,
    ],
  });
  await page.route(ownerTeamUrl, (route) => route.fulfill(ownerTeam({ team: myTeam })));
  let opponentsGets = 0;
  await page.route(`${API}/v1/owner-team/opponents`, (route) => {
    opponentsGets++;
    return route.fulfill(ok({ items: [] }));
  });
  // 서버 상태를 흉내 낸다: 받은 신청 하나로 시작한다.
  let state = friendsBody({ received: [person('FRND2345', '친구 감독', { team: FRIEND_TEAM })] });
  let friendsGets = 0;
  await page.route(`${API}/v1/friends`, (route) => {
    friendsGets++;
    return route.fulfill(ok(state));
  });
  const requests: unknown[] = [];
  await page.route(`${API}/v1/friends/requests`, (route) => {
    requests.push(route.request().postDataJSON());
    const sent = person('WXYZ2345', '새 친구');
    state = { ...state, sent: [sent] };
    return route.fulfill(ok({ state: 'sent', friend: sent }, 201));
  });
  await page.route(`${API}/v1/friends/FRND2345/accept`, (route) => {
    const p = person('FRND2345', '친구 감독', { team: FRIEND_TEAM });
    state = { ...state, received: [], friends: [p] };
    return route.fulfill(ok({ state: 'accepted', friend: p }));
  });
  let played = 0;
  await page.route(`${API}/v1/friends/FRND2345/matches`, (route) => {
    played++;
    state = {
      ...state,
      matchesLeft: 9,
      friends: [person('FRND2345', '친구 감독', { team: FRIEND_TEAM, h2h: { w: 0, d: 1, l: 0 } })],
      recent: [FRIENDLY],
    };
    return route.fulfill(ok({ match: FRIENDLY, h2h: { w: 0, d: 1, l: 0 }, matchesLeft: 9 }, 201));
  });

  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await page.locator('[data-act="team"]').click();
  await page.locator('[data-team-tab="opponents"]').click();
  await expect.poll(() => opponentsGets).toBe(1);
  // 친구 쪽은 열 때만 불러온다.
  expect(friendsGets).toBe(0);
  await page.locator('[data-match-mode="friends"]').click();
  const panel = page.locator('[data-friends]');
  await expect(panel.locator('[data-friend-code]')).toHaveText('MYCD-2345');
  await expect(panel).toContainText('오늘 남은 친선전 10/10');
  await expect(panel).toContainText('아직 친구가 없어요');
  expect(friendsGets).toBe(1);
  await expectNoA11yViolations(page);

  // 틀린 코드는 보내지 않고, 소문자·하이픈 코드는 정리해서 보낸다.
  const input = panel.locator('[data-friend-code-input]');
  await input.fill('abc');
  await panel.locator('[data-act="friend-request"]').click();
  await expect(page.locator('#toast')).toContainText('친구 코드 8자리를 확인해 주세요.');
  await input.fill('wxyz-2345');
  await panel.locator('[data-act="friend-request"]').click();
  await expect(page.locator('#toast')).toContainText('친구 신청을 보냈어요');
  expect(requests).toEqual([{ code: 'WXYZ2345' }]);
  await expect(panel.locator('[data-friend-sent="WXYZ2345"]')).toContainText('새 친구');

  await panel.locator('[data-friend-received="FRND2345"] [data-act="friend-accept"]').click();
  await expect(page.locator('#toast')).toContainText('친구 감독 님과 친구가 됐어요');
  const row = panel.locator('[data-friend="FRND2345"]');
  await expect(row).toContainText('친구 FC · OVR 61');
  const gets = friendsGets;

  // 랭크 경기로 갔다가 돌아와도 친구 목록을 다시 부르지 않는다(메모).
  await page.locator('[data-match-mode="ranked"]').click();
  await page.locator('[data-match-mode="friends"]').click();
  await expect(row).toBeVisible();
  expect(friendsGets).toBe(gets);
  expect(opponentsGets).toBe(1);

  await row.locator('[data-act="friend-play"]').click();
  expect(played).toBe(1);
  const live = page.locator('[data-team-live]');
  await live.locator('[data-act="live-skip"]').click();
  const result = page.locator('[data-team-result]');
  await expect(result.locator('[data-friendly]')).toHaveText('친선전');
  await expect(result.locator('h1')).toHaveText('무승부');
  await expect(result.locator('[data-rating-change]')).toHaveCount(0);
  await expect(result).not.toContainText('내 팀');
  await result.getByRole('button', { name: '다시 경기하기' }).click();
  await expect(row).toContainText('상대 전적 0승 1무 0패');
  await expect(panel).toContainText('오늘 남은 친선전 9/10');
  await expect(panel.locator('[data-friendly-match="fmt_1"]')).toContainText('친선전 · 친구 감독');
});

test('친구 초대 링크로 들어오면 친구 화면에서 그 구단주에게 신청한다', async ({ page }) => {
  await stubOwner(page, true);
  await page.route(ownerTeamUrl, (route) => route.fulfill(ownerTeam()));
  await page.route(`${API}/v1/friends`, (route) =>
    route.fulfill(ok(friendsBody({ canPlay: false }))),
  );
  const requests: unknown[] = [];
  await page.route(`${API}/v1/friends/requests`, (route) => {
    requests.push(route.request().postDataJSON());
    return route.fulfill(ok({ state: 'sent', friend: person('ABCD2345', '초대한 감독') }, 201));
  });

  await page.goto('/?friend=abcd-2345');
  const card = page.locator('[data-friend-invite]');
  await expect(card).toContainText('ABCD-2345');
  // 주소에서 초대 코드를 지운다(새로고침해도 다시 열리지 않게).
  expect(new URL(page.url()).search).toBe('');
  // 팀이 없으면 친선전은 못 하지만 친구 신청은 할 수 있다.
  await expect(page.locator('[data-friends-hint]')).toContainText('이번 시즌 팀을 만들면');
  await card.locator('[data-act="friend-invite-send"]').click();
  await expect(page.locator('#toast')).toContainText('친구 신청을 보냈어요');
  expect(requests).toEqual([{ code: 'ABCD2345' }]);
  await expect(card).toHaveCount(0);
});

test('T-11-113 개막 뒤 프리시즌 팀을 꾸려 친구와 프리시즌 친선전을 하고 창단 멤버가 보인다', async ({
  page,
}) => {
  await stubOwner(page, true);
  const puts: Record<string, unknown>[] = [];
  await page.route(ownerTeamUrl, (route) => {
    const req = route.request();
    if (req.method() === 'PUT') {
      const body = req.postDataJSON() as Parameters<typeof teamFrom>[0];
      puts.push(body as unknown as Record<string, unknown>);
      return route.fulfill(ok({ team: teamFrom(body) }));
    }
    const season = new URL(req.url()).searchParams.get('season') === '0' ? 0 : 1;
    return route.fulfill(ownerTeam({ season, current: 1, seasons: SEASONS, founder: true }));
  });
  await page.route(`${API}/v1/owner-team/opponents`, (route) => route.fulfill(ok({ items: [] })));
  await page.route(`${API}/v1/friends`, (route) =>
    route.fulfill(
      ok(
        friendsBody({
          canPlay: false,
          canPlayPreseason: false,
          friends: [person('FRND2345', '친구 감독', { founder: true, preseasonTeam: FRIEND_TEAM })],
        }),
      ),
    ),
  );

  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await expect(page.locator('[data-owner-founder]')).toHaveText('창단 멤버');
  await page.locator('[data-act="team"]').click();
  await page.locator('[data-team-tab="opponents"]').click();
  await page.locator('[data-match-mode="friends"]').click();
  const row = page.locator('[data-friend="FRND2345"]');
  await expect(row.locator('[data-friend-founder]')).toHaveText('창단 멤버');
  await expect(row.locator('[data-friend-preseason]')).toHaveText('프리시즌 친구 FC · OVR 61');
  // 내 프리시즌 팀이 없으면 프리시즌 친선전은 못 하고, 프리시즌 팀으로 가는 길을 보인다.
  await expect(row.locator('[data-act="friend-play-preseason"]')).toBeDisabled();
  await page.locator('[data-act="friend-preseason-team"]').click();

  await expect(page.locator('[data-team-legacy]')).toContainText('친구와 하는 친선전에만');
  await page.locator('[data-team-name]').fill('레전드 FC');
  await page.locator('[data-team-manager]').fill('홍감독');
  await page.locator('[data-act="team-auto"]').click();
  await page.locator('[data-act="team-save"]').click();
  await expect(page.locator('#toast')).toContainText('팀을 만들었어요');
  expect(puts).toMatchObject([{ season: 0, name: '레전드 FC' }]);
});
