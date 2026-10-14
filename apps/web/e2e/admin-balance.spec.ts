import { test, expect, type Page, type Route } from '@playwright/test';
import { ok, fail, API } from './helpers.js';

// T-10-016 운영 도구 · 밸런스 설정. API는 route로 흉내 낸다(e2e 기본 API 주소 localhost:8787).
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

type V = {
  version: number;
  status: 'draft' | 'active' | 'archived';
  note: string;
  values: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  activatedAt: string | null;
};

async function mockApi(page: Page, opts: { linked: boolean; admin: boolean }) {
  const sent: { method: string; path: string; body: unknown }[] = [];
  const versions: V[] = [
    {
      version: 1,
      status: 'active',
      note: '첫 설정',
      values: { koreaStr: 76 },
      createdAt: T,
      updatedAt: T,
      activatedAt: T,
    },
  ];
  await page.route(`${API}/v1/profile`, (route) =>
    route.fulfill(
      ok({
        id: 'u1',
        linked: { google: opts.linked },
        googleEmailMasked: opts.linked ? 'ad***@gmail.com' : null,
        recoveryCodeIssuedAt: null,
        createdAt: T,
        nickname: null,
      }),
    ),
  );
  await page.route(`${API}/v1/owner/summary`, (route) =>
    route.fulfill(ok({ linked: opts.linked, admin: opts.admin, tier: null, entries: [] })),
  );
  await page.route(`${API}/v1/boards/**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    sent.push({ method: 'GET', path, body: null });
    if (path === '/v1/boards/viewer')
      return route.fulfill(ok({ admin: opts.admin, google: opts.linked, nickname: null }));
    return route.fulfill(ok({ posts: [], hasMore: false }));
  });
  const comments = [
    {
      id: 'cmt_00000000-0000-0000-0000-000000000001',
      postId: 'pst_00000000-0000-0000-0000-000000000001',
      postTitle: '서버 점검 안내',
      board: 'notice',
      profileId: SPAMMER,
      nickname: '광고봇',
      body: '싸다 싸',
      admin: false,
      createdAt: T,
    },
    {
      id: 'cmt_00000000-0000-0000-0000-000000000002',
      postId: 'pst_00000000-0000-0000-0000-000000000001',
      postTitle: '서버 점검 안내',
      board: 'notice',
      profileId: FAN,
      nickname: '팬1',
      body: '수고하세요',
      admin: false,
      createdAt: T,
    },
  ];
  await page.route(`${API}/v1/admin/stats`, (route) => {
    sent.push({ method: 'GET', path: '/v1/admin/stats', body: null });
    return route.fulfill(ok(STATS));
  });
  await page.route(`${API}/v1/admin/comments**`, (route) => {
    const req = route.request();
    const url = new URL(req.url());
    sent.push({
      method: req.method(),
      path: url.pathname + url.search,
      body: req.method() === 'GET' ? null : req.postDataJSON(),
    });
    if (url.pathname === '/v1/admin/comments/purge') {
      const target = (req.postDataJSON() as { profileId: string }).profileId;
      const before = comments.length;
      comments.splice(0, comments.length, ...comments.filter((c) => c.profileId !== target));
      return route.fulfill(ok({ deleted: before - comments.length }));
    }
    const profile = url.searchParams.get('profile');
    return route.fulfill(
      ok({ comments: comments.filter((c) => !profile || c.profileId === profile), hasMore: false }),
    );
  });
  const nameReports = [
    {
      kind: 'team',
      targetId: 'tm_bad',
      name: '나쁜 구단 · 나쁜 감독',
      reports: 2,
      lastReportedAt: T,
    },
  ];
  await page.route(`${API}/v1/admin/name-reports**`, (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    sent.push({
      method: req.method(),
      path,
      body: req.method() === 'GET' ? null : req.postDataJSON(),
    });
    if (path === '/v1/admin/name-reports/resolve') {
      nameReports.length = 0;
      return route.fulfill({ status: 204 });
    }
    return route.fulfill(ok({ items: nameReports }));
  });
  await page.route(`${API}/v1/balance`, (route) =>
    route.fulfill(ok({ version: 1, values: { koreaStr: 76 }, activatedAt: T })),
  );
  await page.route(`${API}/v1/admin/balance**`, async (route: Route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const method = req.method();
    const body = method === 'GET' ? null : req.postDataJSON();
    sent.push({ method, path, body });
    const m = /^\/v1\/admin\/balance\/(\d+)(\/activate)?$/.exec(path);
    if (path === '/v1/admin/balance' && method === 'GET')
      return route.fulfill(ok({ versions: [...versions].reverse() }));
    if (path === '/v1/admin/balance' && method === 'POST') {
      const v: V = {
        version: versions.length + 1,
        status: 'draft',
        note: body.note,
        values: body.values,
        createdAt: T,
        updatedAt: T,
        activatedAt: null,
      };
      versions.push(v);
      return route.fulfill(ok(v, 201));
    }
    const v = m && versions.find((x) => x.version === +m[1]!);
    if (v && method === 'PUT')
      return route.fulfill(ok(Object.assign(v, { note: body.note, values: body.values })));
    if (v && m![2]) {
      for (const x of versions) if (x.status === 'active') x.status = 'archived';
      return route.fulfill(ok(Object.assign(v, { status: 'active', activatedAt: T })));
    }
    return route.fulfill(fail(404, 'VALIDATION_FAILED', '없음'));
  });
  return sent;
}

test('운영 도구: 초안을 만들어 수치를 고치고 적용한다', async ({ page }) => {
  const sent = await mockApi(page, { linked: true, admin: true });
  page.on('dialog', (d) => void d.accept());
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await expect(page.getByText('ad***@gmail.com')).toBeVisible();
  await page.locator('[data-act="admin"]').click();
  await expect(page.locator('h1')).toHaveText('운영 도구');
  await page.locator('[data-admin-tab="balance"]').click();
  await expect(page.locator('[data-version="1"]')).toContainText('적용 중');

  await page.locator('[data-act="new-draft"]').click();
  await expect(page.locator('[data-editing="2"]')).toBeVisible();
  expect(sent.find((s) => s.method === 'POST' && s.path === '/v1/admin/balance')?.body).toEqual({
    note: '',
    values: { koreaStr: 76 },
  });

  await page.locator('#bal-note').fill('성장 상향');
  await page.locator('#knob-growthScale').fill('1.2');
  await page.locator('#knob-growthScale').blur();
  await expect(page.locator('[data-knob="growthScale"]')).toHaveClass(/changed/);
  await expect(page.locator('.admin-diff')).toContainText('성장 배율: 1 → 1.2');
  await page.locator('[data-act="save-draft"]').click();
  await expect
    .poll(() => sent.find((s) => s.method === 'PUT')?.body)
    .toEqual({ note: '성장 상향', values: { koreaStr: 76, growthScale: 1.2 } });

  await page.locator('[data-act="activate"]').click();
  await expect(page.locator('[data-version="2"]')).toContainText('적용 중');
  await expect(page.locator('[data-version="1"]')).toContainText('보관');
  expect(sent.some((s) => s.path === '/v1/admin/balance/2/activate')).toBe(true);
});

test('운영 도구: 구글 연결이 없으면 관리자 여부를 묻지도 않고 입구가 없다', async ({ page }) => {
  const sent = await mockApi(page, { linked: false, admin: false });
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await expect(page.locator('h1')).toHaveText('내 구단');
  await expect(page.locator('[data-act="admin"]')).toHaveCount(0);
  expect(sent.some((s) => s.path === '/v1/boards/viewer')).toBe(false);
});

test('운영 도구: 대시보드가 기본 탭이고, 댓글 탭에서 작성자 댓글을 모아 보고 모두 지운다', async ({
  page,
}) => {
  const sent = await mockApi(page, { linked: true, admin: true });
  page.on('dialog', (d) => void d.accept());
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await expect(page.getByText('ad***@gmail.com')).toBeVisible();
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
  expect(sent.find((s) => s.path === '/v1/admin/comments/purge')?.body).toEqual({
    profileId: SPAMMER,
  });

  // 이름 신고는 같은 탭 위쪽에서 대상마다 한 줄로 보고 기각·가리기를 한다.
  const named = page.locator('[data-name-report="tm_bad"]');
  await expect(named).toContainText('신고 2');
  await named.locator('[data-act="name-dismiss"]').click();
  await expect(page.locator('#toast')).toContainText('신고를 기각했어요');
  await expect(page.locator('[data-name-report]')).toHaveCount(0);
  expect(sent.find((s) => s.path === '/v1/admin/name-reports/resolve')?.body).toEqual({
    kind: 'team',
    id: 'tm_bad',
    action: 'dismiss',
  });
});

test('운영 도구: 자동 플레이 탭은 열 때 불러오고, 구간을 바꾸면 다시 받는다', async ({ page }) => {
  await mockApi(page, { linked: true, admin: true });
  const asked: string[] = [];
  await page.route(`${API}/v1/admin/automation**`, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/enforcement'))
      return route.fulfill(
        ok({ enabled: true, ruleVersion: '1', sweep: null, actions: [], next: null }),
      );
    asked.push(url.searchParams.get('hours')!);
    return route.fulfill(
      ok({
        generatedAt: T,
        hours: Number(url.searchParams.get('hours')),
        profiles: 55,
        suspects: [
          {
            profile: 'prf_0000',
            score: 4,
            level: 'high',
            reasons: ['metronome', 'serial'],
            seasons: 60,
            activeHours: 3,
            firstAt: T,
            lastAt: T,
            careers: [
              {
                careerId: '0f000000-0000-4000-8000-000000000001',
                name: 'Maverick#4',
                status: 'active',
                seasons: 12,
                medianGapSec: 49,
                cv: 0.05,
                reasons: ['metronome'],
              },
            ],
          },
        ],
      }),
    );
  });
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await expect(page.getByText('ad***@gmail.com')).toBeVisible();
  await page.locator('[data-act="admin"]').click();
  await expect(page.locator('[data-stat="users"]')).toBeVisible();
  expect(asked).toEqual([]);
  await page.locator('[data-admin-tab="automation"]').click();
  const bot = page.locator('[data-suspect="prf_0000"]');
  await expect(bot).toContainText('높음');
  await expect(bot.locator('[data-reason="metronome"]')).toHaveText('기계처럼 일정한 간격');
  await expect(bot).toContainText('Maverick#4');
  await expect(bot).toContainText('간격 49초 · 변동 0.05');
  await expect(page.locator('[data-automation-summary]')).toContainText('55개 프로필 중 1곳');
  await page.locator('[data-automation-hours="24"]').click();
  await expect.poll(() => asked).toEqual(['6', '24']);
});

test('자동 숨김 이력: 모바일, 페이지 이동, 복구 및 탭 재진입 캐시', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await mockApi(page, { linked: true, admin: true });
  const id = '0f000000-0000-4000-8000-000000000001';
  const key = `automation_action:${T}:${id}:hide`;
  let hidden = true;
  let reads = 0;
  await page.route(`${API}/v1/admin/automation?**`, (r) =>
    r.fulfill(ok({ generatedAt: T, hours: 6, profiles: 1, suspects: [] })),
  );
  await page.route(`${API}/v1/admin/automation/enforcement**`, (r) => {
    reads++;
    const older = new URL(r.request().url()).searchParams.has('before');
    return r.fulfill(
      ok({
        enabled: true,
        ruleVersion: '1',
        sweep: {
          since: '',
          through: T,
          cursor: '',
          checked: 29834,
          hidden: 186,
          status: 'complete',
          updatedAt: T,
          ruleVersion: '1',
        },
        actions: [
          {
            careerId: id,
            at: T,
            action: 'hide',
            source: older ? 'upload' : 'sweep',
            ruleVersion: '1',
            reasons: ['webdriver', 'noInput'],
            seasons: 27,
            key: older ? key.replace(':hide', ':restore') : key,
            hidden,
          },
        ],
        next: older ? null : key,
      }),
    );
  });
  await page.route(`${API}/v1/admin/careers/hidden**`, (r) => {
    expect(r.request().postDataJSON()).toEqual({ careerId: id, hidden: false });
    hidden = false;
    return r.fulfill({ status: 204 });
  });
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await page.locator('[data-act="admin"]').click();
  await page.locator('[data-admin-tab="automation"]').click();
  const panel = page.locator('[data-automation-enforcement]');
  await expect(panel).toContainText('점검 완료');
  await expect(panel).toContainText('29,834');
  await expect(panel).toContainText('자동화 브라우저');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await page.locator('[data-admin-tab="dashboard"]').click();
  await page.locator('[data-admin-tab="automation"]').click();
  await expect(panel).toBeVisible();
  expect(reads).toBe(1);
  await panel.getByRole('button', { name: '이전 이력 더 보기' }).click();
  await expect(panel.locator('[data-automation-action]')).toHaveCount(2);
  page.once('dialog', (d) => d.accept());
  await panel.getByRole('button', { name: '숨김 해제' }).first().click();
  await expect(panel).toContainText('복구됨');
  await expect(panel.getByRole('button', { name: '숨김 해제' })).toHaveCount(0);
  expect(reads).toBe(3);
});

test('T-11-263 유저 조회 탭: 찾아서 요약을 보고, 확인 뒤 아이템을 지급한다', async ({ page }) => {
  await mockApi(page, { linked: true, admin: true });
  const queries: string[] = [];
  const grants: unknown[] = [];
  let reroll = 2;
  const user = () => ({
    generatedAt: T,
    profile: {
      id: FAN,
      nickname: '팬1',
      friendCode: 'ABCD2345',
      title: null,
      createdAt: T,
      lastSeenAt: T,
      deletedAt: null,
      google: true,
      apple: false,
      toss: false,
      recoveryIssuedAt: null,
    },
    sessions: [{ channel: 'app', active: 1, lastSeenAt: T }],
    devices: [{ platform: 'ios', appVersion: '1.1.2', updatedAt: T }],
    careers: { total: 3, active: 1, retired: 2, recent: [] },
    teams: [],
    cups: [],
    funds: 120,
    items: { reroll },
    purchases: [
      {
        store: 'apple',
        productId: 'com.offsidelab.app.reroll_40',
        item: 'reroll',
        qty: 40,
        test: false,
        createdAt: T,
        refundedAt: null,
        revokedQty: 0,
      },
    ],
    fundsPurchases: [],
    grants: grants.length
      ? [{ item: 'reroll', delta: 5, reason: '점검 보상', by: 'prf_admin', createdAt: T }]
      : [],
    scout: { used: 0, streak: 0, elites: 0 },
  });
  await page.route(`${API}/v1/admin/users**`, (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === 'POST') {
      grants.push(route.request().postDataJSON());
      reroll += 5;
      return route.fulfill(ok({ item: 'reroll', qty: reroll }));
    }
    queries.push(url.searchParams.get('q')!);
    return route.fulfill(ok(user()));
  });
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await page.locator('[data-act="admin"]').click();
  await page.locator('[data-admin-tab="users"]').click();
  expect(queries).toEqual([]);
  await page.locator('[data-user-query]').fill('팬1');
  await page.locator('[data-act="find-user"]').click();
  const card = page.locator(`[data-user="${FAN}"]`);
  await expect(card).toContainText('리롤권 2');
  await expect(card.locator('[data-user-section="purchases"]')).toContainText(
    '리롤권 40장 · App Store',
  );
  await page.locator('[data-grant-delta]').fill('5');
  await page.locator('[data-grant-reason]').fill('점검 보상');
  page.once('dialog', (d) => void d.accept());
  await page.locator('[data-act="grant-item"]').click();
  await expect
    .poll(() => grants)
    .toEqual([{ item: 'reroll', delta: 5, reason: '점검 보상', notify: true }]);
  await expect(card.locator('[data-user-section="grants"]')).toContainText('리롤권 +5 · 점검 보상');
  expect(queries).toEqual(['팬1', FAN]);
});

test('T-11-263 매출 탭: 열 때 불러오고, 기간을 바꾸면 다시 받는다', async ({ page }) => {
  await mockApi(page, { linked: true, admin: true });
  const asked: string[] = [];
  await page.route(`${API}/v1/admin/revenue**`, (route) => {
    const days = Number(new URL(route.request().url()).searchParams.get('days'));
    asked.push(String(days));
    return route.fulfill(
      ok({
        generatedAt: T,
        days,
        total: { count: 3, krw: 8800, buyers: 2, firstBuyers: 1, refunds: 0, refundKrw: 0 },
        allTime: { count: 10, krw: 22000, buyers: 5 },
        daily: Array.from({ length: days }, (_, i) => ({
          day: `2026-09-${String(10 + i).padStart(2, '0')}`,
          count: 1,
          krw: 1100,
        })),
        products: [{ productId: 'com.offsidelab.app.scout_5', count: 2, krw: 8800, refunded: 0 }],
        stores: [{ store: 'google', count: 3, krw: 8800 }],
        removeAds: { count: 1, refunds: 0, krw: 3300, since: T },
        recent: [],
      }),
    );
  });
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await page.locator('[data-act="admin"]').click();
  await expect(page.locator('[data-stat="users"]')).toBeVisible();
  expect(asked).toEqual([]);
  await page.locator('[data-admin-tab="revenue"]').click();
  const sum = page.locator('[data-revenue-summary]');
  await expect(sum).toContainText('₩8,800 · 3건');
  await expect(sum).toContainText('광고 제거');
  await expect(page.locator('[data-admin="revenue"]')).toContainText('프리미엄 스카우트권 5장');
  await page.locator('[data-revenue-days="30"]').click();
  await expect.poll(() => asked).toEqual(['7', '30']);
});
