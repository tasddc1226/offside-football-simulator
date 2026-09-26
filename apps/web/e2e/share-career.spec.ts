import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { retireFromMarket } from './helpers.js';

// T-10-029: 은퇴 화면 맨 아래 — 로그인하지 않았으면 로그인을 권하고, 구글 로그인했으면 보기 전용 공유 링크
// (/career/<id>)를 만든다. 링크를 연 사람은 크레딧 연출로 리포트를 보고 자기 커리어를 시작할 수 있다.
const API = 'http://localhost:8787';
const profile = (google: boolean) => ({
  data: { id: 'u1', linked: { google, toss: false }, googleEmailMasked: google ? 'te***@gmail.com' : null, recoveryCodeIssuedAt: null, createdAt: '2026-01-01T00:00:00.000Z', nickname: null },
});
const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

/** 프로필·은퇴 업로드·명예의 전당 상세를 스텁한다. 상세는 이 기기가 올린 은퇴 요약을 그대로 돌려준다. */
async function stubApi(page: Page, state: { google: boolean }) {
  const uploaded = new Map<string, Record<string, unknown>>();
  await page.route(`${API}/v1/profile`, (r) => r.fulfill(json(profile(state.google))));
  await page.route(/\/v1\/careers\/[^/]+\/(seasons\/\d+|retirement)$/, async (r) => {
    const m = /careers\/([^/]+)\/retirement$/.exec(r.request().url());
    if (m) uploaded.set(m[1]!, r.request().postDataJSON() as Record<string, unknown>);
    await r.fulfill(json({ data: {} }));
  });
  await page.route(/\/v1\/hof\/[0-9a-f-]{36}$/, async (r) => {
    const id = r.request().url().split('/').pop()!;
    const b = uploaded.get(id);
    if (!b) return r.fulfill(json({ error: { code: 'VALIDATION_FAILED', message: '없음', retryable: false, details: { reason: 'HOF_NOT_FOUND' } } }, 404));
    const entry = {
      id, name: b.publicName ?? null, pos: 'FW', number: 10, retireAge: b.retireAge, peak: b.peak, legendScore: b.legendScore,
      apps: b.apps, goals: b.goals, assists: b.assists, trophies: b.trophies, awards: b.awards, caps: b.caps, ballon: b.ballon,
      lastClub: b.lastClub, retiredAt: '2026-09-26T00:00:00.000Z', hasDetail: true, title: b.title ?? null,
    };
    await r.fulfill(json({ data: { entry, snapshot: b.snapshot } }));
  });
  return uploaded;
}

async function retireNow(page: Page) {
  await retireFromMarket(page, 34); // 짧은 커리어는 공유 카드 대신 안내가 나온다(T-10-032).
  await page.locator('[data-act="credits-skip"]').click();
}

test('로그인하지 않았으면 은퇴 화면 맨 아래에서 로그인을 권하고, 로그인하고 돌아오면 공유 카드로 온다', async ({ page }) => {
  const state = { google: false };
  await stubApi(page, state);
  // 구글 로그인은 바로 성공해 앱의 OAuth 복귀 주소로 돌아온 것처럼 한다.
  await page.route(`${API}/v1/auth/google/start`, (r) => {
    state.google = true;
    return r.fulfill({ status: 302, headers: { location: `${new URL(page.url()).origin}/settings?google=linked` } });
  });
  await retireNow(page);
  const card = page.locator('[data-share="login"]');
  await expect(card).toContainText('로그인하고 커리어를 공유하세요');
  await expect(page.locator('[data-share="ready"]')).toHaveCount(0);
  await card.getByRole('button', { name: '구글로 로그인' }).click();

  await expect(page.getByText('구글 계정을 연결했습니다.')).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  // 설정 화면이 아니라 방금 은퇴한 선수 상세로 돌아와 공유 버튼이 보인다.
  await expect(page.locator('[data-act="hof-back"]')).toBeVisible();
  await expect(page.locator('[data-act="share-career"]')).toBeInViewport();
});

test('로그인했으면 공유 링크를 만들고, 링크를 연 사람은 보기 전용 리포트를 본다', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  // 공유 시트를 지원하는 브라우저여도 띄우지 않고 링크 복사만 한다.
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'share', {
      value: () => {
        (window as unknown as { __shared: boolean }).__shared = true;
        return Promise.resolve();
      },
    }),
  );
  const uploaded = await stubApi(page, { google: true });
  await retireNow(page);
  await expect(page.locator('[data-share="login"]')).toHaveCount(0);
  await page.locator('[data-act="share-career"]').click();
  await expect(page.getByText('공유 링크를 복사했어요.')).toBeVisible();
  const url = await page.locator('.share-url').inputValue();
  expect(url).toMatch(/^http:\/\/localhost:\d+\/career\/[0-9a-f-]{36}$/);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(url);
  expect(await page.evaluate(() => (window as unknown as { __shared?: boolean }).__shared)).toBeUndefined();
  expect(uploaded.has(url.split('/').pop()!)).toBe(true);

  // 링크를 연다: 이름을 공개하지 않았으니 익명, 주인 기능(이름 공개·공유)은 없다.
  await page.goto(url);
  await expect(page.locator('[data-shared="view"]')).toHaveText('공유받은 은퇴 커리어 · 보기 전용');
  await expect(page.locator('.player h1')).toContainText('익명의');
  await page.locator('[data-act="credits-skip"]').click();
  await expect(page.locator('[data-credit="career"]')).toBeVisible();
  await expect(page.locator('[data-act="hof-public"]')).toHaveCount(0);
  await expect(page.locator('[data-act="share-career"]')).toHaveCount(0);
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.map((v) => `${v.id} ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);

  // 이 브라우저엔 세이브가 있으니 내 커리어로 돌아간다(주소도 / 로 바뀐다).
  await page.locator('[data-act="shared-start"]').click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('[data-act="continue"], [data-act="new"]').first()).toBeVisible();
});

test('없는 공유 링크는 안내와 시작 버튼을 보여 준다', async ({ page }) => {
  await stubApi(page, { google: false });
  await page.goto('/career/00000000-0000-4000-8000-000000000000');
  await expect(page.locator('[data-shared="unavailable"]')).toContainText('기록을 찾을 수 없어요');
  await expect(page.locator('[data-act="shared-start"]')).toHaveText('나도 커리어 시작하기 →');
});

test('은퇴 기록이 아직 서버에 없으면 연결 오류가 아니라 "아직 올리지 못했다"고 알린다', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await stubApi(page, { google: true });
  // 은퇴 업로드가 계속 실패해(5xx) 서버엔 기록이 없다. 나중에 등록한 route가 먼저 잡는다.
  await page.route(/\/v1\/careers\/[^/]+\/retirement$/, (r) => r.fulfill({ status: 503, json: { error: { code: 'UNAVAILABLE', message: '점검 중', retryable: true } } }));
  await retireNow(page);
  await page.locator('[data-act="share-career"]').click();
  await expect(page.getByText('기록을 아직 서버에 올리지 못했어요. 잠시 후 다시 시도해 주세요.')).toBeVisible();
  await expect(page.locator('.share-url')).toHaveCount(0);
});
