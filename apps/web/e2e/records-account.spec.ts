import { test, expect, type Page } from '@playwright/test';
import { API, fail, ok, startCareer, usePreseason } from './helpers.js';

// T-11-441 기록실 · 설정 · 계정 안내 다듬기(UX 점검 중간 지적 D2 · D3 · D4 · D5 · D7).
usePreseason();

const PROFILE_URL = `${API}/v1/profile`;
const member = {
  id: 'u1',
  linked: { google: true, apple: false, toss: false },
  googleEmailMasked: 'te***@gmail.com',
  recoveryCodeIssuedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};
const SEASONS = [{ id: 0, name: '프리시즌' }];
const teamId = (n: number) => `tem_00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const teamRow = (rank: number) => ({
  rank,
  teamId: teamId(rank),
  name: `팀 ${rank}`,
  manager: `감독 ${rank}`,
  formation: '4-3-3',
  ovr: 90 - rank,
  rating: 1200 - rank,
  record: { w: 1, d: 0, l: 0 },
  likes: 0,
  value: 1000,
  createdAt: '2026-09-29T00:00:00.000Z',
  recentForm: [],
});

async function openOwner(page: Page) {
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
}

test('D2 계정 삭제는 확인 시트를 거치고, 실패하면 실패를, 성공하면 삭제를 알린다', async ({
  page,
}) => {
  let deleted = false;
  await page.route(PROFILE_URL, (route) =>
    route.fulfill(ok(deleted ? { ...member, linked: { google: false } } : member)),
  );
  let calls = 0;
  let failNext = true;
  await page.route(`${API}/v1/profile/delete`, (route) => {
    calls++;
    if (failNext) return route.fulfill(fail(500, 'INTERNAL', 'boom'));
    const body = route.request().postDataJSON() as { confirmToken?: string } | null;
    if (!body?.confirmToken)
      return route.fulfill(ok({ confirmToken: 'tok', expiresAt: '2026-10-01T04:00:00.000Z' }));
    deleted = true;
    return route.fulfill({ status: 204 });
  });

  await openOwner(page);
  const account = page.locator('#account-slot');
  await account.locator('[data-act="delete-account"]').click();
  await expect(page.locator('#sheet')).toContainText('되돌릴 수 없어요');
  await page.locator('#sheet [data-sheet="1"]').click();
  expect(calls).toBe(0);

  await account.locator('[data-act="delete-account"]').click();
  await page.locator('#sheet [data-sheet="0"]').click();
  await expect(page.locator('#toast')).toContainText('계정을 삭제하지 못했어요');
  await expect(account).toContainText('te***@gmail.com');
  await expect(account).not.toContainText('연결할 수 없어요');

  failNext = false;
  await account.locator('[data-act="delete-account"]').click();
  await page.locator('#sheet [data-sheet="0"]').click();
  await expect(page.locator('#toast')).toContainText('계정을 삭제했어요');
  await expect(account).toContainText('로그인하지 않았어요');
});

test('D3 설정의 계정 · 닉네임은 내 구단 화면의 계정 카드로 간다', async ({ page }) => {
  await page.route(PROFILE_URL, (route) => route.fulfill(ok(member)));
  await page.goto('/');
  await page.locator('[data-act="settings"]').click();
  await page.locator('[data-act="account"]').click();
  await expect(page.locator('#account-slot')).toBeInViewport();
  await expect(page.locator('#account-slot')).toContainText('te***@gmail.com');
});

test('D4 팀 랭킹의 내 순위로는 내 팀이 있는 페이지로 가서 그 줄을 강조하고, 가치순에는 없다', async ({
  page,
}) => {
  await page.route(PROFILE_URL, (route) => route.fulfill(ok(member)));
  const asked: string[] = [];
  await page.route(`${API}/v1/teams?*`, (route) => {
    const sp = new URL(route.request().url()).searchParams;
    asked.push(sp.toString());
    const me = sp.get('me') === '1';
    const page = me ? 2 : Number(sp.get('page') ?? 1);
    const items = Array.from({ length: 20 }, (_, i) => teamRow((page - 1) * 20 + i + 1));
    return route.fulfill(
      ok({
        season: 0,
        seasons: SEASONS,
        sort: sp.get('sort') ?? 'rating',
        page,
        total: 45,
        items,
        ...(me ? { me: { teamId: teamId(27), rank: 27 } } : {}),
      }),
    );
  });
  await page.goto('/');
  await page.locator('[data-act="hof"]').click();
  await page.locator('[data-hof-tab="teams"]').click();
  const list = page.locator('[data-team-ranking]');
  await expect(list.locator('[data-rank-team]')).toHaveCount(20);
  await list.locator('[data-act="my-rank"]').click();
  const mine = list.locator('li.mine');
  await expect(mine).toHaveCount(1);
  await expect(mine).toContainText('팀 27');
  await expect(mine).toHaveAttribute('aria-current', 'true');
  await expect(list.locator('.hof-pager')).toContainText('2 / 3');
  // 내 순위 응답이 곧 2페이지다 — 같은 페이지를 다시 받지 않는다.
  expect(asked.filter((q) => q.includes('page=2'))).toHaveLength(0);
  expect(asked.filter((q) => q.includes('me=1'))).toHaveLength(1);

  await list.locator('[data-rank-sort="value"]').click();
  await expect(list.locator('[data-act="my-rank"]')).toHaveCount(0);
});

test('D4 업적 랭킹에 내 기록이 없으면 내 순위로가 그 이유를 알린다', async ({ page }) => {
  await page.route(PROFILE_URL, (route) => route.fulfill(ok(member)));
  await page.route(`${API}/v1/achievements/ranking**`, (route) => {
    const me = new URL(route.request().url()).searchParams.get('me') === '1';
    return route.fulfill(
      ok({
        season: 0,
        seasons: SEASONS,
        page: 1,
        total: 1,
        items: [{ rank: 1, nickname: '하람아빠', team: null, score: 120, done: 4, players: 3 }],
        ...(me ? { me: null } : {}),
      }),
    );
  });
  await page.goto('/');
  await page.locator('[data-act="hof"]').click();
  await page.locator('[data-hof-tab="ach"]').click();
  const board = page.locator('[data-ach-ranking]');
  await expect(board.locator('[data-ach-rank="1"]')).toContainText('하람아빠');
  await board.locator('[data-act="my-rank"]').click();
  await expect(page.locator('#toast')).toContainText('이 시즌 업적 랭킹에 내 기록이 없어요');
  await expect(board.locator('li.mine')).toHaveCount(0);
});

test('D5 명예의 전당 순위 기준 아래에 뜻이 바로 보이지 않는 기준만 한 줄 설명한다', async ({
  page,
}) => {
  await page.route(/\/v1\/hof\?/, (route) =>
    route.fulfill(
      ok({
        entries: [
          {
            id: '3b1d6c1e-2a4f-4f7e-9a0b-7c8d9e0f1a2b',
            name: null,
            pos: 'FW',
            number: 7,
            retireAge: 35,
            peak: 91,
            legendScore: 612,
            apps: 540,
            goals: 301,
            assists: 120,
            trophies: 9,
            awards: 5,
            caps: 88,
            ballon: 1,
            lastClub: '테스트 FC',
            retiredAt: '2026-09-24T00:00:00.000Z',
            hasDetail: true,
          },
        ],
        total: 1,
      }),
    ),
  );
  await page.goto('/');
  await page.locator('[data-act="hof-all"]').click();
  const full = page.locator('[data-hof="full"]');
  await expect(full.locator('[data-hof-basis]')).toContainText('레전드 점수는');
  await full.locator('[data-hof-filters]').click();
  await full.locator('[data-hof-sort="goals"]').click();
  await expect(full.locator('.hof-source')).toContainText('득점 순');
  await expect(full.locator('[data-hof-basis]')).toHaveCount(0);
  if ((await full.locator('[data-hof-filters]').getAttribute('aria-expanded')) === 'false')
    await full.locator('[data-hof-filters]').click();
  await full.locator('[data-hof-sort="ga"]').click();
  await expect(full.locator('[data-hof-basis]')).toContainText(
    '공격포인트(P)는 골과 도움을 더한 수예요',
  );
});

test('D7 은퇴한 커리어 위로 백업을 불러올 때도 묻고, 커리어가 없으면 내보낼 수 없는 이유를 보인다', async ({
  page,
}) => {
  await startCareer(page);
  // 은퇴한 커리어로 바꿔 둔다.
  await page.evaluate(() => {
    const g = JSON.parse(localStorage.getItem('ft_save')!);
    localStorage.setItem('ft_save', JSON.stringify({ ...g, retired: true }));
  });
  await page.goto('/');
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async (t: string) => ((window as unknown as { __code: string }).__code = t),
      },
      configurable: true,
    });
  });
  await page.locator('[data-act="settings"]').click();
  await page.locator('[data-act="backup-copy"]').click();
  const backup = await page.evaluate(() => (window as unknown as { __code: string }).__code);
  expect(backup.length).toBeGreaterThan(100);
  await page.locator('#backup-paste').fill(backup);
  await page.locator('[data-act="backup-import"]').click();
  await expect(page.locator('#sheet')).toContainText('은퇴한');
  await expect(page.locator('#sheet')).toContainText('명예의 전당 기록은 그대로 남아요');
  await page.locator('#sheet [data-sheet="1"]').click();
  await expect(page.locator('#toast')).not.toContainText('백업을 불러왔어요');

  // T-11-473 첫 커리어 안내는 끝난 채로 둔다(다른 기기를 흉내 낼 뿐이다).
  await page.evaluate(
    () => (localStorage.clear(), localStorage.setItem('ft_tutorial', '{"i":-1}')),
  );
  await page.goto('/');
  await page.locator('[data-act="settings"]').click();
  await expect(page.locator('[data-backup="none"]')).toContainText('내보낼 백업이 없어요');
});
