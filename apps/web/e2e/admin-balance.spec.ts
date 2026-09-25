import { test, expect, type Page, type Route } from '@playwright/test';

// T-10-016 운영 도구 · 밸런스 설정. API는 route로 흉내 낸다(e2e 기본 API 주소 localhost:8787).
const API = 'http://localhost:8787';
const ok = (data: unknown, status = 200) => ({ status, json: { data, meta: { requestId: 'req_e2e' } } });
const T = '2026-09-25T03:00:00.000Z';

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
