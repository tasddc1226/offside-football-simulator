import { test, expect, type Page, type Route } from '@playwright/test';

// T-10-016 운영 도구 · 밸런스 설정. API는 route로 흉내 낸다(e2e 기본 API 주소 localhost:8787).
const API = 'http://localhost:8787';
const ok = (data: unknown, status = 200) => ({ status, json: { data, meta: { requestId: 'req_e2e' } } });
const T = '2026-09-25T03:00:00.000Z';
const SPAMMER = 'prf_00000000-0000-0000-0000-00000000000a';
const FAN = 'prf_00000000-0000-0000-0000-00000000000b';
const DAYS = Array.from({ length: 14 }, (_, i) => `2026-09-${String(12 + i).padStart(2, '0')}`);
const STATS = {
  generatedAt: T,
  profiles: { total: 1234, linked: 321, new24h: 12, new7d: 80, active24h: 150, active7d: 600 },
  careers: { total: 900, active: 700, retired: 200, new7d: 60, retired7d: 15 },
  board: { posts: 5, comments: 42, comments7d: 9 },
  daily: DAYS.map((day, i) => ({ day, profiles: i, careers: i * 2, retired: i % 3 })),
  balance: { version: 1, activatedAt: T },
  audit: [{ kind: 'BALANCE_ACTIVATED', createdAt: T }],
};

type V = { version: number; status: 'draft' | 'active' | 'archived'; note: string; values: Record<string, unknown>; createdAt: string; updatedAt: string; activatedAt: string | null };

async function mockApi(page: Page, opts: { linked: boolean; admin: boolean }) {
  const sent: { method: string; path: string; body: unknown }[] = [];
  const versions: V[] = [{ version: 1, status: 'active', note: '첫 설정', values: { koreaStr: 76 }, createdAt: T, updatedAt: T, activatedAt: T }];
  await page.route(`${API}/v1/profile`, (route) =>
    route.fulfill(ok({ id: 'u1', linked: { google: opts.linked }, googleEmailMasked: opts.linked ? 'ad***@gmail.com' : null, recoveryCodeIssuedAt: null, createdAt: T })),
  );
  await page.route(`${API}/v1/boards/**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    sent.push({ method: 'GET', path, body: null });
    if (path === '/v1/boards/viewer') return route.fulfill(ok({ admin: opts.admin }));
    return route.fulfill(ok({ posts: [], hasMore: false }));
  });
  const comments = [
    { id: 'cmt_00000000-0000-0000-0000-000000000001', postId: 'pst_00000000-0000-0000-0000-000000000001', postTitle: '서버 점검 안내', board: 'notice', profileId: SPAMMER, nickname: '광고봇', body: '싸다 싸', admin: false, createdAt: T },
    { id: 'cmt_00000000-0000-0000-0000-000000000002', postId: 'pst_00000000-0000-0000-0000-000000000001', postTitle: '서버 점검 안내', board: 'notice', profileId: FAN, nickname: '팬1', body: '수고하세요', admin: false, createdAt: T },
  ];
  await page.route(`${API}/v1/admin/stats`, (route) => {
    sent.push({ method: 'GET', path: '/v1/admin/stats', body: null });
    return route.fulfill(ok(STATS));
  });
  await page.route(`${API}/v1/admin/comments**`, (route) => {
    const req = route.request();
    const url = new URL(req.url());
    sent.push({ method: req.method(), path: url.pathname + url.search, body: req.method() === 'GET' ? null : req.postDataJSON() });
    if (url.pathname === '/v1/admin/comments/purge') {
      const target = (req.postDataJSON() as { profileId: string }).profileId;
      const before = comments.length;
      comments.splice(0, comments.length, ...comments.filter((c) => c.profileId !== target));
      return route.fulfill(ok({ deleted: before - comments.length }));
    }
    const profile = url.searchParams.get('profile');
    return route.fulfill(ok({ comments: comments.filter((c) => !profile || c.profileId === profile), hasMore: false }));
  });
  await page.route(`${API}/v1/balance`, (route) => route.fulfill(ok({ version: 1, values: { koreaStr: 76 }, activatedAt: T })));
  await page.route(`${API}/v1/admin/balance**`, async (route: Route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const method = req.method();
    const body = method === 'GET' ? null : req.postDataJSON();
    sent.push({ method, path, body });
    const m = /^\/v1\/admin\/balance\/(\d+)(\/activate)?$/.exec(path);
    if (path === '/v1/admin/balance' && method === 'GET') return route.fulfill(ok({ versions: [...versions].reverse() }));
    if (path === '/v1/admin/balance' && method === 'POST') {
      const v: V = { version: versions.length + 1, status: 'draft', note: body.note, values: body.values, createdAt: T, updatedAt: T, activatedAt: null };
      versions.push(v);
      return route.fulfill(ok(v, 201));
    }
    const v = m && versions.find((x) => x.version === +m[1]!);
    if (v && method === 'PUT') return route.fulfill(ok(Object.assign(v, { note: body.note, values: body.values })));
    if (v && m![2]) {
      for (const x of versions) if (x.status === 'active') x.status = 'archived';
      return route.fulfill(ok(Object.assign(v, { status: 'active', activatedAt: T })));
    }
    return route.fulfill({ status: 404, json: { error: { code: 'VALIDATION_FAILED', message: '없음', retryable: false } } });
  });
  return sent;
}

test('운영 도구: 초안을 만들어 수치를 고치고 적용한다', async ({ page }) => {
  const sent = await mockApi(page, { linked: true, admin: true });
  page.on('dialog', (d) => void d.accept());
  await page.goto('/');
  await expect(page.getByText('ad***@gmail.com')).toBeVisible();
  await page.locator('[data-act="settings"]').click();
  await page.locator('[data-act="admin"]').click();
  await expect(page.locator('h1')).toHaveText('운영 도구');
  await page.locator('[data-admin-tab="balance"]').click();
  await expect(page.locator('[data-version="1"]')).toContainText('적용 중');

  await page.locator('[data-act="new-draft"]').click();
  await expect(page.locator('[data-editing="2"]')).toBeVisible();
  expect(sent.find((s) => s.method === 'POST' && s.path === '/v1/admin/balance')?.body).toEqual({ note: '', values: { koreaStr: 76 } });

  await page.locator('#bal-note').fill('성장 상향');
  await page.locator('#knob-growthScale').fill('1.2');
  await page.locator('#knob-growthScale').blur();
  await expect(page.locator('[data-knob="growthScale"]')).toHaveClass(/changed/);
  await expect(page.locator('.admin-diff')).toContainText('성장 배율: 1 → 1.2');
  await page.locator('[data-act="save-draft"]').click();
  await expect.poll(() => sent.find((s) => s.method === 'PUT')?.body).toEqual({ note: '성장 상향', values: { koreaStr: 76, growthScale: 1.2 } });

  await page.locator('[data-act="activate"]').click();
  await expect(page.locator('[data-version="2"]')).toContainText('적용 중');
  await expect(page.locator('[data-version="1"]')).toContainText('보관');
  expect(sent.some((s) => s.path === '/v1/admin/balance/2/activate')).toBe(true);
});

test('운영 도구: 구글 연결이 없으면 관리자 여부를 묻지도 않고 입구가 없다', async ({ page }) => {
  const sent = await mockApi(page, { linked: false, admin: false });
  await page.goto('/');
  await page.locator('[data-act="settings"]').click();
  await expect(page.locator('h1')).toHaveText('게임 설정');
  await expect(page.locator('[data-act="admin"]')).toHaveCount(0);
  expect(sent.some((s) => s.path === '/v1/boards/viewer')).toBe(false);
});

test('운영 도구: 대시보드가 기본 탭이고, 댓글 탭에서 작성자 댓글을 모아 보고 모두 지운다', async ({ page }) => {
  const sent = await mockApi(page, { linked: true, admin: true });
  page.on('dialog', (d) => void d.accept());
  await page.goto('/');
  await expect(page.getByText('ad***@gmail.com')).toBeVisible();
  await page.locator('[data-act="settings"]').click();
  await page.locator('[data-act="admin"]').click();
  await expect(page.locator('[data-stat="users"]')).toContainText('1,234');
  await expect(page.locator('[data-stat="active"]')).toContainText('150');
  await expect(page.locator('[data-series="profiles"] .bar')).toHaveCount(14);
  await expect(page.locator('[data-admin="dashboard"]')).toContainText('밸런스 적용');

  // 탭을 오가도 대시보드 집계는 다시 받지 않는다(1분 메모).
  await page.locator('[data-admin-tab="comments"]').click();
  await expect(page.locator('[data-admin-comment]')).toHaveCount(2);
  await page.locator('[data-admin-tab="dashboard"]').click();
  await expect(page.locator('[data-stat="users"]')).toBeVisible();
  expect(sent.filter((s) => s.path === '/v1/admin/stats')).toHaveLength(1);

  await page.locator('[data-admin-tab="comments"]').click();
  const spam = page.locator('[data-admin-comment="cmt_00000000-0000-0000-0000-000000000001"]');
  await spam.locator('[data-act="filter-author"]').click();
  await expect(page.locator('.author-filter')).toContainText('광고봇');
  await expect(page.locator('[data-admin-comment]')).toHaveCount(1);
  expect(sent.some((s) => s.path === `/v1/admin/comments?profile=${SPAMMER}`)).toBe(true);

  await spam.locator('[data-act="purge-author"]').click();
  await expect(page.locator('#toast')).toContainText('댓글 1개를 지웠어요');
  await expect(page.locator('[data-admin-comment]')).toHaveCount(0);
  await page.locator('[data-act="clear-filter"]').click();
  await expect(page.locator('[data-admin-comment]')).toHaveCount(1);
  expect(sent.find((s) => s.path === '/v1/admin/comments/purge')?.body).toEqual({ profileId: SPAMMER });
});
