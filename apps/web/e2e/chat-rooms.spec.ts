import { expect, test, type Page } from '@playwright/test';
import { API, ok } from './helpers.js';

// T-11-583 언어별 채팅방: 화면 언어 방으로 들어가고, 다른 방을 고르면 그 방 입장권 · 소켓으로 다시 붙는다.
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

async function mockChat(page: Page) {
  const tickets: string[] = [];
  const sockets: string[] = [];
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route(`${API}/v1/profile`, (route) =>
    route.fulfill(
      ok({
        id: 'room-reader',
        linked: { google: true },
        nickname: '테스터',
        googleEmailMasked: 't***@example.com',
        recoveryCodeIssuedAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
    ),
  );
  await page.route(`${API}/v1/chat/ticket*`, (route) => {
    tickets.push(new URL(route.request().url()).searchParams.get('room') ?? '');
    return route.fulfill(
      ok({
        ticket: 'test',
        reason: null,
        author: 'me',
        nickname: '테스터',
        admin: false,
        mutedUntil: null,
        blocked: [],
        reported: [],
      }),
    );
  });
  await page.routeWebSocket(`${API.replace('http', 'ws')}/v1/chat/ws*`, (ws) => {
    const room = new URL(ws.url()).searchParams.get('room') ?? '';
    sockets.push(room);
    ws.send(
      JSON.stringify({
        t: 'hello',
        online: room === 'ko' ? 12 : 3,
        write: true,
        messages: [
          {
            id: `${room}-1`,
            at: 100,
            author: 'other',
            nickname: room === 'ko' ? '다른 구단주' : 'Owner',
            body: room === 'ko' ? '한국어 방 메시지' : `${room} room message`,
            admin: false,
          },
        ],
      }),
    );
  });
  return { tickets, sockets };
}

test('한국어 화면은 한국어 방으로 들어가고, English를 누르면 영어 방에 다시 붙고 다음에도 그 방으로 들어간다', async ({
  page,
}) => {
  const { tickets, sockets } = await mockChat(page);
  await page.goto('/');
  await page.locator('[data-act="chat"]').click();
  await expect(page.locator('[data-chat-msg]')).toHaveText([/한국어 방 메시지/]);
  await expect(page.locator('[data-chat-room="ko"]')).toHaveAttribute('aria-pressed', 'true');

  await page.locator('[data-act="chat-lang"]').click();
  await page.locator('[data-chat-room="en"]').click();
  await expect(page.locator('[data-chat-msg]')).toHaveText([/en room message/]);
  await expect(page.locator('[data-chat-room="en"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-chat-room="ko"]')).toHaveAttribute('aria-pressed', 'false');
  expect(tickets).toEqual(['ko', 'en']);
  expect(sockets).toEqual(['ko', 'en']);

  // 같은 방을 다시 눌러도 다시 붙지 않는다.
  await page.locator('[data-act="chat-lang"]').click();
  await page.locator('[data-chat-room="en"]').click();
  expect(tickets).toEqual(['ko', 'en']);

  await page.reload();
  await page.locator('[data-act="chat"]').click();
  await expect(page.locator('[data-chat-msg]')).toHaveText([/en room message/]);
  expect(tickets.at(-1)).toBe('en');
});
