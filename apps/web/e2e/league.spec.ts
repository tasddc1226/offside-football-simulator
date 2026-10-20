import { expect, test } from '@playwright/test';
import { API, ok } from './helpers.js';

// T-11-418 오프사이드 리그 1차: 홈 배너 → 리그 화면에서 신청 · 취소. 다시 들어와도 공개 조회는 메모로 한 번만 부른다.
const league = {
  season: 2,
  startsAt: '2026-10-30T15:00:00.000Z',
  opensAt: '2026-10-23T15:00:00.000Z',
  closesAt: '2026-11-04T15:00:00.000Z',
  drawAt: '2026-11-05T00:00:00.000Z',
  rounds: Array.from(
    { length: 14 },
    (_, i) => `2026-11-${String(5 + i).padStart(2, '0')}T04:00:00.000Z`,
  ),
  minFilled: 8,
};

test('배너 → 리그 화면 신청 · 취소, 다시 들어와도 리그 조회는 한 번', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-01T03:00:00.000Z'));
  const hits: Record<string, number> = {};
  let entered = false;
  await page.route(`${API}/**`, async (r) => {
    const path = new URL(r.request().url()).pathname;
    const method = r.request().method();
    hits[`${method} ${path}`] = (hits[`${method} ${path}`] ?? 0) + 1;
    if (path === '/v1/profile')
      return r.fulfill(
        ok({
          id: 'u1',
          linked: { google: true },
          googleEmailMasked: 'u***@example.com',
          recoveryCodeIssuedAt: null,
          createdAt: '2026-01-01T00:00:00.000Z',
        }),
      );
    if (path === '/v1/leagues/current')
      return r.fulfill(ok({ league, phase: 'open', entries: entered ? 13 : 12 }));
    if (path === '/v1/leagues/current/me')
      return r.fulfill(
        ok({
          entry: entered ? { createdAt: '2026-11-01T03:00:00.000Z' } : null,
          canEnter: !entered,
          team: { teamId: 'tem_1', filled: 9, ovr: 84 },
        }),
      );
    if (path === '/v1/leagues/current/entries' && method === 'POST') {
      entered = true;
      return r.fulfill({ status: 204, body: '' });
    }
    if (path === '/v1/leagues/current/entries/me' && method === 'DELETE') {
      entered = false;
      return r.fulfill({ status: 204, body: '' });
    }
    return r.fulfill({ status: 503, body: '' });
  });
  await page.goto('/');
  const banner = page.locator('[data-league-banner]');
  await expect(banner).toContainText('12팀 신청 · 11월 4일 23:59까지');
  await banner.click();
  await expect(page.locator('[data-league-schedule]')).toContainText(
    '11월 5일 ~ 11월 18일, 매일 13:00',
  );
  await expect(page.locator('[data-league-ovr]')).toContainText('84');

  // 홈에 갔다가 다시 들어와도 리그 조회는 메모(30초)로 한 번만.
  await page.goBack();
  await page.locator('[data-league-banner]').click();
  await expect(page.locator('[data-act="league-enter"]')).toBeVisible();
  expect(hits['GET /v1/leagues/current']).toBe(1);

  await page.locator('[data-act="league-enter"]').click();
  await expect(page.locator('[data-league-entered]')).toBeVisible();
  page.once('dialog', (d) => void d.accept());
  await page.locator('[data-act="league-withdraw"]').click();
  await expect(page.locator('[data-act="league-enter"]')).toBeVisible();
  expect(hits['POST /v1/leagues/current/entries']).toBe(1);
  expect(hits['DELETE /v1/leagues/current/entries/me']).toBe(1);
});

test('사전 신청: 시즌 2 팀이 없어도 신청할 수 있고, 개막 뒤엔 선발 실카드 n/8을 보인다', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-10-27T03:00:00.000Z'));
  let team: { teamId: string; filled: number; ovr: number } | null = null;
  await page.route(`${API}/**`, (r) => {
    const path = new URL(r.request().url()).pathname;
    if (path === '/v1/profile')
      return r.fulfill(
        ok({
          id: 'u1',
          linked: { google: true },
          googleEmailMasked: 'u***@example.com',
          recoveryCodeIssuedAt: null,
          createdAt: '2026-01-01T00:00:00.000Z',
        }),
      );
    if (path === '/v1/leagues/current') return r.fulfill(ok({ league, phase: 'open', entries: 3 }));
    if (path === '/v1/leagues/current/me')
      return r.fulfill(ok({ entry: null, canEnter: true, team }));
    return r.fulfill({ status: 503, body: '' });
  });
  await page.goto('/');
  await page.locator('[data-league-banner]').click();
  await expect(page.locator('[data-act="league-enter"]')).toBeVisible();
  await expect(page.locator('[data-league-presign]')).toContainText('10월 31일 00:00 개막부터');
  await expect(page.locator('[data-league-ready]')).toHaveCount(0);

  // 개막 뒤: 시즌 2 팀 선발 실카드가 모자라면 n/8을 보이지만 신청은 막지 않는다.
  team = { teamId: 'tem_1', filled: 6, ovr: 70 };
  await page.clock.setFixedTime(new Date('2026-11-01T03:00:00.000Z'));
  await page.goto('/');
  await page.locator('[data-league-banner]').click();
  await expect(page.locator('[data-league-ready="short"]')).toContainText('6/8명');
  await expect(page.locator('[data-league-presign]')).toHaveCount(0);
  await expect(page.locator('[data-act="league-enter"]')).toBeVisible();
});
