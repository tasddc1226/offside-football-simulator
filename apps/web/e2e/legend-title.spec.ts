import { test, expect, type Page } from '@playwright/test';

// 이 기기의 은퇴 기록은 프리시즌 데이터다. 개막 날짜와 무관하게 같은 목록을 검증한다.
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-30T00:00:00.000Z'));
});
import { API, ok } from './helpers.js';

// 은퇴한 내 선수의 대표 칭호를 그 선수가 받은 칭호 중에서 다시 고른다(내 선수 상세 아래 카드).
const ID = '0d000000-0000-4000-8000-00000000000c';

/** 은퇴한 내 선수 한 명(이 기기 기록)과 API 목. 은퇴 PUT 본문을 모은다. */
async function seed(page: Page, style?: Record<string, unknown>, retiredNumber: unknown = null) {
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
  await page.route(`${API}/v1/careers/mine`, (r) => r.fulfill(ok({ linked: false, entries: [] })));
  await page.route(`${API}/v1/retired-numbers*`, (r) => r.fulfill(ok({ items: [] })));
  await page.route(`${API}/v1/careers/${ID}/retired-number`, (r) =>
    r.fulfill(ok({ retiredNumber })),
  );
  await page.route(`${API}/v1/careers/${ID}/retirement`, (r) => {
    bodies.push(r.request().postDataJSON() as Record<string, unknown>);
    return r.fulfill(ok({ careerId: ID, status: 'retired', retiredNumber }));
  });
  await page.addInitScript(
    ({ id, style }) => {
      if (localStorage.getItem('ft_hof')) return;
      const career = Array.from({ length: 8 }, (_, i) => ({
        year: 2030 + i,
        age: 26 + i,
        club: '맨체스터 스카이블루',
        league: '프리미어리그',
        apps: 38,
        goals: 20,
        assists: 10,
        cs: 0,
        rating: 7.4,
        rank: 2,
        ovr: 85,
        honors: [],
      }));
      localStorage.setItem(
        'ft_hof',
        JSON.stringify([
          {
            id,
            name: '칭호왕',
            pos: 'FW',
            number: 9,
            peak: 86,
            age: 34,
            apps: 304,
            goals: 160,
            assists: 80,
            trophies: 0,
            awards: 0,
            caps: 0,
            ballon: 0,
            lastClub: '맨체스터 스카이블루',
            score: 500,
            date: '2026-09-01',
            public: true,
            title: 'europe',
            detail: {
              number: 9,
              pos: 'FW',
              age: 34,
              peak: 86,
              lastClub: '맨체스터 스카이블루',
              career,
              trophies: [],
              awards: [],
              ballon: [],
              nat: { caps: 0 },
              storyLog: [],
              miles: [],
              titles: [
                { id: 'europe', year: 2030 },
                { id: 'oneclub', year: 2037 },
              ],
              ...(style ? { style } : {}),
            },
          },
        ]),
      );
    },
    { id: ID, style },
  );
  return bodies;
}

test('은퇴한 내 선수의 대표 칭호를 받은 칭호 중에서 바꾼다', async ({ page }) => {
  const bodies = await seed(page);
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await page.locator('[data-my-player="0"]').click();
  await expect(page.locator('[data-legend-title]')).toHaveText('‘유럽파’');

  // 받은 칭호 목록은 접혀 있다가 펼쳐서 고른다. 고르면 다시 접힌다.
  const card = page.locator('[data-legend-titles]');
  await expect(card.locator('[data-legend-title-pick]')).toHaveCount(0);
  await card.locator('[data-act="legend-title-open"]').click();
  await expect(card.locator('[data-legend-title-pick="europe"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await card.locator('[data-legend-title-pick="oneclub"]').click();
  await expect(card.locator('[data-legend-title-pick]')).toHaveCount(0);
  await expect(card.locator('.title-main')).toContainText('원클럽맨');
  await expect(page.locator('[data-legend-title]')).toHaveText('‘원클럽맨’');
  await expect.poll(() => bodies.at(-1)?.title).toBe('oneclub');

  // 기기 기록에 남아 다시 열어도 그대로다. 내 선수 상세는 뒤로 가기로 돌아간다(T-10-126).
  await page.goBack();
  await page.locator('[data-my-player="0"]').click();
  await expect(page.locator('[data-legend-title]')).toHaveText('‘원클럽맨’');
});

// T-10-077 은퇴 리포트의 플레이 성향 — 커리어 내내 센 선택으로 유형을 뽑는다. 선택 기록이 없는 옛 은퇴는 그리지 않는다.
test('은퇴 리포트에 플레이 성향 카드가 나온다', async ({ page }) => {
  await seed(page, {
    from: 18,
    betOdds: 1050,
    bets: 22,
    betWins: 15,
    longshots: 9,
    longshotWins: 5,
    safe: 6,
    sure: 8,
    best: { id: 'rival', p: 0.18 },
    moves: 4,
    tierUp: 3,
    tierDown: 0,
    payFirst: 1,
    loyal: 3,
    snubUp: 1,
  });
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await page.locator('[data-my-player="0"]').click();
  const card = page.locator('[data-legend-style]');
  // 한 구단에서만 8시즌 — 대표 유형은 원클럽, 운·승부수 성향은 곁들인다.
  await expect(card).toHaveAttribute('data-legend-style', 'oneclub');
  await expect(card.locator('[data-style-name]')).toHaveText('원클럽 순정파');
  await expect(card).toContainText('타고난 강운');
  await expect(card).toContainText('올인 승부사');
  await expect(card).toContainText('+4.5');
  await expect(card.locator('[data-style-best]')).toContainText(
    '성공 확률 18%의 ‘포지션 경쟁자 영입’',
  );
});

test('선택 기록이 없는 은퇴에는 플레이 성향 카드가 없다', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await page.locator('[data-my-player="0"]').click();
  await expect(page.locator('[data-credit="finale"]')).toBeAttached();
  await expect(page.locator('[data-legend-style]')).toHaveCount(0);
});

test('명예의 벽은 받은 칭호 목록에 추가되고 기존 대표 칭호를 유지한다', async ({ page }) => {
  const result = {
    kind: 'taken',
    clubId: 'pl-0',
    club: '맨체스터 스카이블루',
    number: 9,
    holder: '선배',
    wallOfHonor: true,
  };
  const bodies = await seed(page, undefined, result);
  let checks = 0;
  await page.route(`${API}/v1/careers/${ID}/retired-number`, (r) => {
    checks++;
    return r.fulfill(ok({ retiredNumber: result }));
  });
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await page.locator('[data-my-player="0"]').click();
  await expect(page.locator('[data-wall-of-honor]')).toContainText('영구결번은 아니에요.');
  await expect(page.locator('[data-legend-title]')).toHaveText('‘유럽파’');
  await page.locator('[data-act="legend-title-open"]').click();
  await expect(page.locator('[data-legend-title-pick="wall_of_honor"]')).toContainText('명예의 벽');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('[data-legend-title-pick="wall_of_honor"]').click();
  await expect.poll(() => bodies.at(-1)?.title).toBe('wall_of_honor');
  await expect(page.locator('[data-legend-title]')).toHaveText('‘명예의 벽’');
  await page.goBack();
  await page.locator('[data-my-player="0"]').click();
  await expect(page.locator('[data-wall-of-honor]')).toBeAttached();
  // Successful PUT invalidates the GET memo, so one new verification is expected.
  await expect.poll(() => checks).toBe(2);
  await page.goBack();
  await page.locator('[data-my-player="0"]').click();
  await expect(page.locator('[data-wall-of-honor]')).toBeAttached();
  expect(checks).toBe(2);
});
