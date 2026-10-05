import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { API, atPreseason, ok } from './helpers.js';

// 시즌 1 개막 뒤에도 프리시즌 기준으로 돈다(시각을 직접 옮기는 테스트는 그 값이 이긴다).
test.beforeEach(({ page }) => atPreseason(page));

async function expectAccessible(page: Page) {
  // Wait for finite entrance transitions; decorative badge loops intentionally keep running.
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
      .every((animation) => animation.playState !== 'running'),
  );
  const result = await new AxeBuilder({ page }).analyze();
  expect(
    result.violations.map((violation) => ({
      id: violation.id,
      nodes: violation.nodes.map((node) => ({
        target: node.target,
        summary: node.failureSummary,
      })),
    })),
  ).toEqual([]);
}

// T-10-005 공개 명예의 전당: 전체 목록(API 스텁) → 다른 유저 선수 상세 → 돌아오기, 내 선수 탭 → 상세.
const ID = '3b1d6c1e-2a4f-4f7e-9a0b-7c8d9e0f1a2b';
/** 목록 요청(`/v1/hof?limit=…&page=…`). 상세(`/v1/hof/:id`)와 구분한다. */
const HOF_LIST = /\/v1\/hof\?/;
const entry = {
  id: ID,
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
};
const snapshot = {
  number: 7,
  pos: 'FW',
  age: 35,
  peak: 91,
  lastClub: '테스트 FC',
  career: [
    {
      year: 2026,
      age: 18,
      club: '테스트 고교',
      league: '고교리그',
      apps: 20,
      goals: 15,
      assists: 4,
      cs: 0,
      rating: 7.4,
      rank: 1,
      ovr: 58,
      honors: ['고교리그 우승'],
    },
    {
      year: 2027,
      age: 19,
      club: '테스트 FC',
      league: 'K리그1',
      apps: 30,
      goals: 12,
      assists: 5,
      cs: 0,
      rating: 7.1,
      rank: 3,
      ovr: 66,
      honors: [],
      ch: ['goals'],
    },
  ],
  trophies: [{ year: 2026, t: '고교리그 우승', club: '테스트 고교' }],
  awards: [{ year: 2027, t: '영플레이어상' }],
  ballon: [],
  nat: { caps: 88, goals: 31, assists: 12 },
  storyLog: [],
  miles: [{ year: 2027, t: '프로 데뷔' }],
};

test('전체 명예의 전당에서 다른 유저의 은퇴 선수 상세를 연다', async ({ page }) => {
  await page.route(HOF_LIST, (r) => r.fulfill(ok({ entries: [entry] })));
  await page.route(`${API}/v1/hof/${ID}`, (r) => r.fulfill(ok({ entry, snapshot })));
  await page.route(`${API}/v1/careers/mine`, (r) => r.fulfill(ok({ linked: true, entries: [] })));

  await page.goto('/');
  const row = page.locator(`[data-hof-id="${ID}"]`);
  await expect(row).toContainText('익명의');
  await row.click();
  await expect(page.locator('.film-open h1')).toContainText('익명의');
  await expect(page.locator('[data-act="share-career"]')).toHaveCount(0); // 남의 선수엔 공유 바가 없다(T-10-069)
  // 다시 볼 때도 스크롤해 내려가야 장면이 올라온다 (T-10-062).
  await expect(page.locator('[data-credit="finale"]')).toBeHidden();
  await page.evaluate(async () => {
    for (let y = 0; y <= document.documentElement.scrollHeight; y += 240) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
  });
  await expect(page.locator('[data-credit="finale"]')).toBeVisible();
  // 우승 연혁이 크레딧처럼 나오고, 점수 구성·시즌별 표는 '자세히 보기'에 접혀 있다 (T-10-062).
  // A매치는 출전 수와 함께 골·도움도 보인다 (T-10-086).
  await expect(page.locator('[data-nat-ga]')).toHaveText('31골 · 12도움');
  await expect(page.locator('[data-credit="honours"]')).toContainText('고교리그 우승');
  await page.locator('[data-credit="career"] summary').click();
  await expect(page.getByRole('heading', { name: '레전드 점수 구성' })).toBeVisible();
  await expect(page.locator('table')).toContainText('K리그1');
  await page.locator('[data-act="hof-back"]').click();
  await expect(page.locator(`[data-hof-id="${ID}"]`)).toBeVisible();
});

test('내 선수 탭: 상세 없는 옛 기록은 요약만 보여 준다', async ({ page }) => {
  await page.route(HOF_LIST, (r) =>
    r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }),
  );
  await page.addInitScript(() => {
    localStorage.setItem(
      'ft_hof',
      JSON.stringify([
        {
          name: '옛선수',
          pos: 'MF',
          number: 8,
          peak: 80,
          age: 34,
          apps: 400,
          goals: 60,
          assists: 90,
          trophies: 3,
          awards: 1,
          caps: 20,
          ballon: 0,
          lastClub: '옛 FC',
          score: 380,
          date: '2026-01-01',
        },
      ]),
    );
  });
  await page.goto('/');
  await expect(page.locator('.card').filter({ hasText: '명예의 전당' })).toContainText(
    '불러오지 못했어요',
  );
  await page.locator('[data-act="owner"]').click();
  await page.locator('[data-my-player="0"]').click();
  await expect(page.locator('.film-open h1')).toHaveText('옛선수');
  await expect(page.getByText('요약만 보여 줘요')).toBeVisible();
});

// T-10-013: 계정에 연결돼 있으면 '내 선수'는 계정 기록이다. 이 기기 기록이 있으면 그 이름을 쓰고,
// 다른 기기에서 은퇴한 선수는 익명 이름으로 보인다. 다른 계정의 이 기기 기록은 빠진다.
test('구단주 내 선수: 계정 기록(서버) + 이 기기 이름 덮어쓰기', async ({ page }) => {
  const OTHER = '7c2e5a10-1b3d-4e5f-8a9b-0c1d2e3f4a5b';
  await page.route(HOF_LIST, (r) => r.fulfill(ok({ entries: [] })));
  await page.route(`${API}/v1/careers/mine`, (r) =>
    r.fulfill(
      ok({
        linked: true,
        entries: [entry, { ...entry, id: OTHER, legendScore: 100, pos: 'GK', number: 1 }],
      }),
    ),
  );
  await page.addInitScript((id) => {
    const base = {
      pos: 'FW',
      number: 7,
      peak: 91,
      age: 35,
      apps: 540,
      goals: 301,
      assists: 120,
      trophies: 9,
      awards: 5,
      caps: 88,
      ballon: 1,
      lastClub: '테스트 FC',
      score: 612,
      date: '2026-09-24',
    };
    localStorage.setItem(
      'ft_hof',
      JSON.stringify([
        { ...base, id, name: '이기기선수', public: false },
        { ...base, id: '9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a', name: '다른계정선수', score: 999 },
      ]),
    );
  }, ID);
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await expect(page.locator('[data-my-source="account"]')).toBeVisible();
  await expect(page.locator('[data-my-player]')).toHaveCount(2);
  await expect(page.locator('[data-my-player="0"]')).toContainText('이기기선수');
  await expect(page.locator('[data-my-player="1"]')).toContainText('익명의 골키퍼');
  await expect(page.locator('[data-my-players]')).not.toContainText('다른계정선수');
  // 상세에서 돌아오면 구단주 화면이다. 내 선수 상세엔 '이전으로' 버튼이 없고 뒤로 가기로 돌아간다(T-10-126).
  await page.locator('[data-my-player="0"]').click();
  await expect(page.locator('.film-open h1')).toBeVisible();
  await expect(page.locator('[data-act="hof-back"]')).toHaveCount(0);
  await page.goBack();
  await expect(page.locator('h1')).toHaveText('구단주');
});

// T-10-069: 다른 기기에서 은퇴한(이 기기 ft_hof에 없는) 계정의 내 선수도, 어디서 열든 상세 아래에 공유 버튼이 뜬다.
test('이 기기에 없는 계정의 내 선수도 공유 버튼이 뜬다', async ({ page }) => {
  await page.route(HOF_LIST, (r) => r.fulfill(ok({ entries: [entry] })));
  await page.route(`${API}/v1/hof/${ID}`, (r) => r.fulfill(ok({ entry, snapshot })));
  await page.route(`${API}/v1/careers/mine`, (r) =>
    r.fulfill(ok({ linked: true, entries: [entry] })),
  );
  await page.goto('/');
  // 전체 명예의 전당에서 열어도 내 계정 선수면 뜬다.
  await page.locator(`[data-hof-id="${ID}"]`).click();
  await expect(page.locator('[data-act="share-career"]')).toBeInViewport();

  // 공유할 수 있는 선수는 아래 바가 홈으로 · 공유하기(T-10-128) — 뒤로 가기로 돌아간다.
  await page.goBack();
  await page.locator('[data-act="owner"]').click();
  await page.locator('[data-my-player="0"]').click();
  await expect(page.locator('[data-act="share-career"]')).toBeInViewport();
});

test('구단주 내 선수: 계정에 연결되지 않았으면 이 기기 기록', async ({ page }) => {
  await page.route(HOF_LIST, (r) => r.fulfill(ok({ entries: [] })));
  await page.route(`${API}/v1/careers/mine`, (r) => r.fulfill(ok({ linked: false, entries: [] })));
  await page.addInitScript(() => {
    localStorage.setItem(
      'ft_hof',
      JSON.stringify([
        {
          id: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
          name: '기기선수',
          pos: 'DF',
          number: 4,
          peak: 78,
          age: 33,
          apps: 300,
          goals: 10,
          assists: 5,
          trophies: 1,
          awards: 0,
          caps: 3,
          ballon: 0,
          lastClub: 'FC',
          score: 250,
          date: '2026-09-24',
        },
      ]),
    );
  });
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await expect(page.locator('[data-my-source="device"]')).toContainText('구글 계정을 연결하면');
  await expect(page.locator('[data-my-player="0"]')).toContainText('기기선수');
  // 기록실에는 전체/내 선수 전환이 없다(탭은 명예의 전당·영구결번·팀 랭킹).
  await page.locator('[data-act="hof"]').click();
  await expect(page.locator('[data-hof-tab]')).toHaveText([
    '명예의 전당',
    '영구결번',
    '팀 랭킹',
    '구단주 랭킹',
  ]);
});

// 홈은 TOP 3만, '전체 보기'는 10명씩 페이지(T-10-101). 상세에서 돌아오면 보던 페이지로 돌아온다.
test('명예의 전당: 홈 TOP 3 → 전체 보기 10명씩 페이지', async ({ page }) => {
  const TOTAL = 15;
  const nth = (k: number) => ({
    ...entry,
    id: `00000000-0000-4000-8000-${String(k).padStart(12, '0')}`,
    number: k % 100,
    legendScore: 1000 - k,
    hasDetail: false,
  });
  const asked: string[] = [];
  await page.route(HOF_LIST, (r) => {
    const u = new URL(r.request().url());
    asked.push(u.search);
    const limit = Number(u.searchParams.get('limit'));
    const p = Number(u.searchParams.get('page') ?? 1);
    const entries = Array.from(
      { length: Math.max(0, Math.min(limit, TOTAL - (p - 1) * limit)) },
      (_, i) => nth((p - 1) * limit + i),
    );
    return r.fulfill(ok({ entries, total: TOTAL }));
  });
  await page.goto('/');
  const home = page.locator('[data-hof="home"]');
  await expect(home.locator('.hof-row')).toHaveCount(3);
  expect(asked).toEqual(['?limit=3']);

  await home.locator('[data-act="hof-all"]').click();
  const full = page.locator('[data-hof="full"]');
  await expect(full.locator('h1')).toHaveCount(0);
  await expect(page.getByRole('tab', { name: '명예의 전당' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(full.locator('[data-hof-podium-rank]')).toHaveCount(3);
  await expect(full.locator('.hof-row')).toHaveCount(7);
  await expect(full.locator('[data-hof-id]')).toHaveCount(10);
  await expect(full.locator('[data-hof-nation]')).toHaveCount(10);
  await expect(full.locator('.hof-pager')).toContainText('1 / 2');
  await expect(full.locator('[data-hof-page="prev"]')).toBeDisabled();
  await expectAccessible(page);

  await full.locator('[data-hof-page="next"]').click();
  await expect(full.locator('.hof-row')).toHaveCount(5);
  await expect(full.locator('.hof-row').first().locator('.hof-rank')).toHaveText('11');
  expect(asked.at(-1)).toBe('?limit=10&page=2');

  await full.locator('.hof-row').first().click();
  await page.locator('[data-act="hof-back"]').click();
  await expect(full.locator('.hof-pager')).toContainText('2 / 2');
  await expect(full.locator('.hof-row').first().locator('.hof-rank')).toHaveText('11');

  await page.locator('[data-act="home"]').click();
  await expect(page.locator('[data-hof="home"] .hof-row')).toHaveCount(3);
});

test('구단주 내 선수: 3명까지 보이고 모두 보기로 펼친다', async ({ page }) => {
  await page.route(HOF_LIST, (r) => r.fulfill(ok({ entries: [], total: 0 })));
  await page.route(`${API}/v1/careers/mine`, (r) => r.fulfill(ok({ linked: false, entries: [] })));
  await page.addInitScript(() => {
    const base = {
      pos: 'DF',
      number: 4,
      peak: 78,
      age: 33,
      apps: 300,
      goals: 10,
      assists: 5,
      trophies: 1,
      awards: 0,
      caps: 3,
      ballon: 0,
      lastClub: 'FC',
      date: '2026-09-24',
    };
    localStorage.setItem(
      'ft_hof',
      JSON.stringify(
        Array.from({ length: 12 }, (_, i) => ({
          ...base,
          name: `기기선수${i + 1}`,
          score: 500 - i,
        })),
      ),
    );
  });
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await expect(page.locator('[data-my-player]')).toHaveCount(3);
  await expect(page.locator('[data-my-player="0"]')).toContainText('기기선수1');
  await page.locator('[data-act="my-players-all"]').click();
  await expect(page.locator('[data-my-player]')).toHaveCount(12);
  await expect(page.locator('[data-act="my-players-all"]')).toHaveCount(0);
});

// 전체 보기에서 순위 유형을 바꾸면 서버에 sort로 묻고 그 기록을 오른쪽에 보여 준다.
test('명예의 전당: 전체 보기에서 순위 유형(득점·발롱도르)을 바꾼다', async ({ page }) => {
  const asked: string[] = [];
  await page.route(HOF_LIST, (r) => {
    const u = new URL(r.request().url());
    asked.push(u.search);
    const sort = u.searchParams.get('sort');
    const entries =
      sort === 'goals'
        ? [
            { ...entry, goals: 401 },
            { ...entry, id: '00000000-0000-4000-8000-000000000002', goals: 99 },
          ]
        : sort === 'value'
          ? [{ ...entry, value: 11_153_000 }]
          : [entry];
    return r.fulfill(ok({ entries, total: entries.length }));
  });
  await page.goto('/');
  await expect(page.locator('[data-hof="home"] [data-hof-sort]')).toHaveCount(0);
  await page.locator('[data-act="hof-all"]').click();
  const full = page.locator('[data-hof="full"]');
  await full.locator('[data-hof-filters]').click();
  await expect(full.locator('[data-hof-sort="score"]')).toHaveAttribute('aria-pressed', 'true');

  if ((await full.locator('[data-hof-filters]').getAttribute('aria-expanded')) === 'false')
    await full.locator('[data-hof-filters]').click();
  await full.locator('[data-hof-sort="goals"]').click();
  await expect(full.locator('.hof-source')).toContainText('득점 기록이 있는 선수 2명 · 득점 순');
  await expect(
    full
      .locator('[data-hof-podium-rank="1"] .hof-podium-value, .hof-ranking-list .hof-value')
      .first(),
  ).toHaveText('401골');
  expect(asked.at(-1)).toBe('?limit=10&sort=goals');
  await expectAccessible(page);

  if ((await full.locator('[data-hof-filters]').getAttribute('aria-expanded')) === 'false')
    await full.locator('[data-hof-filters]').click();
  await full.locator('[data-hof-sort="ballon"]').click();
  await expect(full.locator('[data-hof-sort="ballon"]')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => asked.at(-1)).toBe('?limit=10&sort=ballon');

  // T-10-100 은퇴 가치 순: 오른쪽에 큰 두 단위(억·천만)로 적는다.
  if ((await full.locator('[data-hof-filters]').getAttribute('aria-expanded')) === 'false')
    await full.locator('[data-hof-filters]').click();
  await full.locator('[data-hof-sort="value"]').click();
  await expect.poll(() => asked.at(-1)).toBe('?limit=10&sort=value');
  await expect(
    full
      .locator('[data-hof-podium-rank="1"] .hof-podium-value, .hof-ranking-list .hof-value')
      .first(),
  ).toHaveText('1,115억 3천만');
  await expect(full.locator('.hof-source')).toContainText('은퇴 가치 순');
});

// T-10-101 이름 검색: 타자를 멈추면 서버에 q로 묻고, 찾은 선수는 검색 전 순위(rank)로 보여 준다.
test('명예의 전당 이름 검색', async ({ page }) => {
  const asked: string[] = [];
  await page.route(HOF_LIST, (r) => {
    const u = new URL(r.request().url());
    asked.push(u.search);
    const q = u.searchParams.get('q');
    const entries =
      q === '오프'
        ? [
            { ...entry, name: '김오프', rank: 7 },
            { ...entry, id: '00000000-0000-4000-8000-000000000002', name: '오프사이드', rank: 42 },
          ]
        : q
          ? []
          : [entry];
    return r.fulfill(ok({ entries, total: entries.length }));
  });
  await page.goto('/');
  await page.locator('[data-act="hof-all"]').click();
  const full = page.locator('[data-hof="full"]');
  // T-10-105 검색 칸은 돋보기를 눌러야 열린다(열리면 바로 입력).
  const search = full.locator('[data-hof-search]');
  await expect(search).toHaveCount(0);
  await full.locator('[data-act="hof-search"]').click();
  await expect(search).toBeFocused();
  await search.pressSequentially('오프');
  await expect.poll(() => asked.at(-1)).toBe(`?limit=10&q=${encodeURIComponent('오프')}`);
  expect(asked.filter((a) => a.includes('q='))).toHaveLength(1); // 글자마다 묻지 않는다.
  await expect(full.locator('.hof-row .hof-rank')).toHaveText(['7', '42']);
  await expect(full.locator('.hof-source')).toContainText("'오프' 검색 은퇴 선수 2명");
  await expectAccessible(page);

  // 유형을 바꿔도 검색어는 그대로, 없는 이름은 안내.
  if ((await full.locator('[data-hof-filters]').getAttribute('aria-expanded')) === 'false')
    await full.locator('[data-hof-filters]').click();
  await full.locator('[data-hof-sort="goals"]').click();
  await expect
    .poll(() => asked.at(-1))
    .toBe(`?limit=10&sort=goals&q=${encodeURIComponent('오프')}`);
  await search.fill('없는사람');
  await expect(full.locator('.empty')).toHaveText("'없는사람'이 들어간 이름의 선수가 없어요.");
  await search.fill('');
  await expect.poll(() => asked.at(-1)).toBe('?limit=10&sort=goals');
  // 검색어를 둔 채 닫으면 검색도 풀린다.
  await search.fill('오프사');
  await expect(full.locator('.empty')).toContainText("'오프사'");
  await full.locator('[data-act="hof-search"]').click();
  await expect(search).toHaveCount(0);
  await expect(full.locator('.hof-source')).not.toContainText('검색');
});

// T-10-101 새로 생긴 순위 유형(은퇴 가치)에 NEW — 정해 둔 날까지만.
test('명예의 전당: 은퇴 가치 칩에 NEW 표시(기한까지만)', async ({ page }) => {
  await page.route(HOF_LIST, (r) => r.fulfill(ok({ entries: [entry], total: 1 })));
  await page.clock.setFixedTime(new Date('2026-10-01T00:00:00+09:00'));
  await page.goto('/');
  await page.locator('[data-act="hof-all"]').click();
  await page.locator('[data-hof-filters]').click();
  const chip = page.locator('[data-hof="full"] [data-hof-sort="value"]');
  await expect(chip.locator('.hof-new')).toHaveText('NEW');
  await expect(page.locator('[data-hof="full"] .hof-new')).toHaveCount(1);

  await page.clock.setFixedTime(new Date('2026-10-14T00:00:00+09:00'));
  await page.reload();
  await page.locator('[data-act="hof-all"]').click();
  await page.locator('[data-hof-filters]').click();
  await expect(chip).toBeVisible();
  await expect(chip.locator('.hof-new')).toHaveCount(0);
});

// T-10-103 개막 전 시즌 버튼엔 'Coming soon' — 개막하면 사라진다. 눌러 보면 개막 안내.
test('명예의 전당: 컴팩트 시즌 선택에서 개막 예정 시즌을 안내한다', async ({ page }) => {
  await page.route(HOF_LIST, (r) => r.fulfill(ok({ entries: [entry], total: 1 })));
  await page.clock.setFixedTime(new Date('2026-10-01T00:00:00+09:00'));
  await page.goto('/');
  await page.locator('[data-act="hof-all"]').click();
  const full = page.locator('[data-hof="full"]');
  const season = full.locator('[data-hof-season-select]');
  await expect(season.locator('option[value="1"]')).toContainText('개막 예정');
  expect((await season.boundingBox())!.height).toBeLessThanOrEqual(40);
  await season.selectOption('1');
  await expect(full.locator('[data-hof-upcoming]')).toContainText('시즌 1은');
  await expectAccessible(page);

  await page.clock.setFixedTime(new Date('2026-10-06T00:00:00+09:00'));
  await page.reload();
  await page.locator('[data-act="hof-all"]').click();
  await expect(season.locator('option[value="1"]')).not.toContainText('개막 예정');
});

// T-10-015: 화면을 오가도 같은 공개 조회는 다시 보내지 않는다(메모 60초).
test('홈 ↔ 전체 보기 ↔ 상세를 오가도 같은 목록을 다시 요청하지 않는다', async ({ page }) => {
  const asked: string[] = [];
  page.on('request', (req) => {
    const u = new URL(req.url());
    if (u.origin === API) asked.push(u.pathname + u.search);
  });
  await page.route(HOF_LIST, (r) => r.fulfill(ok({ entries: [entry], total: 1 })));
  await page.route(`${API}/v1/hof/${ID}`, (r) => r.fulfill(ok({ entry, snapshot })));
  await page.route(`${API}/v1/boards/**`, (r) => r.fulfill(ok({ posts: [], hasMore: false })));
  await page.goto('/');
  await expect(page.locator('[data-hof="home"] .hof-row')).toHaveCount(1);
  for (let i = 0; i < 2; i++) {
    await page.locator('[data-act="hof-all"]').click();
    await page.locator(`[data-hof="full"] [data-hof-id="${ID}"]`).click();
    await page.locator('[data-act="hof-back"]').click();
    await page.locator('[data-act="home"]').click();
    await expect(page.locator('[data-hof="home"] .hof-row')).toHaveCount(1);
  }
  const count = (p: string) => asked.filter((a) => a === p).length;
  expect(count('/v1/hof?limit=3')).toBe(1);
  expect(count('/v1/hof?limit=10')).toBe(1);
  expect(count(`/v1/hof/${ID}`)).toBe(1);
  expect(count('/v1/boards/notice/posts')).toBe(1);
  expect(count('/v1/boards/release/posts')).toBe(1);
});

test('내 선수 국적: 계정 응답으로 옛 로컬 기록을 보완하고 다른 기기 국적·한국·미기록을 구분한다', async ({
  page,
}) => {
  const ids = [
    ID,
    '00000000-0000-4000-8000-000000000021',
    '00000000-0000-4000-8000-000000000022',
    '00000000-0000-4000-8000-000000000023',
  ];
  await page.setViewportSize({ width: 375, height: 812 });
  await page.route(HOF_LIST, (r) => r.fulfill(ok({ entries: [] })));
  await page.route(`${API}/v1/careers/mine`, (r) =>
    r.fulfill(
      ok({
        linked: true,
        entries: ids.map((id, i) => ({
          ...entry,
          id,
          name: ['브라질', '잉글랜드', '한국', '옛 기록'][i],
          nation: ['BR', 'GB-ENG', 'KR', null][i],
          legendScore: 400 - i,
        })),
      }),
    ),
  );
  await page.addInitScript(
    (id) =>
      localStorage.setItem(
        'ft_hof',
        JSON.stringify([
          {
            id,
            name: '로컬 브라질',
            pos: 'FW',
            number: 7,
            age: 35,
            peak: 91,
            score: 400,
            apps: 540,
            goals: 301,
            assists: 120,
            trophies: 9,
            awards: 5,
            caps: 88,
            ballon: 1,
            lastClub: '테스트 FC',
            date: '2026-09-24',
          },
        ]),
      ),
    ID,
  );
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await page.locator('[data-act="my-players-all"]').click();
  const rows = page.locator('[data-my-player]');
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(0)).toContainText('로컬 브라질');
  for (const [i, nation] of ['BR', 'GB-ENG', 'KR'].entries()) {
    await expect(rows.nth(i).locator('[data-hof-nation]')).toHaveAttribute(
      'data-hof-nation',
      nation,
    );
  }
  await expect(rows.nth(3).locator('[data-hof-nation]')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('이 기기 내 선수: 새 로컬 국적을 전달하고 국적 없는 옛 저장은 국기 없이 계속 연다', async ({
  page,
}) => {
  await page.route(HOF_LIST, (r) => r.fulfill(ok({ entries: [] })));
  await page.route(`${API}/v1/careers/mine`, (r) => r.fulfill(ok({ linked: false, entries: [] })));
  await page.addInitScript(() => {
    const base = {
      pos: 'FW',
      number: 7,
      age: 35,
      peak: 80,
      apps: 540,
      goals: 301,
      assists: 120,
      trophies: 9,
      awards: 5,
      caps: 88,
      ballon: 1,
      lastClub: '테스트 FC',
      date: '2026-09-24',
    };
    localStorage.setItem(
      'ft_hof',
      JSON.stringify([
        { ...base, name: '새 브라질', nation: 'BR', score: 500 },
        { ...base, name: '옛 기록', score: 300 },
      ]),
    );
  });
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await expect(page.locator('[data-my-player="0"] [data-hof-nation]')).toHaveAttribute(
    'data-hof-nation',
    'BR',
  );
  await expect(page.locator('[data-my-player="1"] [data-hof-nation]')).toHaveCount(0);
  await page.locator('[data-my-player="1"]').click();
  await expect(page.locator('.film-open h1')).toHaveText('옛 기록');
  await expect(page.getByText('요약만 보여 줘요')).toBeVisible();
});
