import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { API, fail } from './helpers.js';
import { resumeFixture } from './fixtures/career-save.js';

// T-11-804 첫 시즌 선수 정보 고치기: 첫 시즌 결산 전에는 선수 탭 '고치기'와 이름 옆 연필에서 이름 · 주발 · 체격을 무료로
// 고친다. 서버를 부르지 않고(첫 시즌 업로드가 고친 값으로 처음 들어간다), 결산을 넘긴 선수는 지금처럼 변경권 창을 연다.

test('첫 시즌 선수 정보 고치기: 후보 화면에 주발 · 체격을 보이고, 선수 탭에서 서버 없이 고친다', async ({
  page,
}) => {
  const calls: string[] = [];
  await page.route(`${API}/**`, (r) => {
    calls.push(new URL(r.request().url()).pathname);
    return r.fulfill(fail(503, 'SERVICE_UNAVAILABLE', 'offline'));
  });
  await page.goto('/');
  await page.getByRole('button', { name: /새 커리어 킥오프/ }).click();
  await page.locator('[data-act="next-candidates"]').click();
  // '기본값으로 후보 보기'로 와도 주발 · 체격을 보고 시작한다.
  const candBody = page.locator('[data-cand-body]');
  await expect(candBody).toContainText('주발 · 체격');
  await expect(candBody).toContainText(/오른발 · \d{3}cm\/\d{2,3}kg/);
  await expect(candBody).toContainText('첫 시즌 동안 선수 탭에서 고칠 수 있어요.');
  await page.locator('[data-cand="0"]').click();
  await page.locator('[data-act="start"]').click();
  await expect(page.locator('.player h1')).toBeVisible();

  // 첫 시즌에는 이름 옆 연필이 변경권 창이 아니라 무료 고치기 창을 연다.
  await expect(page.locator('[data-act="rename-open"]')).toHaveCount(0);
  await page.locator('[data-tab="player"]').click();
  const entry = page.locator('[data-player-edit-entry]');
  await expect(entry).toContainText(
    '첫 시즌 결산 전까지 이름 · 주발 · 체격을 무료로 고칠 수 있어요.',
  );
  const before = calls.length;

  await entry.locator('[data-act="player-edit-open"]').click();
  const dialog = page.getByRole('dialog', { name: '선수 정보 고치기' });
  await expect(dialog.locator('[data-pe-foot-note]')).toHaveText(
    '주발은 선수 경기 결과에 영향이 없어요. 구단 경기에서 선수 카드를 풀백 · 윙어 자리에 세울 때만 쓰여요.',
  );

  // 그대로 저장하면 바뀐 게 없다고 알린다.
  await dialog.locator('[data-act="player-edit-save"]').click();
  await expect(dialog.getByRole('alert')).toHaveText('바뀐 내용이 없어요.');
  // 창이 다 올라온 뒤(배경 전환이 끝난 뒤) 접근성을 본다.
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual(
    [],
  );
  // 범위 밖 체격은 막는다.
  await dialog.locator('[data-pe-height]').fill('150');
  await expect(dialog.locator('[data-pe-body-note]')).toHaveText(
    '키는 160~200cm 사이로 넣어 주세요.',
  );
  // 키를 키우면 헤딩이 오르는 미리보기와 OVR 그대로 안내가 보인다.
  await dialog.locator('[data-pe-height]').fill('195');
  await dialog.locator('[data-pe-weight]').fill('88');
  await expect(dialog.locator('[data-pe-preview]')).toContainText('헤딩');
  // 기본 역할이 하나인 선수는 'OVR은 그대로예요', 타깃맨처럼 두 역할 중 높은 쪽으로 재는 선수는 바뀌는 OVR을 보인다.
  await expect(dialog.locator('[data-pe-body-note]')).toHaveText(/^OVR/);
  await dialog.locator('[data-pe-name]').fill('  고친이름 ');
  await dialog.locator('[data-pe-foot="왼발"]').click();
  await dialog.locator('[data-act="player-edit-save"]').click();
  await expect(page.locator('#toast')).toHaveText('선수 정보를 고쳤어요.');
  await expect(dialog).toBeHidden();
  await expect(page.locator('.player h1')).toHaveText('고친이름');
  await expect(page.locator('[data-body]')).toHaveText('195cm · 88kg');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('ft_save')!));
  expect(saved).toMatchObject({
    name: '고친이름',
    foot: '왼발',
    body: { h: 195, w: 88 },
    career: [],
  });

  // 이름 옆 연필도 같은 창을 연다.
  await page.locator('[data-act="player-edit-name"]').click();
  await expect(dialog.locator('[data-pe-name]')).toHaveValue('고친이름');
  await dialog.locator('[data-act="player-edit-close"]').click();
  await expect(dialog).toBeHidden();

  // 탭을 오가고 창을 다시 열어도 서버를 부르지 않는다.
  for (let i = 0; i < 3; i++) {
    await page.locator('[data-tab="season"]').click();
    await page.locator('[data-tab="player"]').click();
    await entry.locator('[data-act="player-edit-open"]').click();
    await dialog.locator('[data-act="player-edit-close"]').click();
  }
  // 라운지 채팅 연결(배경에서 다시 붙는 요청)은 이 화면과 무관해 뺀다.
  expect(calls.slice(before).filter((p) => !p.startsWith('/v1/chat/'))).toEqual([]);

  // 새로고침해도 고친 값이 남는다.
  await page.reload();
  await page.locator('[data-act="continue"]').click();
  await expect(page.locator('.player h1')).toHaveText('고친이름');
});

test('첫 시즌 결산을 넘긴 선수는 고치기가 없고 연필이 변경권 창을 연다', async ({ page }) => {
  await page.route(`${API}/**`, (r) => r.fulfill(fail(503, 'SERVICE_UNAVAILABLE', 'offline')));
  await resumeFixture(page);
  await expect(page.locator('[data-act="player-edit-name"]')).toHaveCount(0);
  await page.locator('[data-tab="player"]').click();
  await expect(page.locator('[data-player-edit-entry]')).toHaveCount(0);
  await page.locator('[data-act="rename-open"]').click();
  await expect(page.getByRole('dialog', { name: '선수 이름 바꾸기' })).toBeVisible();
});
