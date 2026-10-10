import { expect, test } from '@playwright/test';
import { API, ok } from './helpers.js';

test('새 채팅 수를 표시하고 읽으면 지우며 화면 이동에는 연결을 재사용한다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let tickets = 0;
  await page.route(`${API}/v1/profile`, (route) =>
    route.fulfill(
      ok({
        id: 'local-reader',
        linked: { google: true },
        nickname: '테스터',
        googleEmailMasked: 't***@example.com',
        recoveryCodeIssuedAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
    ),
  );
  await page.route(`${API}/v1/chat/ticket`, (route) => {
    tickets++;
    return route.fulfill(
      ok({
        ticket: 'test',
        reason: null,
        author: 'me',
        nickname: '테스터',
        admin: false,
        mutedUntil: null,
        blocked: ['blocked'],
        reported: [],
      }),
    );
  });
  const message = (id: string, author = 'other') => ({
    id,
    author,
    at: 100 + Number(id),
    nickname: '다른 구단주',
    body: `메시지 ${id}`,
    admin: false,
  });
  const history = [message('0')];
  let send: (event: unknown) => void = () => {};
  let sockets = 0;
  await page.routeWebSocket(`${API.replace('http', 'ws')}/v1/chat/ws*`, (ws) => {
    sockets++;
    send = (event) => ws.send(JSON.stringify(event));
    ws.send(JSON.stringify({ t: 'hello', messages: history, online: 2, write: true }));
  });
  await page.goto('/');
  await expect.poll(() => sockets).toBe(1);
  const badge = page.locator('[data-chat-unread]');
  await expect(badge).toHaveCount(0);
  send({ t: 'msg', m: message('1', 'me') });
  send({ t: 'msg', m: message('2', 'blocked') });
  send({ t: 'msg', m: message('3') });
  await expect(badge).toHaveText('1');
  await expect(page.locator('[data-act="chat"]')).toHaveAccessibleName(
    '채팅, 읽지 않은 메시지 1개',
  );
  await page.locator('[data-act="chat"]').click();
  await expect(page.locator('[data-chat-list]')).toContainText('메시지 3');
  await expect(page.locator('[data-chat-list]')).not.toContainText('메시지 2');
  await page.getByRole('button', { name: '← 이전으로' }).click();
  await expect(badge).toHaveCount(0);
  expect(sockets).toBe(1);
  expect(tickets).toBe(1);
  history.push(message('3'), message('4'));
  send({ t: 'msg', m: message('4') });
  await expect(badge).toHaveText('1');
  await page.reload();
  await expect.poll(() => sockets).toBe(2);
  await expect(badge).toHaveText('1');
  send({ t: 'hide', id: '4' });
  await expect(badge).toHaveCount(0);
});

test('닉네임 변경·로그아웃 후 이전 계정의 채팅 연결을 재사용하지 않는다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let loggedIn = true;
  let nickname = '테스터';
  let tickets = 0;
  const profile = () => ({
    id: 'local-reader',
    linked: { google: loggedIn },
    nickname,
    googleEmailMasked: loggedIn ? 't***@example.com' : null,
    recoveryCodeIssuedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  });
  await page.route(`${API}/v1/profile`, (route) => route.fulfill(ok(profile())));
  await page.route(`${API}/v1/profile/nickname`, (route) => {
    nickname = route.request().postDataJSON().nickname;
    return route.fulfill(ok(profile()));
  });
  await page.route(`${API}/v1/auth/logout`, (route) => {
    loggedIn = false;
    return route.fulfill({ status: 204 });
  });
  await page.route(`${API}/v1/chat/ticket`, (route) => {
    tickets++;
    return route.fulfill(
      ok({
        ticket: loggedIn ? 'test' : null,
        reason: loggedIn ? null : 'login',
        author: loggedIn ? 'me' : null,
        nickname: loggedIn ? nickname : null,
        admin: false,
        mutedUntil: null,
        blocked: [],
        reported: [],
      }),
    );
  });
  await page.routeWebSocket(`${API.replace('http', 'ws')}/v1/chat/ws*`, (ws) => {
    ws.send(JSON.stringify({ t: 'hello', messages: [], online: 1, write: loggedIn }));
  });
  await page.goto('/');
  await expect.poll(() => tickets).toBe(1);
  await page.locator('[data-act="owner"]').click();
  const account = page.locator('#account-slot');
  const editor = page.locator('[data-owner-profile-editor]');
  await editor.locator('summary').click();
  await editor.getByRole('textbox', { name: '구단주 이름' }).fill('새닉네임');
  await editor.locator('[data-act="save-nickname"]').click();
  await expect.poll(() => tickets).toBe(2);
  await account.locator('[data-act="logout"]').click();
  await page.locator('#sheet [data-sheet="0"]').click();
  await expect(account).toContainText('로그인하지 않았어요');
  await expect.poll(() => tickets).toBe(3);
  await page.locator('[data-act="home"]').click();
  await page.locator('[data-act="chat"]').click();
  await expect(page.locator('[data-chat-gate="login"]')).toBeVisible();
  await expect(page.locator('[data-chat-input]')).toHaveCount(0);
  expect(tickets).toBe(3);
});
