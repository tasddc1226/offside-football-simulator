import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { API, fail, ok } from './helpers.js';
import { resumeFixture } from './fixtures/career-save.js';

test.beforeEach(async ({ page }) => {
  await page.route(`${API}/**`, (r) => r.fulfill(fail(503, 'SERVICE_UNAVAILABLE', 'offline')));
});

// T-11-377 선수 이름 변경권: 진행 중 선수는 이름 옆 연필로 창을 열어 변경권 1장으로 바꾼다. 로그인하지 않은 기기는
// 로그인 버튼만 보고 서버를 부르지 않는다.

test('이름 변경권: 1장 써서 진행 중 선수 이름을 바꾸고 세이브에도 남는다', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ft_session', '1'));
  const calls = { items: 0, rename: [] as unknown[] };
  await page.route(`${API}/v1/items`, (r) => {
    calls.items++;
    return r.fulfill(ok({ reroll: 0, boost: 0, scout: 0, rename: 1 }));
  });
  await page.route(`${API}/v1/careers/*/rename`, (r) => {
    calls.rename.push(r.request().postDataJSON());
    const careerId = r.request().url().split('/').at(-2)!;
    return r.fulfill(ok({ careerId, name: '새이름', rename: 0 }));
  });
  await resumeFixture(page);
  const cid = await page.evaluate(() => JSON.parse(localStorage.getItem('ft_save')!).cid);
  // The fixture skips candidate generation, so every items request belongs to this scenario.
  await page.locator('[data-act="rename-open"]').click();
  const dialog = page.getByRole('dialog', { name: '선수 이름 바꾸기' });
  await expect(dialog.locator('[data-rename-have]')).toHaveText('가진 변경권 1장');
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual(
    [],
  );

  // Reopening uses the same cached inventory, without masking duplicate requests.
  await dialog.locator('[data-act="rename-close"]').click();
  await expect(dialog).toBeHidden();
  await page.locator('[data-act="rename-open"]').click();
  await expect(dialog.locator('[data-rename-have]')).toHaveText('가진 변경권 1장');
  expect(calls.items).toBe(1);

  // 같은 이름 · 빈 이름은 보내지 않는다. 쓸 수 있는 이름 규칙은 입력칸 아래에 늘 보인다(T-11-442).
  await expect(dialog.locator('[data-rename-rule]')).toHaveText(
    '12자까지 쓸 수 있어요. 링크와 욕설, < > 기호는 쓸 수 없어요.',
  );
  await dialog.locator('[data-act="rename-next"]').click();
  await expect(dialog.getByRole('alert')).toHaveText('지금 이름과 같아요.');
  // T-11-442 변경권을 쓰기 전에 바꿀 이름을 확인받는다. '다시 고치기'는 보내지 않고 입력으로 돌아간다.
  await dialog.locator('[data-rename-input]').fill('  새이름 ');
  await dialog.locator('[data-act="rename-next"]').click();
  await expect(dialog.locator('[data-rename-confirm]')).toContainText(
    '이름을 새이름으로 바꿀까요?',
  );
  await expect(dialog.locator('[data-rename-confirm]')).toContainText('공개돼요');
  await dialog.locator('[data-act="rename-edit"]').click();
  await expect(dialog.locator('[data-rename-confirm]')).toHaveCount(0);
  expect(calls.rename).toEqual([]);
  await dialog.locator('[data-act="rename-next"]').click();
  await dialog.locator('[data-act="rename-submit"]').click();
  await expect(page.locator('#toast')).toHaveText('이름을 새이름(으)로 바꿨어요.');
  await expect(dialog).toBeHidden();
  await expect(page.locator('.player h1')).toHaveText('새이름');
  expect(calls.rename).toEqual([{ name: '새이름' }]);
  expect(calls.items).toBe(1);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('ft_save')!));
  expect(saved).toMatchObject({ cid, name: '새이름' });
});

test('이름 변경권: 변경권이 없으면 버튼이 꺼지고 출석 보상을 안내한다, 서버 거절은 그대로 보인다', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('ft_session', '1'));
  let rename = 0;
  await page.route(`${API}/v1/items`, (r) =>
    r.fulfill(ok({ reroll: 0, boost: 0, scout: 0, rename })),
  );
  await page.route(`${API}/v1/careers/*/rename`, (r) =>
    r.fulfill(fail(409, 'VALIDATION_FAILED', '쓸 수 없는 이름이에요. 다른 이름을 넣어 주세요.')),
  );
  await resumeFixture(page);
  await page.locator('[data-act="rename-open"]').click();
  const dialog = page.getByRole('dialog', { name: '선수 이름 바꾸기' });
  await expect(dialog.locator('[data-rename-none]')).toHaveText(
    '변경권이 없어요. 출석 체크 28일째에 1장을 받아요.',
  );
  await expect(dialog.locator('[data-act="rename-next"]')).toBeDisabled();
  await dialog.locator('[data-act="rename-close"]').click();

  rename = 3;
  // 조회 메모는 메모리에만 있어 다시 불러오면 새로 묻는다.
  await page.reload();
  await page.locator('[data-act="continue"]').click();
  await page.locator('[data-act="rename-open"]').click();
  await dialog.locator('[data-rename-input]').fill('바꿀이름');
  await dialog.locator('[data-act="rename-next"]').click();
  await dialog.locator('[data-act="rename-submit"]').click();
  await expect(dialog.getByRole('alert')).toHaveText(
    '쓸 수 없는 이름이에요. 다른 이름을 넣어 주세요.',
  );
});

test('이름 변경권: 로그인하지 않은 기기는 로그인 버튼만 보고 서버를 부르지 않는다', async ({
  page,
}) => {
  let calls = 0;
  await page.route(`${API}/v1/items`, (r) => (calls++, r.fulfill(ok({}))));
  await page.route(`${API}/v1/careers/*/rename`, (r) => (calls++, r.fulfill(ok({}))));
  await resumeFixture(page);
  await page.locator('[data-act="rename-open"]').click();
  const dialog = page.getByRole('dialog', { name: '선수 이름 바꾸기' });
  await expect(dialog.locator('[data-rename-sheet="guest"]')).toBeVisible();
  await expect(dialog).toContainText('로그인하면 변경권으로 선수 이름을 바꿀 수 있어요.');
  await expect(dialog.locator('[data-act="rename-google-login"]')).toBeVisible();
  expect(calls).toBe(0);
});
