import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { API, fail, ok } from './helpers.js';

// T-11-618 남의 구단주 프로필에서 그 구단주의 명예관을 읽기 전용으로 연다(명패 · 트로피장 두 칸).
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

async function expectNoA11yViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map((v) => `${v.id} (${v.impact})`)).toEqual([]);
}

const TEAM = 'tem_visit';
const owner = {
  nickname: '시험구단주',
  avatarId: null,
  title: 'owner-star-cradle',
  tier: null,
  team: {
    id: TEAM,
    name: '시험FC',
    manager: '시험감독',
    logo: null,
    season: 1,
    seasonName: '시즌 1',
  },
  cupHonors: [],
  leagueHonors: [{ season: 2, tier: 4, league: 3, teamName: '방문FC', owner: '구단주' }],
  seasons: [],
  stats: { retiredNumbers: 0, retired: 97, bestTeamRank: 31 },
};
const hall = {
  honors: [
    {
      season: 1,
      kind: 'achievements',
      band: 100,
      rank: 100,
      value: null,
      grantedAt: '2026-10-30T22:35:36.039Z',
    },
  ],
  titles: ['owner-developer', 'owner-star-cradle'],
};

async function openProfile(
  page: Page,
  mine = false,
  hallBody: unknown = ok(hall),
  ownerBody: unknown = owner,
) {
  const paths: string[] = [];
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route(`${API}/v1/chat/ticket*`, (route) =>
    route.fulfill(
      ok({
        ticket: null,
        reason: 'login',
        author: 'me',
        nickname: null,
        admin: false,
        mutedUntil: null,
        blocked: [],
        reported: [],
      }),
    ),
  );
  await page.routeWebSocket(`${API.replace('http', 'ws')}/v1/chat/ws*`, (ws) => {
    ws.send(
      JSON.stringify({
        t: 'hello',
        online: 2,
        write: false,
        messages: [
          {
            id: 'm1',
            at: 100,
            author: 'other',
            nickname: '시험구단주',
            body: '안녕',
            admin: false,
          },
        ],
      }),
    );
  });
  await page.route(`${API}/v1/chat/messages/m1/owner*`, (route) =>
    route.fulfill(ok({ teamId: TEAM })),
  );
  await page.route(`${API}/v1/owners/by-team/${TEAM}`, (route) => {
    paths.push(new URL(route.request().url()).pathname);
    return route.fulfill(ok({ owner: ownerBody, mine }));
  });
  await page.route(`${API}/v1/owners/by-team/${TEAM}/hall`, (route) => {
    paths.push(new URL(route.request().url()).pathname);
    return route.fulfill(hallBody as Parameters<typeof route.fulfill>[0]);
  });
  await page.goto('/');
  await page.locator('[data-act="chat"]').click();
  await page.locator('[data-act="chat-who"]').tap();
  await page.locator('[data-act="chat-profile"]').tap();
  await expect(page.locator('[data-owner-profile]')).toBeVisible();
  return paths;
}

test('받은 칭호와 기록 배지를 읽기 전용으로 보고, 뒤로 가면 프로필이다', async ({ page }) => {
  const paths = await openProfile(page);
  const hallPath = `/v1/owners/by-team/${TEAM}/hall`;
  expect(paths).not.toContain(hallPath); // 버튼을 누르기 전에는 부르지 않는다
  await page.locator('[data-act="owner-hall-visit"]').tap();

  const titles = page.locator('[data-owner-hall-visit]');
  await expect(titles.locator('[data-visit-title]')).toHaveCount(2);
  await expect(titles.locator('[data-visit-title="owner-star-cradle"]')).toContainText('사용 중');
  // 고르기 · 시즌 라커는 없다.
  await expect(page.locator('[data-title-pick]')).toHaveCount(0);
  await expect(page.locator('[data-room-zone="0"]')).toHaveCount(0);
  await expectNoA11yViolations(page);

  await page.locator('[data-room-zone="2"]').tap();
  await expect(page.locator('[data-trophy-gallery]')).toContainText('업적 랭킹');
  // T-11-640 리그 우승 트로피.
  await expect(page.locator('[data-league-honor="2-4-3"]')).toContainText('페가수스 리그 우승');
  await expect(page.locator('[data-league-trophy="4-3"]')).toBeVisible();
  await expect(page.locator('[data-trophy-gallery]')).toContainText('100위로 마감');

  await page.locator('[data-act="owner-hall-visit-back"]').tap();
  await expect(page.locator('[data-owner-profile]')).toBeVisible();

  // 다시 열어도 메모에서 읽는다.
  await page.locator('[data-act="owner-hall-visit"]').tap();
  await expect(page.locator('[data-owner-hall-visit]')).toBeVisible();
  expect(paths.filter((p) => p === hallPath)).toHaveLength(1);
});

test('받은 게 없으면 빈 안내', async ({ page }) => {
  await openProfile(page, false, ok({ honors: [], titles: [] }), { ...owner, leagueHonors: [] });
  await page.locator('[data-act="owner-hall-visit"]').tap();
  await expect(page.locator('[data-owner-hall-visit]')).toContainText('아직 받은 칭호가 없어요.');
  await page.locator('[data-room-zone="2"]').tap();
  await expect(page.locator('[data-trophy-gallery]')).toContainText('아직 전시한 기록이 없어요.');
});

test('불러오지 못하면 오류를 보여 준다', async ({ page }) => {
  await openProfile(page, false, fail(503, 'UNAVAILABLE', 'unavailable'));
  await page.locator('[data-act="owner-hall-visit"]').tap();
  await expect(page.getByText('명예관을 불러오지 못했어요.').first()).toBeVisible();
});

test('내 프로필에는 칭호 고르기만 있다', async ({ page }) => {
  await openProfile(page, true);
  await expect(page.locator('[data-act="owner-hall"]')).toBeVisible();
  await expect(page.locator('[data-act="owner-hall-visit"]')).toHaveCount(0);
});
