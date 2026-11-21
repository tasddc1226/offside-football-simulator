import { test, expect } from '@playwright/test';
import { API, ok, fail } from './helpers.js';

// T-11-802 운영 도구 '유저 의견' 탭: 게임 안 의견을 읽고(다른 언어 글은 번역 보기), 처리 표시를 한다. 처리한 뒤에는 목록을 다시
// 부르지 않고 그 행만 뺀다. 더 보기는 마지막 시각 이전을, '이 프로필만'은 한 프로필의 글만 부른다.
const at = '2026-11-21T03:00:00.000Z';
const P1 = 'prf_aaaaaaaa1111';
const P2 = 'prf_bbbbbbbb2222';
const voice = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  kind: 'bug',
  body: '경기 결과 화면이 멈춰요',
  screen: 'settings',
  platform: 'web',
  version: '2026.11.21',
  device: 'android',
  lang: 'ko',
  createdAt: at,
  resolvedAt: null,
  profileId: P1,
  linked: false,
  ...over,
});
const FIRST = [
  voice('vox_1'),
  voice('vox_2', {
    kind: 'idea',
    body: 'Please add a calendar view.',
    lang: 'en',
    platform: 'ios',
    version: '1.1.7 (120)',
    device: 'ios 18.1',
    screen: 'home',
    linked: true,
    profileId: P2,
    createdAt: '2026-11-21T02:00:00.000Z',
  }),
];
const MORE = [voice('vox_3', { body: '세 번째 의견', createdAt: '2026-11-20T02:00:00.000Z' })];

test('유저 의견: 목록 · 번역 보기 · 처리 · 더 보기 · 이 프로필만', async ({ page }) => {
  const gets: URLSearchParams[] = [];
  const resolves: unknown[] = [];
  const translates: unknown[] = [];
  await page.route(`${API}/v1/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    if (path === '/v1/profile')
      return route.fulfill(
        ok({
          id: 'u1',
          linked: { google: true },
          googleEmailMasked: 'ad***@gmail.com',
          nickname: null,
          recoveryCodeIssuedAt: null,
          createdAt: at,
        }),
      );
    if (path === '/v1/owner/summary')
      return route.fulfill(ok({ linked: true, admin: true, tier: null, entries: [] }));
    if (path === '/v1/boards/viewer')
      return route.fulfill(ok({ admin: true, google: true, nickname: null }));
    if (path === '/v1/admin/voices') {
      const q = url.searchParams;
      gets.push(q);
      if (q.get('profile'))
        return route.fulfill(ok({ items: [FIRST[1]], hasMore: false, open: 3 }));
      if (q.get('before')) return route.fulfill(ok({ items: MORE, hasMore: false, open: 3 }));
      return route.fulfill(ok({ items: FIRST, hasMore: true, open: 3 }));
    }
    if (path === '/v1/admin/voices/resolve') {
      const body = req.postDataJSON() as { ids: string[] };
      resolves.push(body);
      return route.fulfill(ok({ updated: body.ids.length }));
    }
    if (path === '/v1/translate') {
      translates.push(req.postDataJSON());
      return route.fulfill(ok({ text: '달력 보기를 넣어 주세요.' }));
    }
    return route.fulfill(fail(404, 'NOT_FOUND', 'No fixture'));
  });
  await page.goto('/');
  await page.locator('[data-act="settings"]').click();
  await expect(page.getByText('ad***@gmail.com')).toBeVisible();
  await page.locator('[data-act="admin"]').click();
  expect(gets).toHaveLength(0);
  await page.locator('[data-admin-tab="voices"]').click();
  const section = page.locator('[data-admin="voices"]');
  await expect(section.locator('[data-admin-voice]')).toHaveCount(2);
  expect(gets).toHaveLength(1);
  expect(gets[0]!.get('status')).toBe('open');
  await expect(section.locator('[data-voice-open]')).toHaveText('열린 의견 3');

  const v2 = section.locator('[data-admin-voice="vox_2"]');
  await expect(v2.locator('[data-voice-meta]')).toHaveText(
    '26.11.21 11:00 · iOS · 1.1.7 (120) · ios 18.1 · 홈 · 영어 · 로그인 구단주',
  );
  await expect(section.locator('[data-admin-voice="vox_1"] [data-voice-meta]')).toContainText(
    '· 웹 · ',
  );
  await expect(section.locator('[data-admin-voice="vox_1"] [data-voice-meta]')).toContainText(
    '익명',
  );
  // 한국어 글에는 번역 버튼이 없고, 영어 글은 번역 보기 · 원문 보기를 오간다.
  await expect(section.locator('[data-admin-voice="vox_1"] [data-act="translate"]')).toHaveCount(0);
  await v2.locator('[data-act="translate"]').click();
  await expect(v2.locator('p')).toHaveText('달력 보기를 넣어 주세요.');
  await v2.locator('[data-act="translate"]').click();
  await expect(v2.locator('p')).toHaveText('Please add a calendar view.');
  expect(translates).toHaveLength(1);

  // 처리하면 그 행만 빠지고 목록을 다시 부르지 않는다.
  await section.locator('[data-admin-voice="vox_1"] [data-act="voice-resolve"]').click();
  await expect(section.locator('[data-admin-voice="vox_1"]')).toHaveCount(0);
  await expect(page.locator('.toast')).toContainText('1건 처리했어요');
  await expect(section.locator('[data-voice-open]')).toHaveText('열린 의견 2');
  expect(resolves).toEqual([{ ids: ['vox_1'], resolved: true }]);
  expect(gets).toHaveLength(1);

  // 더 보기는 마지막 시각 이전을 부른다.
  await section.locator('[data-act="voices-more"]').click();
  await expect(section.locator('[data-admin-voice="vox_3"]')).toBeVisible();
  expect(gets[1]!.get('before')).toBe('2026-11-21T02:00:00.000Z');
  await expect(section.locator('[data-act="voices-more"]')).toHaveCount(0);

  // 보이는 열린 의견 모두 처리(확인 창을 거친다).
  page.once('dialog', (d) => {
    expect(d.message()).toBe('2건을 처리할까요?');
    void d.accept();
  });
  await section.locator('[data-act="voices-resolve-all"]').click();
  await expect(section.locator('[data-voice-empty]')).toHaveText('열린 의견이 없어요.');
  expect(resolves.at(-1)).toEqual({ ids: ['vox_2', 'vox_3'], resolved: true });

  // 이 프로필만: 새로고침한 목록에서 한 프로필을 고르면 그 프로필로 다시 부른다.
  await section.locator('[data-act="voices-refresh"]').click();
  await section.locator('[data-admin-voice="vox_2"] [data-act="voice-filter-profile"]').click();
  await expect(section.locator('[data-voice-profile]')).toContainText('bbbbbbbb');
  await expect(section.locator('[data-admin-voice]')).toHaveCount(1);
  expect(gets.at(-1)!.get('profile')).toBe(P2);
  await section.locator('[data-act="voice-clear-profile"]').click();
  await expect(section.locator('[data-admin-voice]')).toHaveCount(2);
  expect(gets.at(-1)!.get('profile')).toBeNull();

  // 전체 보기에서는 처리해도 빼지 않고 '처리함'을 붙이고, 다시 열 수 있다.
  await section.locator('[data-voice-view="all"]').click();
  await expect.poll(() => gets.at(-1)!.get('status')).toBe('all');
  const row = section.locator('[data-admin-voice="vox_1"]');
  await row.locator('[data-act="voice-resolve"]').click();
  await expect(row).toHaveAttribute('data-resolved', '1');
  await row.locator('[data-act="voice-reopen"]').click();
  await expect(row).toHaveAttribute('data-resolved', '0');
  await expect(page.locator('.toast').last()).toContainText('다시 열었어요');
  expect(resolves.at(-1)).toEqual({ ids: ['vox_1'], resolved: false });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('유저 의견: 더 보기를 두 번 눌러도 한 번만 부르고, 이미 처리된 의견은 그렇게 알린다', async ({
  page,
}) => {
  const befores: string[] = [];
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route(`${API}/v1/**`, async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path === '/v1/profile')
      return route.fulfill(
        ok({
          id: 'u1',
          linked: { google: true },
          googleEmailMasked: 'ad***@gmail.com',
          nickname: null,
          recoveryCodeIssuedAt: null,
          createdAt: at,
        }),
      );
    if (path === '/v1/owner/summary')
      return route.fulfill(ok({ linked: true, admin: true, tier: null, entries: [] }));
    if (path === '/v1/boards/viewer')
      return route.fulfill(ok({ admin: true, google: true, nickname: null }));
    if (path === '/v1/admin/voices') {
      const before = url.searchParams.get('before');
      if (!before) return route.fulfill(ok({ items: FIRST, hasMore: true, open: 0 }));
      befores.push(before);
      await new Promise((r) => setTimeout(r, 600));
      return route.fulfill(ok({ items: MORE, hasMore: false, open: 0 }));
    }
    // 다른 운영자가 먼저 처리해 바뀐 것이 없다.
    if (path === '/v1/admin/voices/resolve') return route.fulfill(ok({ updated: 0 }));
    return route.fulfill(fail(404, 'NOT_FOUND', 'No fixture'));
  });
  await page.goto('/');
  await page.locator('[data-act="settings"]').click();
  await expect(page.getByText('ad***@gmail.com')).toBeVisible();
  await page.locator('[data-act="admin"]').click();
  await page.locator('[data-admin-tab="voices"]').click();
  const section = page.locator('[data-admin="voices"]');
  await expect(section.locator('[data-admin-voice]')).toHaveCount(2);
  // 열린 의견이 0이면 경고 색을 쓰지 않는다.
  await expect(section.locator('[data-voice-open]')).not.toHaveClass(/warn/);

  const more = section.locator('[data-act="voices-more"]');
  await more.click();
  await expect(more).toBeDisabled();
  await more.click({ force: true });
  await expect(section.locator('[data-admin-voice]')).toHaveCount(3);
  expect(befores).toHaveLength(1);

  await section.locator('[data-admin-voice="vox_1"] [data-act="voice-resolve"]').click();
  await expect(page.locator('.toast')).toContainText('이미 처리된 의견이에요');
  expect(errors.filter((e) => e.includes('each_key_duplicate'))).toEqual([]);
});
