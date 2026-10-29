import { expect, test, type Page, type WebSocketRoute } from '@playwright/test';
import { API, ok } from './helpers.js';

// T-11-573 라운지 답장 — 남의 줄 아래 '답장'으로 원문을 인용해 보내고, 인용을 누르면 원문으로 올라간다.
// 원문이 가려지면 인용은 '볼 수 없는 메시지'로 바뀐다.
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

const other = { at: 100, admin: false, tier: null, title: null, avatarId: null };

async function openChat(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route(`${API}/v1/chat/ticket`, (route) =>
    route.fulfill(
      ok({
        ticket: 'tk',
        reason: null,
        author: 'me',
        nickname: '나',
        admin: false,
        mutedUntil: null,
        blocked: [],
        reported: [],
      }),
    ),
  );
  const sent: unknown[] = [];
  let socket: WebSocketRoute | undefined;
  await page.routeWebSocket(`${API.replace('http', 'ws')}/v1/chat/ws*`, (ws) => {
    socket = ws;
    ws.onMessage((m) => {
      if (typeof m === 'string' && m.startsWith('{')) sent.push(JSON.parse(m));
    });
    ws.send(
      JSON.stringify({
        t: 'hello',
        online: 3,
        write: true,
        messages: [
          { ...other, id: 'm1', author: 'a', nickname: '럼로우', body: '오늘 컵 누가 이길까요' },
          {
            ...other,
            id: 'm2',
            author: 'b',
            nickname: '킥오프',
            body: '저는 홈팀이요',
            replyTo: 'm1',
            reply: {
              id: 'm1',
              author: 'a',
              nickname: '럼로우',
              admin: false,
              body: '오늘 컵 누가 이길까요',
            },
          },
          {
            ...other,
            id: 'm3',
            author: 'b',
            nickname: '킥오프',
            body: '옛날 얘기',
            replyTo: 'gone',
            reply: null,
          },
        ],
      }),
    );
  });
  await page.goto('/');
  await page.locator('[data-act="chat"]').click();
  await expect(page.locator('[data-chat-msg]')).toHaveCount(3);
  return { sent, emit: (e: unknown) => socket!.send(JSON.stringify(e)) };
}

test('답장을 누르면 원문을 인용해 보내고, 취소할 수 있다', async ({ page }) => {
  const { sent, emit } = await openChat(page);
  const m2 = page.locator('[data-chat-msg="m2"]');
  await expect(m2.locator('[data-act="chat-quote"]')).toContainText('럼로우');
  await expect(page.locator('[data-chat-msg="m3"] [data-chat-quote-gone]')).toHaveText(
    '볼 수 없는 메시지예요',
  );
  await page.screenshot({ path: '../../.local-dev/t-11-573/chat-reply-list.png' });

  await page.locator('[data-chat-msg="m1"] [data-act="chat-reply"]').tap();
  await expect(page.locator('[data-chat-replying]')).toContainText('럼로우 님에게 답장');
  await page.locator('[data-act="chat-reply-cancel"]').tap();
  await expect(page.locator('[data-chat-replying]')).toHaveCount(0);

  await page.locator('[data-chat-msg="m1"] [data-act="chat-reply"]').tap();
  await page.locator('[data-chat-input]').fill('저도 홈팀');
  await page.screenshot({ path: '../../.local-dev/t-11-573/chat-reply-compose.png' });
  await page.locator('[data-act="chat-send"]').tap();
  await expect.poll(() => sent.at(-1)).toEqual({ t: 'send', body: '저도 홈팀', replyTo: 'm1' });
  await expect(page.locator('[data-chat-replying]')).toHaveCount(0);

  // 원문이 가려지면 답장의 인용도 비운다.
  emit({ t: 'hide', id: 'm1' });
  await expect(page.locator('[data-chat-msg="m1"]')).toHaveCount(0);
  await expect(m2.locator('[data-chat-quote-gone]')).toBeVisible();
  await expect(page.locator('[data-chat-replying]')).toHaveCount(0);
});

test('인용을 누르면 원문으로 가서 잠깐 표시한다', async ({ page }) => {
  await openChat(page);
  await page.locator('[data-chat-msg="m2"] [data-act="chat-quote"]').tap();
  await expect(page.locator('[data-chat-msg="m1"]')).toHaveClass(/chat-flash/);
});
