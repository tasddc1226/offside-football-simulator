import { expect, test, type CDPSession, type Page } from '@playwright/test';
import { API, ok } from './helpers.js';

// T-11-612 폰에서 조이스틱을 잡은 채 다른 손가락으로 버튼을 누른다. 실제 멀티터치를 보내려고 CDP로 터치를 넣는다.
// CDP는 touchEnd에 손가락을 지정할 수 없어, 한 손가락만 뗄 때는 남은 손가락만 담은 touchMove를 보낸다.
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

type Point = { x: number; y: number; id: number };

const touch = (
  cdp: CDPSession,
  type: 'touchStart' | 'touchMove' | 'touchEnd',
  touchPoints: Point[],
) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });

async function openField(page: Page) {
  await page.route(`${API}/v1/profile`, (route) =>
    route.fulfill(
      ok({
        id: 'field-player',
        linked: { google: true },
        nickname: '테스터',
        googleEmailMasked: 't***@example.com',
        recoveryCodeIssuedAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
    ),
  );
  await page.route(`${API}/v1/chat/ticket*`, (route) =>
    route.fulfill(
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
    ),
  );
  await page.routeWebSocket(`${API.replace('http', 'ws')}/v1/chat/ws*`, (ws) => {
    ws.onMessage(() => {});
    ws.send(JSON.stringify({ t: 'hello', online: 2, write: true, messages: [] }));
  });
  await page.goto('/');
  await page.locator('[data-act="chat"]').click();
  await page.locator('[data-chat-view="field"]').click();
  await expect(page.locator('[data-lounge-field]')).toBeVisible();
  await expect(page.locator('[data-act="field-emote"]')).toBeVisible();
}

test('조이스틱을 잡은 채 버튼이 눌리고, 필드에 닿은 다른 손가락은 받침을 옮기지 않는다', async ({
  page,
}) => {
  await openField(page);
  const cdp = await page.context().newCDPSession(page);
  const canvas = (await page.locator('[data-lounge-field] > canvas').boundingBox())!;
  const emote = (await page.locator('[data-act="field-emote"]').boundingBox())!;

  // 선수가 없는 왼쪽 위 구석을 잡는다.
  const stick = { x: canvas.x + 70, y: canvas.y + 90, id: 1 };
  await touch(cdp, 'touchStart', [stick]);
  const base = page.locator('.field-stick:not(.idle)');
  await expect(base).toBeVisible();
  const left = await base.evaluate((el) => (el as HTMLElement).style.left);

  // 둘째 손가락으로 버튼을 누른다.
  const button = { x: emote.x + emote.width / 2, y: emote.y + emote.height / 2, id: 2 };
  await touch(cdp, 'touchStart', [stick, button]);
  await touch(cdp, 'touchMove', [stick]);
  await expect(page.locator('[data-emote]').first()).toBeVisible();
  await expect(base).toBeVisible();

  // 필드에 닿은 둘째 손가락은 받침을 옮기지 않는다.
  const other = { x: canvas.x + canvas.width - 90, y: canvas.y + 200, id: 3 };
  await touch(cdp, 'touchStart', [stick, other]);
  await touch(cdp, 'touchMove', [stick]);
  await expect.poll(() => base.evaluate((el) => (el as HTMLElement).style.left)).toBe(left);

  await touch(cdp, 'touchEnd', []);
  await expect(base).toHaveCount(0);
});
