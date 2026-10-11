import { expect, test, type Page } from '@playwright/test';
import { API, ok } from './helpers.js';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

async function openChat(page: Page, nickname = true, allOther = false) {
  const sent: string[] = [];
  let incoming: (event: unknown) => void = () => {};
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route(`${API}/v1/profile`, (route) =>
    route.fulfill(
      ok({
        id: 'mobile-reader',
        linked: { google: true },
        nickname: nickname ? '테스터' : null,
        googleEmailMasked: 't***@example.com',
        recoveryCodeIssuedAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
    ),
  );
  await page.route(`${API}/v1/chat/ticket`, (route) =>
    route.fulfill(
      ok({
        ticket: nickname ? 'test' : null,
        reason: nickname ? null : 'nickname',
        author: 'me',
        nickname: nickname ? '테스터' : null,
        admin: false,
        mutedUntil: null,
        blocked: [],
        reported: [],
      }),
    ),
  );
  await page.routeWebSocket(`${API.replace('http', 'ws')}/v1/chat/ws*`, (ws) => {
    incoming = (event) => ws.send(JSON.stringify(event));
    ws.onMessage((message) => sent.push(String(message)));
    ws.send(
      JSON.stringify({
        t: 'hello',
        online: 2,
        write: nickname,
        messages: Array.from({ length: 30 }, (_, i) => ({
          id: String(i),
          at: 100 + i,
          author: !allOther && i % 2 ? 'me' : 'other',
          nickname: i % 2 ? '테스터' : '다른 구단주',
          body: `모바일 채팅 메시지 ${i}`,
          admin: false,
        })),
      }),
    );
  });
  await page.goto('/');
  await page.locator('[data-act="chat"]').click();
  await expect(page.locator('[data-chat-msg]')).toHaveCount(30);
  return { sent, incoming };
}

async function shrinkForKeyboard(page: Page) {
  await page.evaluate(() => {
    const viewport = window.visualViewport!;
    Object.defineProperty(viewport, 'height', { configurable: true, value: 280 });
    Object.defineProperty(viewport, 'offsetTop', { configurable: true, value: 40 });
    viewport.dispatchEvent(new Event('resize'));
  });
}

test('닉네임 입력도 키보드 위에 보인다', async ({ page }) => {
  await openChat(page, false);
  const input = page.locator('[data-chat-gate="nickname"] input');
  await input.fill('모바일테스터');
  await shrinkForKeyboard(page);
  await expect
    .poll(async () => {
      const rect = await input.boundingBox();
      return !!rect && rect.y >= 40 && rect.y + rect.height <= 320;
    })
    .toBe(true);
});

test('말풍선 방향과 여러 줄 입력을 유지하고 입력창·보내기가 키보드 위에 보인다', async ({
  page,
}) => {
  const { sent } = await openChat(page);
  await page.screenshot({ path: '../../.local-dev/season-feedback-validation/chat-mobile.png' });
  const input = page.locator('[data-chat-input]');
  await input.fill('첫째 줄');
  await shrinkForKeyboard(page);
  await input.fill('첫째 줄\n둘째 줄\n셋째 줄');
  for (const control of [input, page.locator('[data-act="chat-send"]')]) {
    await expect
      .poll(async () => {
        const rect = await control.boundingBox();
        return !!rect && rect.y >= 40 && rect.y + rect.height <= 320;
      })
      .toBe(true);
  }
  await expect(input).toHaveValue('첫째 줄\n둘째 줄\n셋째 줄');
  const own = await page.locator('[data-chat-msg="29"]').boundingBox();
  const other = await page.locator('[data-chat-msg="28"]').boundingBox();
  expect(own!.x).toBeGreaterThan(other!.x);
  const list = await page.locator('[data-chat-list]').boundingBox();
  expect(own!.y + own!.height).toBeLessThanOrEqual(list!.y + list!.height + 1);
  await page.screenshot({
    path: '../../.local-dev/season-feedback-validation/chat-mobile-keyboard.png',
  });
  await page.locator('[data-act="chat-send"]').tap();
  await expect
    .poll(() => sent.map((m) => JSON.parse(m)).filter((m) => m.t === 'send'))
    .toEqual([{ t: 'send', body: '첫째 줄\n둘째 줄\n셋째 줄' }]);
  await expect(input).toHaveValue('');
  await expect(input).toBeFocused();
});

test('입장·재입장은 최신 메시지를 보여 주고 과거 글을 읽는 중에는 위치를 유지한다', async ({
  page,
}) => {
  const { incoming } = await openChat(page, true, true);
  const list = page.locator('[data-chat-list]');
  const bottom = () => list.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight);
  await expect.poll(bottom).toBeLessThanOrEqual(1);
  await list.evaluate((el) => {
    el.scrollTop = 0;
  });
  await expect.poll(() => list.evaluate((el) => el.scrollTop)).toBe(0);
  incoming({
    t: 'msg',
    m: {
      id: 'latest',
      at: 200,
      author: 'other',
      nickname: '다른 구단주',
      body: '가장 최근 채팅',
      admin: false,
    },
  });
  await expect(page.locator('[data-chat-msg]')).toHaveCount(31);
  await expect.poll(() => list.evaluate((el) => el.scrollTop)).toBe(0);
  await page.getByRole('button', { name: '← 이전으로' }).click();
  await page.locator('[data-act="chat"]').click();
  await expect.poll(bottom).toBeLessThanOrEqual(1);
  const latest = await page.locator('[data-chat-msg="latest"]').boundingBox();
  const viewport = await list.boundingBox();
  expect(latest!.y).toBeGreaterThanOrEqual(viewport!.y);
  expect(latest!.y + latest!.height).toBeLessThanOrEqual(viewport!.y + viewport!.height + 1);
});

test('profile images appear on existing chat messages and restore to initials', async ({
  page,
}) => {
  const avatarId = '11111111-1111-4111-8111-111111111111';
  await page.route(`${API}/v1/avatars/*`, (r) =>
    r.fulfill({ path: 'public/brand/offside-icon-v7-64.png' }),
  );
  const { incoming } = await openChat(page);
  incoming({ t: 'avatar', author: 'me', avatarId });
  const avatar = page.locator('[data-chat-msg="29"] .owner-avatar img');
  await expect(avatar).toHaveAttribute('src', `${API}/v1/avatars/${avatarId}`);
  await expect(avatar).toBeVisible();
  incoming({ t: 'avatar', author: 'me', avatarId: null });
  await expect(avatar).toHaveCount(0);
});
