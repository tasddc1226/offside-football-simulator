import { expect, test, type Page } from '@playwright/test';
import { API, ok, useChatListView } from './helpers.js';

test.beforeEach(({ page }) => useChatListView(page));

// T-11-344 채팅 사용자 창 — 프로필 사진·이름·⋯을 누르면 아래에서 올라오는 창으로 뜨고, 프로필 보기로 구단주 프로필을 연다.
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

async function openChat(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route(`${API}/v1/chat/ticket*`, (route) =>
    route.fulfill(
      ok({
        ticket: null,
        reason: 'login',
        author: 'me',
        nickname: null,
        admin: false,
        mutedUntil: null,
        blocked: [],
        reported: [],
      }),
    ),
  );
  await page.routeWebSocket(`${API.replace('http', 'ws')}/v1/chat/ws*`, (ws) => {
    ws.send(
      JSON.stringify({
        t: 'hello',
        online: 2,
        write: false,
        messages: [
          {
            id: 'm1',
            at: 100,
            author: 'other',
            nickname: '럼로우',
            body: '안녕하세요',
            admin: false,
            tier: 'B',
          },
        ],
      }),
    );
  });
  await page.goto('/');
  await page.locator('[data-act="chat"]').click();
  await expect(page.locator('[data-chat-msg]')).toHaveCount(1);
}

test('프로필 사진·이름·⋯ 모두 사용자 창을 열고, 배경·Esc·닫기로 닫힌다', async ({ page }) => {
  await openChat(page);
  const sheet = page.getByRole('dialog', { name: '럼로우 님' });
  await page.locator('[data-act="chat-who"] .owner-avatar').tap();
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('[data-report-reason]').first()).toBeVisible();
  await page.screenshot({ path: '../../.local-dev/t-11-343/chat-user-sheet.png' });
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);

  await page.locator('[data-act="chat-who"] b').tap();
  await expect(sheet).toBeVisible();
  await page.mouse.click(195, 20); // 창 위 배경
  await expect(sheet).toHaveCount(0);

  await page.locator('[data-act="chat-more"]').tap();
  await expect(sheet).toBeVisible();
  await sheet.locator('[data-act="chat-user-close"]').tap();
  await expect(sheet).toHaveCount(0);
});

/** 작성자 팀 조회(teamId)와 구단주 프로필 요청을 흉내 내고 사용자 창의 프로필 보기를 누른다. */
async function viewProfile(page: Page, teamId: string | null) {
  const opened: string[] = [];
  await page.route(`${API}/v1/chat/messages/m1/owner*`, (route) => route.fulfill(ok({ teamId })));
  await page.route(`${API}/v1/owners/by-team/*`, (route) => {
    opened.push(new URL(route.request().url()).pathname);
    return route.fulfill({ status: 404, body: '{}' });
  });
  await openChat(page);
  const sheet = page.getByRole('dialog', { name: '럼로우 님' });
  await page.locator('[data-act="chat-who"]').tap();
  await sheet.locator('[data-act="chat-profile"]').tap();
  return { sheet, opened };
}

test('프로필 보기는 작성자의 최근 팀으로 구단주 프로필을 연다', async ({ page }) => {
  const { sheet, opened } = await viewProfile(page, 'team_s2');
  await expect(sheet).toHaveCount(0);
  await expect.poll(() => opened).toEqual(['/v1/owners/by-team/team_s2']);
});

test('팀이 없는 구단주면 창을 그대로 두고 알린다', async ({ page }) => {
  const { sheet, opened } = await viewProfile(page, null);
  await expect(page.getByText('아직 구단을 만들지 않은 구단주예요.')).toBeVisible();
  await expect(sheet).toBeVisible();
  expect(opened).toEqual([]);
});
