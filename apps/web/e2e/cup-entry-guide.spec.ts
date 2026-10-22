import { expect, test, type Page } from '@playwright/test';
import { API, ok } from './helpers.js';

// T-11-443 컵 신청 안내: 신청 전 확인, 신청할 수 없는 이유에서 편성으로 가기, 비로그인 로그인 카드의 신청 안내.
const cup = {
  id: 's2-3',
  season: 2,
  edition: 3,
  division: null,
  ovrMax: null,
  opensAt: '2026-11-02T12:10:00.000Z',
  closesAt: '2026-11-05T15:00:00.000Z',
  drawAt: '2026-11-06T03:00:00.000Z',
  rounds: [
    { round: 'g1', at: '2026-11-06T12:00:00.000Z', lockAt: '2026-11-06T11:00:00.000Z' },
    { round: 'f', at: '2026-11-11T12:00:00.000Z', lockAt: '2026-11-11T11:00:00.000Z' },
  ],
  capacity: 128,
  minFilled: 8,
};
const profile = (google: boolean) => ({
  id: 'u1',
  linked: { google, apple: false },
  googleEmailMasked: google ? 'u***@example.com' : null,
  recoveryCodeIssuedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
});

async function open(
  page: Page,
  o: { google: boolean; eligibility: { ok: boolean; reason: string | null; filled: number } },
) {
  await page.clock.setFixedTime(new Date('2026-11-03T03:00:00.000Z'));
  const s = { enters: 0 };
  await page.route(`${API}/**`, (r) => {
    const path = new URL(r.request().url()).pathname;
    const method = r.request().method();
    if (path === '/v1/cups/s2-3/entries' && method === 'POST') {
      s.enters++;
      return r.fulfill(ok(null, 201));
    }
    const data =
      path === '/v1/profile'
        ? profile(o.google)
        : path === '/v1/cups/home'
          ? {
              cup,
              phase: 'open',
              entries: 3,
              teamCount: 3,
              round: null,
              championName: null,
              champion: null,
            }
          : path === '/v1/cups/current'
            ? {
                cup,
                phase: 'open',
                entries: 3,
                teams: [],
                groups: [],
                matches: [],
                championTeamId: null,
              }
            : path === '/v1/cups/current/me'
              ? {
                  entry: null,
                  eligibility: o.eligibility,
                  next: null,
                  nextOdds: null,
                  locked: false,
                  rerolls: 0,
                  ovr: 70,
                }
              : null;
    return data ? r.fulfill(ok(data)) : r.fulfill({ status: 503, body: '' });
  });
  await page.goto('/');
  await page.locator('[data-act="cup-open"]').click();
  return s;
}

test('신청은 확인을 거친다: 취소하면 보내지 않고, 신청하기를 누르면 한 번 보낸다', async ({
  page,
}) => {
  const s = await open(page, { google: true, eligibility: { ok: true, reason: null, filled: 11 } });
  await page.locator('[data-act="cup-enter"]').click();
  const ask = page.locator('[data-cup-enter-ask]');
  await expect(ask).toContainText('컵에 신청할까요?');
  await expect(ask).toContainText('신청을 취소할 수 있어요');
  await page.locator('[data-act="cup-enter-cancel"]').click();
  await expect(ask).toHaveCount(0);
  expect(s.enters).toBe(0);
  await page.locator('[data-act="cup-enter"]').click();
  await page.locator('[data-act="cup-enter-confirm"]').click();
  await expect.poll(() => s.enters).toBe(1);
});

test('선발이 모자라 신청할 수 없으면 편성으로 가기로 팀 화면을 연다', async ({ page }) => {
  await open(page, { google: true, eligibility: { ok: false, reason: 'not-enough', filled: 5 } });
  await expect(page.locator('[data-cup-reason="not-enough"]')).toContainText('5명');
  const team = page.waitForRequest((q) => new URL(q.url()).pathname === '/v1/owner-team');
  await page.locator('[data-act="cup-to-lineup"]').click();
  await team;
  await expect(page.locator('[data-cup-hero]')).toHaveCount(0);
});

test('정원이 차서 신청할 수 없으면 편성 버튼이 없다', async ({ page }) => {
  await open(page, { google: true, eligibility: { ok: false, reason: 'full', filled: 11 } });
  await expect(page.locator('[data-cup-reason="full"]')).toBeVisible();
  await expect(page.locator('[data-act="cup-to-lineup"]')).toHaveCount(0);
});

test('로그인하지 않았으면 로그인 카드가 신청과 승부예측을 함께 안내한다', async ({ page }) => {
  await open(page, { google: false, eligibility: { ok: false, reason: 'no-team', filled: 0 } });
  await expect(page.locator('[data-cup-login-note]')).toContainText('컵에 신청하고 승부예측');
  await expect(page.locator('[data-act="cup-enter"]')).toHaveCount(0);
});
