import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { API, ok } from './helpers.js';

// T-11-310 감독 커리어 — 시작(확인 창) · 기기에서 시즌 진행 · 확정 · 감독 칸 · 포기. 서버는 page.route로 흉내 낸다.

const A = '00000000-0000-4000-8000-000000000051';
const B = '00000000-0000-4000-8000-000000000052';
const MGR = 'mgr_00000000-0000-4000-8000-000000000061';

const candidate = (careerId: string, name: string, over: Record<string, unknown> = {}) => ({
  careerId,
  publicName: name,
  number: 8,
  pos: 'MF',
  dpos: 'CM',
  peak: 86,
  season: 0,
  cardValue: 300_000,
  inLineup: false,
  listed: false,
  ...over,
});
const ORIGIN = {
  pos: 'MF',
  dpos: 'CM',
  seasons: 14,
  apps: 400,
  clubs: 2,
  trophies: 5,
  caps: 30,
  peak: 86,
  legendScore: 600,
  retireAge: 35,
  nation: 'KR',
};

/** 감독 API를 흉내 내는 작은 서버(진행 중 하나 · 끝낸 감독 · 감독 칸). */
function server() {
  const s = {
    gets: 0,
    started: [] as unknown[],
    finished: null as unknown,
    abandoned: 0,
    coachPuts: [] as unknown[],
    active: null as null | Record<string, unknown>,
    managers: [] as Record<string, unknown>[],
    coachId: null as string | null,
    candidates: [candidate(A, '감독 후보', { inLineup: true }), candidate(B, '다른 후보')],
  };
  const body = () => ({
    active: s.active,
    managers: s.managers,
    candidates: s.candidates,
    coachId: s.coachId,
    hasTeam: true,
  });
  async function install(page: Page) {
    await page.route(
      (u) => u.href.startsWith(API) && u.pathname === '/v1/managers',
      async (r) => {
        if (r.request().method() === 'GET') {
          s.gets++;
          return r.fulfill(ok(body()));
        }
        const { careerId } = r.request().postDataJSON() as { careerId: string };
        s.started.push(careerId);
        const c = s.candidates.find((x) => x.careerId === careerId)!;
        s.candidates = s.candidates.filter((x) => x.careerId !== careerId);
        s.active = {
          id: MGR,
          careerId,
          status: 'active',
          seed: 12345,
          origin: ORIGIN,
          result: null,
          publicName: c.publicName,
          number: c.number,
          startedAt: '2026-10-16T00:00:00.000Z',
          finishedAt: null,
        };
        return r.fulfill(ok({ career: s.active }, 201));
      },
    );
    await page.route(`${API}/v1/managers/${MGR}/abandon`, (r) => {
      s.abandoned++;
      const id = s.active!.careerId as string;
      s.candidates = [candidate(id, '감독 후보', { inLineup: false }), ...s.candidates];
      s.active = null;
      return r.fulfill({ status: 204, body: '' });
    });
    await page.route(`${API}/v1/managers/${MGR}/finish`, (r) => {
      const { result } = r.request().postDataJSON() as { result: Record<string, unknown> };
      s.finished = result;
      const done = { ...s.active!, status: 'done', result, finishedAt: '2026-10-16T01:00:00.000Z' };
      s.managers = [done];
      s.active = null;
      return r.fulfill(ok({ career: done }));
    });
    await page.route(`${API}/v1/owner-team/coach`, (r) => {
      const { coach } = r.request().postDataJSON() as { coach: string | null };
      s.coachPuts.push(coach);
      s.coachId = coach;
      return r.fulfill(ok({ coach: null }));
    });
  }
  return { s, install };
}

async function stubOwner(page: Page) {
  await page.route(`${API}/v1/profile`, (r) =>
    r.fulfill(
      ok({
        id: 'u1',
        linked: { google: true, toss: false },
        googleEmailMasked: 'te***@gmail.com',
        recoveryCodeIssuedAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        nickname: '구단주',
      }),
    ),
  );
  await page.route(`${API}/v1/boards/viewer`, (r) =>
    r.fulfill(ok({ admin: false, google: true, nickname: '구단주' })),
  );
  await page.route(`${API}/v1/market/funds`, (r) =>
    r.fulfill(ok({ balance: 200_000, clubValue: 500_000 })),
  );
  await page.route(`${API}/v1/careers/mine**`, (r) => r.fulfill(ok({ linked: true, entries: [] })));
}

/** 다음에 누를 수 있는 진행 버튼 하나를 누른다. 확정 단계면 false. */
async function step(page: Page): Promise<boolean> {
  const order = [
    'manager-finish',
    'manager-live-skip',
    'manager-live-done',
    'manager-accept',
    'manager-rest',
    'manager-season',
    'manager-transfer',
    'manager-choice',
    'manager-next',
    'manager-result',
    'manager-continue',
  ];
  for (const act of order) {
    const btn = page.locator(`[data-act="${act}"]`).first();
    if (await btn.isVisible()) {
      if (act === 'manager-finish') return false;
      await btn.click();
      return true;
    }
  }
  throw new Error('진행할 버튼이 없어요');
}

test('은퇴 선수로 감독 커리어를 끝까지 하고 감독 칸에 앉힌다', async ({ page }) => {
  await stubOwner(page);
  const { s, install } = server();
  await install(page);

  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await page.locator('[data-act="manager"]').click();
  await expect(page.locator('[data-manager-start]')).toContainText('감독 후보');
  // 화면을 오가도 목록을 다시 묻지 않는다(메모).
  await page.goBack();
  await page.locator('[data-act="manager"]').click();
  await expect(page.locator('[data-manager-start]')).toBeVisible();
  expect(s.gets).toBe(1);
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map((v) => `${v.id} (${v.impact})`)).toEqual([]);

  // 확인 창이 잃는 것을 보여 준다(선발 · 구단 가치 · 팔 수 없음 · 포기).
  await page
    .locator('[data-manager-candidate]')
    .first()
    .locator('[data-act="manager-pick"]')
    .click();
  const dialog = page.locator('[data-manager-confirm]');
  await expect(dialog).toContainText('선발 · 친선 편성 · 프리셋에서 빠지고');
  await expect(dialog).toContainText('구단 가치가');
  await expect(dialog).toContainText('팔거나 방출하거나 잠글 수 없어요');
  await page.locator('[data-act="manager-start"]').click();
  await expect.poll(() => s.started).toEqual([A]);
  await expect(page.locator('[data-manager-play]')).toHaveAttribute('data-manager-play', 'offers');

  // 첫 시즌 준비까지 간 뒤 새로 고쳐도 기기 세이브로 이어 한다.
  await page.locator('[data-act="manager-accept"]').first().click();
  await expect(page.locator('[data-manager-setup]')).toBeVisible();
  await page.reload();
  if (!(await page.locator('[data-manager]').isVisible())) {
    await page.locator('[data-act="owner"]').click();
    await page.locator('[data-act="manager"]').click();
  }
  await expect(page.locator('[data-manager-setup]')).toBeVisible();

  // 첫 시즌: 이벤트를 다 보면 경기 중계가 한 경기씩 올라오고, 결산에 이번 시즌 변화가 칩으로 나온다.
  const liveBox = page.locator('[data-manager-live]');
  for (let i = 0; i < 20 && !(await liveBox.isVisible()); i++) await step(page);
  await expect(liveBox.locator('.ticker div').first()).toBeVisible();
  await page.locator('[data-act="manager-live-skip"]').click();
  await expect(liveBox.locator('.ticker div')).toHaveCount(5);
  await page.locator('[data-act="manager-live-done"]').click();
  await expect(page.locator('[data-manager-result]')).toBeVisible();
  await expect(page.locator('[data-manager-change] .chip').first()).toBeVisible();

  for (let i = 0; i < 300 && (await step(page)); i++);
  await expect(page.locator('[data-manager-totals]')).toBeVisible();
  await expect(page.locator('[data-manager-done]')).toContainText('등급');
  await page.locator('[data-act="manager-finish"]').click();
  await expect
    .poll(() => s.finished)
    .toMatchObject({ seasons: expect.any(Number), grade: expect.any(String) });
  const card = page.locator(`[data-manager-card="${A}"]`);
  await expect(card).toContainText('감독 칸 효과');
  await expect(page.locator('[data-manager-start]')).toContainText('다른 후보');

  await card.locator('[data-act="manager-seat"]').click();
  await expect(card).toContainText('우리 팀 감독');
  await card.locator('[data-act="manager-unseat"]').click();
  await expect(card.locator('[data-act="manager-seat"]')).toBeVisible();
  await expect.poll(() => s.coachPuts).toEqual([A, null]);
});

test('감독 커리어를 포기하면 원래 선수로 돌아온다', async ({ page }) => {
  await stubOwner(page);
  const { s, install } = server();
  await install(page);
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await page.locator('[data-act="manager"]').click();
  await page
    .locator('[data-manager-candidate]')
    .first()
    .locator('[data-act="manager-pick"]')
    .click();
  await page.locator('[data-act="manager-start"]').click();
  await expect(page.locator('[data-manager-play]')).toBeVisible();
  await page.locator('[data-act="manager-abandon"]').click();
  await expect(page.locator('[data-manager-abandon]')).toContainText('원래 선수로 돌아와요');
  await page.locator('[data-act="manager-abandon-confirm"]').click();
  await expect.poll(() => s.abandoned).toBe(1);
  await expect(page.locator('[data-manager-start]')).toContainText('감독 후보');
});
