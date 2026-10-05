import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { API, ok, openMarket, startCareer, PRESEASON } from './helpers.js';

// 프리시즌 기록으로 꾸민 화면이라 시계를 시즌 1 개막 전으로 고정한다(테스트가 직접 시각을 정하면 그쪽이 이긴다).
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(PRESEASON);
});

// T-10-076 영구결번: 은퇴 업로드 응답의 심사 결과로 은퇴 화면에 결번 세리머니를 띄운다. 판정 기준(점수·시즌 수)은
// 서버만 알고 화면에 내보내지 않는다.
const SLOT = { clubId: 'pl-0', club: '맨체스터 스카이블루', number: 10 };

async function stubRetirement(page: Page, results: unknown[]) {
  const bodies: Record<string, unknown>[] = [];
  await page.route(`${API}/v1/profile`, (r) =>
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
  await page.route(/\/v1\/careers\/[^/]+\/seasons\/\d+$/, (r) => r.fulfill(ok({})));
  await page.route(/\/v1\/careers\/([^/]+)\/retirement$/, (r) => {
    bodies.push(r.request().postDataJSON() as Record<string, unknown>);
    const retiredNumber = results[Math.min(bodies.length, results.length) - 1];
    return r.fulfill(ok({ careerId: 'x', status: 'retired', retiredNumber }));
  });
  return bodies;
}

/** 스카이블루에서 8시즌을 뛴 34세로 만들어 은퇴한다. */
async function retireLegend(page: Page) {
  await openMarket(page, 34);
  await page.evaluate((slot) => {
    const g = JSON.parse(localStorage.getItem('ft_save')!);
    g.career = Array.from({ length: 8 }, (_, i) => ({
      year: g.year - 8 + i,
      age: 26 + i,
      club: slot.club,
      clubId: slot.clubId,
      league: '프리미어리그',
      apps: 38,
      goals: 30,
      assists: 10,
      cs: 0,
      rating: 7.9,
      rank: 1,
      ovr: 88,
      pro: true,
      honors: ['프리미어리그 우승', 'UEFA 챔피언스리그 우승', '발롱도르'],
    }));
    localStorage.setItem('ft_save', JSON.stringify(g));
  }, SLOT);
  await page.reload();
  await page.locator('[data-act="continue"]').click();
  const sheet = page.locator('#sheet');
  await sheet.getByRole('button', { name: '은퇴하기' }).click();
  await sheet.getByRole('button', { name: '은퇴한다' }).click();
  await expect(page.locator('[data-credit="player"]')).toBeVisible();
}

test('결번을 받으면 심사 카드와 유니폼 세리머니가 나온다', async ({ page }) => {
  await stubRetirement(page, [{ kind: 'granted', ...SLOT, seq: 3 }]);
  await retireLegend(page);
  const rn = page.locator('[data-legend-rn="granted"]');
  await rn.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await expect(page.locator('[data-rn-judge]')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('827');
  await expect(rn).toContainText('10번은 이제,');
  await expect(rn).toContainText('맨체스터 스카이블루 영구결번 · 서버 3번째 결번');
  await expect(page.locator('[data-legend-rn-pill]')).toContainText('영결 10');
  await rn.screenshot({ path: test.info().outputPath('retired-number.png') });

  const axe = await new AxeBuilder({ page }).include('[data-legend-rn]').analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
});

test('익명이면 이름 공개를 권하고, 공개하면 결번이 확정된다', async ({ page }) => {
  const bodies = await stubRetirement(page, [
    { kind: 'anonymous', ...SLOT },
    { kind: 'granted', ...SLOT, seq: 1 },
  ]);
  await page.addInitScript(() => localStorage.setItem('ft_name_public', 'false'));
  await retireLegend(page);
  const anon = page.locator('[data-legend-rn="anonymous"]');
  await expect(anon).toContainText('이름을 공개하면');
  // 장면은 화면 아래 15%를 넘어 들어와야 보인다(스크롤 크레딧).
  await anon.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await anon.locator('[data-act="rn-public"]').click();
  await expect(page.locator('[data-legend-rn="granted"]')).toContainText('서버 1번째 결번');
  expect(bodies.at(-1)?.publicName).toBeTruthy();
});

test('자리가 이미 찼으면 명예의 벽 헌정으로 남는다', async ({ page }) => {
  await stubRetirement(page, [{ kind: 'taken', ...SLOT, holder: '김선배' }]);
  await retireLegend(page);
  await expect(page.locator('[data-legend-rn="taken"]')).toContainText(
    '10번은 이미 김선배의 이름으로 남아 있어',
  );
});

// 배포 전에 은퇴한 기록: 이 기기엔 심사 결과가 없고 서버(소급)에만 있다.
const OLD_ID = '0d000000-0000-4000-8000-00000000000a';
async function seedOldLegend(page: Page) {
  await page.route(`${API}/v1/careers/mine`, (r) => r.fulfill(ok({ linked: false, entries: [] })));
  await page.addInitScript(
    ({ id, slot }) => {
      const career = Array.from({ length: 8 }, (_, i) => ({
        year: 2030 + i,
        age: 26 + i,
        club: slot.club,
        league: '프리미어리그',
        apps: 38,
        goals: 30,
        assists: 10,
        cs: 0,
        rating: 7.9,
        rank: 1,
        ovr: 88,
        honors: ['프리미어리그 우승', 'UEFA 챔피언스리그 우승', '발롱도르'],
      }));
      localStorage.setItem(
        'ft_hof',
        JSON.stringify([
          {
            id,
            name: '옛레전드',
            pos: 'FW',
            number: 10,
            peak: 90,
            age: 34,
            apps: 304,
            goals: 240,
            assists: 80,
            trophies: 16,
            awards: 8,
            caps: 0,
            ballon: 8,
            lastClub: slot.club,
            score: 1500,
            date: '2026-09-01',
            public: true,
            detail: {
              number: 10,
              pos: 'FW',
              age: 34,
              peak: 90,
              lastClub: slot.club,
              career,
              trophies: [],
              awards: [],
              ballon: [],
              nat: { caps: 0 },
              storyLog: [],
              miles: [],
            },
          },
        ]),
      );
    },
    { id: OLD_ID, slot: SLOT },
  );
}

test('소급으로 받은 결번이 이 기기의 내 선수 배지와 상세 세리머니에 보인다', async ({ page }) => {
  await seedOldLegend(page);
  await page.route(`${API}/v1/retired-numbers*`, (r) =>
    r.fulfill(
      ok({
        items: [
          {
            ...SLOT,
            seq: 1,
            grantedAt: '2026-09-01T00:00:00.000Z',
            careerId: OLD_ID,
            name: '옛레전드',
            pos: 'FW',
          },
        ],
      }),
    ),
  );
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await expect(page.locator('[data-my-player="0"] [data-rn-chip]')).toHaveText('👑 영결 10');
  await page.locator('[data-my-player="0"]').click();
  await expect(page.locator('[data-legend-rn-pill]')).toContainText('영결 10');
  await expect(page.locator('[data-legend-rn="granted"]')).toContainText('서버 1번째 결번');
});

test('자리를 못 받은 옛 기록은 상세를 열 때 서버에 물어 명예의 벽 헌정을 보여 준다', async ({
  page,
}) => {
  await seedOldLegend(page);
  await page.route(`${API}/v1/retired-numbers*`, (r) => r.fulfill(ok({ items: [] })));
  let asked = 0;
  await page.route(`${API}/v1/careers/${OLD_ID}/retired-number`, (r) => {
    asked++;
    return r.fulfill(ok({ retiredNumber: { kind: 'taken', ...SLOT, holder: '김선배' } }));
  });
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await page.locator('[data-my-player="0"]').click();
  await expect(page.locator('[data-legend-rn="taken"]')).toContainText('김선배');
  // 결과를 기기에 남겨 다시 열어도 묻지 않는다. 내 선수 상세는 뒤로 가기로 돌아간다(T-10-128).
  await page.goBack();
  await page.locator('[data-my-player="0"]').click();
  await expect(page.locator('[data-legend-rn="taken"]')).toContainText('김선배');
  expect(asked).toBe(1);
});

// 서버 어딘가에서 결번이 확정되면(홈 라이브 소켓) 게임 중에도 화면 위에 알린다. 내 선수 소식은 띄우지 않는다.
test('다른 유저의 영구결번이 확정되면 플레이 중인 화면 위에 알림이 뜨고, 보기로 상세를 연다', async ({
  page,
}) => {
  const OTHER = '0d000000-0000-4000-8000-00000000000b';
  let push: (item: unknown) => void = () => {};
  let connected = false;
  await page.routeWebSocket(`${API.replace('http', 'ws')}/v1/live/ws`, (ws) => {
    push = (item) => ws.send(JSON.stringify({ type: 'retiredNumber', item }));
    connected = true;
  });
  await seedOldLegend(page);
  const entry = {
    id: OTHER,
    name: '박결번',
    pos: 'MF',
    number: 8,
    retireAge: 35,
    peak: 90,
    legendScore: 1500,
    apps: 500,
    goals: 90,
    assists: 150,
    trophies: 20,
    awards: 5,
    caps: 40,
    ballon: 2,
    lastClub: SLOT.club,
    retiredAt: '2026-09-28T11:00:00.000Z',
    hasDetail: false,
    retiredNumber: { ...SLOT, number: 8, seq: 5 },
  };
  await page.route(`${API}/v1/hof/${OTHER}`, (r) => r.fulfill(ok({ entry, snapshot: null })));
  await startCareer(page);
  await expect.poll(() => connected).toBe(true);

  const at = '2026-09-28T11:00:00.000Z';
  push({ careerId: OLD_ID, name: '옛레전드', pos: 'FW', ...SLOT, seq: 4, at });
  const alert = page.locator('[data-rn-alert]');
  await page.waitForTimeout(300);
  await expect(alert).toHaveCount(0);
  push({
    careerId: OTHER,
    name: '박결번',
    pos: 'MF',
    ...SLOT,
    club: '레알',
    number: 8,
    seq: 5,
    at,
  });
  await expect(alert).toHaveAttribute('data-rn-alert', '5');
  await expect(alert).toContainText('박결번, 8번 영구결번');
  await expect(alert).toContainText('맨체스터 스카이블루 · 서버 5번째 결번');
  await alert.screenshot({ path: test.info().outputPath('retired-number-alert.png') });
  const axe = await new AxeBuilder({ page }).include('[data-rn-alert]').analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);

  await alert.locator('[data-act="rn-alert-open"]').click();
  await expect(alert).toHaveCount(0);
  await expect(page.locator('.film-open h1')).toHaveText('박결번');
  await expect(page.locator('[data-legend-rn-pill]')).toContainText('영결 8');
});

test('기록실 영구결번 탭: 구단별(결번 많은 구단 먼저)·최신순으로 보고, 누르면 상세에 갔다 같은 탭으로 돌아온다', async ({
  page,
}) => {
  await seedOldLegend(page);
  const OTHER = '0d000000-0000-4000-8000-00000000000c';
  const item = (seq: number, o: Record<string, unknown>) => ({
    ...SLOT,
    seq,
    grantedAt: `2026-09-28T1${seq}:00:00.000Z`,
    careerId: `0d000000-0000-4000-8000-00000000010${seq}`,
    name: `결번${seq}`,
    pos: 'FW',
    ...o,
  });
  const items = [
    item(1, { clubId: 'k1-0', club: '울산 호랑이', number: 1, pos: 'GK', name: null }),
    item(2, { careerId: OLD_ID, name: '옛레전드' }),
    item(3, { number: 4, pos: 'DF', careerId: OTHER, name: '박결번', club: '시티' }),
  ];
  // T-11-101 첫 화면은 요약만, 구단·최신순은 고를 때 따로 받는다.
  const asked: string[] = [];
  await page.route(`${API}/v1/retired-numbers**`, (r) => {
    const url = new URL(r.request().url());
    asked.push(url.pathname + url.search);
    if (url.pathname.endsWith('/summary'))
      return r.fulfill(
        ok({
          season: 0,
          total: 3,
          clubs: [
            { clubId: 'pl-0', club: '시티', count: 2 },
            { clubId: 'k1-0', club: '울산 호랑이', count: 1 },
          ],
          recent: [...items].reverse(),
        }),
      );
    const club = url.searchParams.get('club');
    if (club)
      return r.fulfill(
        ok({
          season: 0,
          items: items.filter((it) => it.clubId === club).sort((a, b) => a.number - b.number),
        }),
      );
    return r.fulfill(ok({ season: 0, items: [...items].reverse(), next: null }));
  });
  await page.route(`${API}/v1/hof/${OTHER}`, (r) =>
    r.fulfill(
      ok({
        entry: {
          id: OTHER,
          name: '박결번',
          pos: 'DF',
          number: 4,
          retireAge: 35,
          peak: 88,
          legendScore: 1200,
          apps: 400,
          goals: 20,
          assists: 30,
          trophies: 12,
          awards: 2,
          caps: 40,
          ballon: 0,
          lastClub: SLOT.club,
          retiredAt: '2026-09-28T13:00:00.000Z',
          hasDetail: false,
          retiredNumber: { ...SLOT, number: 4, seq: 3 },
        },
        snapshot: null,
      }),
    ),
  );
  await page.goto('/');
  await page
    .getByRole('navigation', { name: '메인 메뉴' })
    .getByRole('button', { name: '기록실' })
    .click();
  await page.locator('[data-hof-tab="rn"]').click();

  const wall = page.locator('[data-rn-wall]');
  await expect(wall.locator('[data-rn-club]')).toHaveCount(2);
  // 첫 화면은 요약 하나만 받는다.
  expect(asked).toEqual(['/v1/retired-numbers/summary?season=0']);
  // 최근 결번은 최신순, 구단 이름을 함께 단다.
  await expect(wall.locator('[data-rn-tile]').first()).toHaveAttribute('data-rn-tile', '3');
  await expect(wall.locator('[data-rn-tile]').first()).toContainText('맨체스터 스카이블루');
  // 결번 둘인 맨체스터가 먼저. 결번 당시 유저가 바꿔 부른 이름('시티')이 아니라 게임 기본 이름으로 건다.
  await expect(wall.locator('[data-rn-club]').first()).toHaveAttribute('data-rn-club', 'pl-0');
  await expect(wall.locator('[data-rn-club="pl-0"] b')).toHaveText('맨체스터 스카이블루');
  const axe = await new AxeBuilder({ page }).include('[data-rn-wall]').analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);

  await wall.locator('[data-rn-club-order="league"]').click();
  await expect(wall.locator('[data-rn-league]')).toHaveText([/프리미어리그\s*2/, /K리그1\s*1/]);

  // 구단을 누르면 그 구단 결번만 받아 번호 순으로.
  await wall.locator('[data-rn-club="pl-0"]').click();
  await expect(wall.locator('[data-rn-tile]')).toHaveText([
    /4\s*박결번/,
    /10\s*옛레전드.*내 선수/s,
  ]);
  expect(asked.at(-1)).toBe('/v1/retired-numbers?season=0&club=pl-0');
  await wall.locator('[data-rn-pos="DF"]').click();
  await expect(wall.locator('[data-rn-tile]')).toHaveCount(1);
  await wall.locator('[data-rn-back]').click();

  await wall.locator('[data-rn-recent-all]').click();
  await expect(wall.locator('[data-rn-tile]')).toHaveCount(3);
  expect(asked.at(-1)).toBe('/v1/retired-numbers?season=0&before=0');
  await expect(wall.locator('[data-rn-more]')).toHaveCount(0);

  await wall.locator('[data-rn-tile="3"]').click();
  await expect(page.locator('.film-open h1')).toHaveText('박결번');
  await page.locator('[data-act="hof-back"]').click();
  await expect(page.locator('[data-hof-tab="rn"]')).toHaveAttribute('aria-selected', 'true');
  // 선수 상세에 다녀와도 최신순 화면 그대로.
  await expect(wall).toHaveAttribute('data-rn-screen', 'recent');
});
