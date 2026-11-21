import { test, expect, type Page, type Route } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { API, fail } from './helpers.js';

// T-11-802 게임 안 '의견 보내기': 설정 → 도움말 맨 위 · 홈 맨 아래에서 같은 시트를 연다. 시트를 열 때는 요청하지 않고,
// 보낼 때 POST /v1/voices 한 번만 나간다. 실패하면 쓴 글은 그대로 남고, 닫았다 열어도 초안이 남는다.

type Reply = (route: Route) => Promise<void>;

async function stub(page: Page, reply: Reply = (r) => r.fulfill({ status: 204 })) {
  const requests: string[] = [];
  const posts: Record<string, unknown>[] = [];
  let handler = reply;
  await page.route(`${API}/v1/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    requests.push(`${req.method()} ${url.pathname}`);
    if (url.pathname === '/v1/voices' && req.method() === 'POST') {
      posts.push(req.postDataJSON() as Record<string, unknown>);
      return handler(route);
    }
    return route.fulfill({ status: 503, body: '' });
  });
  return {
    requests,
    posts,
    reply: (r: Reply) => (handler = r),
  };
}

async function openFromSettings(page: Page) {
  await page.locator('[data-act="settings"]').click();
  await page.locator('[data-act="voice"]').click();
  const sheet = page.locator('[data-voice-sheet]');
  await expect(sheet).toBeVisible();
  return sheet;
}

test('설정에서 연 시트는 요청이 없고, 보내면 POST 한 번 뒤 감사 안내를 보인다', async ({
  page,
}) => {
  const api = await stub(page);
  await page.goto('/');
  await page.locator('[data-act="settings"]').click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.waitForLoadState('networkidle');
  const before = api.requests.length;

  await page.locator('[data-act="voice"]').click();
  const sheet = page.locator('[data-voice-sheet="form"]');
  await expect(sheet).toBeVisible();
  // 열 때 초점은 머리줄 닫기 버튼에 둔다(입력 칸에 저절로 초점을 주지 않는다).
  await expect(sheet.locator('[data-act="voice-close"]')).toBeFocused();
  await expect(sheet.locator('[data-voice-count]')).toHaveText('0/500자');
  expect(api.requests.length).toBe(before);
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual(
    [],
  );

  // 종류를 고르면 안내 문구가 바뀌고, 같은 칸을 다시 누르면 고름을 푼다.
  const body = sheet.locator('[data-voice-body]');
  await sheet.locator('[data-voice-kind="bug"]').click();
  await expect(sheet.locator('[data-voice-kind="bug"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(body).toHaveAttribute(
    'placeholder',
    '어느 화면에서 무엇을 했을 때 생기는지 적어 주세요.',
  );
  await sheet.locator('[data-voice-kind="bug"]').click();
  await expect(sheet.locator('[data-voice-kind="bug"]')).toHaveAttribute('aria-pressed', 'false');
  await expect(body).toHaveAttribute('placeholder', '하고 싶은 말을 적어 주세요.');

  // 빈 글 · 한 글자는 보내지 않고 시트 안에서 알린다.
  await sheet.locator('[data-act="voice-submit"]').click();
  await expect(sheet.getByRole('alert')).toHaveText('내용을 적어 주세요.');
  await body.fill('a');
  await sheet.locator('[data-act="voice-submit"]').click();
  await expect(sheet.getByRole('alert')).toHaveText('두 글자 이상 적어 주세요.');
  expect(api.posts).toHaveLength(0);

  await sheet.locator('[data-voice-kind="idea"]').click();
  await body.fill('  리그 일정을 달력으로 보고 싶어요  ');
  await expect(sheet.locator('[data-voice-count]')).toHaveText('22/500자');
  await sheet.locator('[data-act="voice-submit"]').click();
  const done = page.locator('[data-voice-sheet="done"]');
  await expect(done.getByRole('status')).toContainText('잘 받았어요');
  await expect(done.locator('[data-act="voice-close"]')).toBeFocused();
  expect(api.posts).toHaveLength(1);
  const sent = api.posts[0]!;
  expect(sent).toMatchObject({
    kind: 'idea',
    body: '리그 일정을 달력으로 보고 싶어요',
    screen: 'settings',
    platform: 'web',
  });
  expect(typeof sent.version).toBe('string');
  expect(sent.version).not.toBe('');
  expect(sent.device).toMatch(/^[a-z0-9 ._-]+$/);
  // 선수 · 닉네임 · 전체 UA 같은 값은 보내지 않는다.
  expect(Object.keys(sent).toSorted()).toEqual([
    'body',
    'device',
    'kind',
    'platform',
    'screen',
    'version',
  ]);
  expect(api.requests.filter((r) => r === 'POST /v1/voices')).toHaveLength(1);

  // 닫으면 입구로 초점이 돌아오고, 다시 열면 입력 칸 · 종류가 비어 있다.
  await done.locator('[data-act="voice-close"]').click();
  await expect(page.locator('[data-voice-sheet]')).toHaveCount(0);
  await expect(page.locator('[data-act="voice"]')).toBeFocused();
  await page.locator('[data-act="voice"]').click();
  await expect(page.locator('[data-voice-body]')).toHaveValue('');
  await expect(page.locator('[data-voice-kind="idea"]')).toHaveAttribute('aria-pressed', 'false');
});

test('보내지 못하면 글을 그대로 두고 시트 안에서 알린다(503 · 429 · 연결 실패)', async ({
  page,
}) => {
  const api = await stub(page, (r) =>
    r.fulfill(fail(503, 'SERVICE_UNAVAILABLE', '잠시 후 다시 시도해 주세요.')),
  );
  await page.goto('/');
  const sheet = await openFromSettings(page);
  const body = sheet.locator('[data-voice-body]');
  await body.fill('경기 결과 화면이 멈춰요');
  await sheet.locator('[data-act="voice-submit"]').click();
  await expect(sheet.getByRole('alert')).toHaveText('잠시 후 다시 시도해 주세요.');
  await expect(body).toHaveValue('경기 결과 화면이 멈춰요');
  await expect(sheet.locator('[data-act="voice-submit"]')).toBeEnabled();

  api.reply((r) =>
    r.fulfill(
      fail(429, 'RATE_LIMITED', '의견을 너무 자주 보내고 있어요. 잠시 뒤에 다시 시도해 주세요.'),
    ),
  );
  await sheet.locator('[data-act="voice-submit"]').click();
  await expect(sheet.getByRole('alert')).toHaveText(
    '의견을 너무 자주 보내고 있어요. 잠시 뒤에 다시 시도해 주세요.',
  );
  await expect(body).toHaveValue('경기 결과 화면이 멈춰요');

  api.reply((r) => r.abort());
  await sheet.locator('[data-act="voice-submit"]').click();
  await expect(sheet.getByRole('alert')).toHaveText(
    '보내지 못했어요. 쓴 내용은 그대로 있어요. 잠시 뒤 다시 눌러 주세요.',
  );
  await expect(body).toHaveValue('경기 결과 화면이 멈춰요');
  expect(api.posts).toHaveLength(3);
});

test('Esc로 닫았다 다시 열면 초안이 남아 있다', async ({ page }) => {
  await stub(page);
  await page.goto('/');
  const sheet = await openFromSettings(page);
  await sheet.locator('[data-voice-kind="bug"]').click();
  await sheet.locator('[data-voice-body]').fill('초안 남기기');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-voice-sheet]')).toHaveCount(0);
  await page.locator('[data-act="voice"]').click();
  await expect(page.locator('[data-voice-body]')).toHaveValue('초안 남기기');
  await expect(page.locator('[data-voice-kind="bug"]')).toHaveAttribute('aria-pressed', 'true');
});

test('홈 맨 아래 줄로 열면 입구가 home이고, 설정 · 홈을 오가며 여닫아도 새 요청이 없다', async ({
  page,
}) => {
  const api = await stub(page);
  await page.goto('/');
  const entry = page.locator('[data-act="home-voice"]');
  await expect(entry).toBeVisible();
  await expect(entry).toContainText('의견 보내기');
  await page.waitForLoadState('networkidle');
  // 홈 · 설정 화면 자체의 조회(메모)를 한 번씩 데운 뒤 센다.
  await page.locator('[data-act="settings"]').click();
  await expect(page.locator('[data-act="voice"]')).toBeVisible();
  await page.waitForLoadState('networkidle');
  await page.locator('[data-act="home"]').click();
  await expect(entry).toBeVisible();
  await page.waitForLoadState('networkidle');
  const before = [...api.requests];

  for (let i = 0; i < 2; i++) {
    await entry.click();
    await expect(page.locator('[data-voice-sheet]')).toBeVisible();
    await page.locator('[data-act="voice-close"]').click();
    await expect(page.locator('[data-voice-sheet]')).toHaveCount(0);
    await page.locator('[data-act="settings"]').click();
    await page.locator('[data-act="voice"]').click();
    await expect(page.locator('[data-voice-sheet]')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.locator('[data-act="home"]').click();
    await expect(entry).toBeVisible();
  }
  await page.waitForLoadState('networkidle');
  const opened = api.requests.slice(before.length);
  // 홈 · 설정을 다시 그릴 때 메모 밖에서 다시 부르는 조회가 있어도, 시트를 여는 것만으로 늘어난 요청은 없다.
  expect(opened.filter((r) => r.includes('/v1/voices'))).toEqual([]);
  expect(opened.filter((r) => !before.includes(r))).toEqual([]);

  await entry.click();
  const sheet = page.locator('[data-voice-sheet="form"]');
  await sheet.locator('[data-voice-body]').fill('홈에서 보내요');
  await sheet.locator('[data-act="voice-submit"]').click();
  await expect(page.locator('[data-voice-sheet="done"]')).toBeVisible();
  expect(api.posts).toHaveLength(1);
  expect(api.posts[0]).toMatchObject({ kind: 'other', screen: 'home', body: '홈에서 보내요' });
});
