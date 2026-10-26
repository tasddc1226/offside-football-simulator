// T-11-431 되돌릴 수 없는 동작의 확인 단계.
import { expect, test } from '@playwright/test';
import { resumeWithSave, startCareer } from './helpers.js';

const saved = (page: import('@playwright/test').Page) =>
  page.evaluate(() => localStorage.getItem('ft_save'));

test('새 커리어를 확인해도 킥오프 전에는 기존 세이브가 남고, 만들기를 취소하면 이어할 수 있다', async ({
  page,
}) => {
  await startCareer(page);
  const before = await saved(page);
  const name = JSON.parse(before!).name as string;
  await page.goto('/');
  await page.locator('.hero-home [data-act="new"]').click();
  await expect(page.locator('#sheet')).toContainText('새로 시작할까요?');
  await page.locator('#sheet [data-sheet="0"]').click();
  await expect(page.locator('[data-act="next-candidates"]')).toBeVisible();
  expect(await saved(page)).toBe(before);

  // 만들기 화면에서 새로고침해도 세이브는 그대로다.
  await page.reload();
  await expect(page.locator('[data-act="continue"]')).toBeVisible();
  expect(await saved(page)).toBe(before);

  // 만들기를 취소하면 홈에서 같은 선수로 이어한다.
  await page.locator('.hero-home [data-act="new"]').click();
  await page.locator('#sheet [data-sheet="0"]').click();
  await page.locator('[data-act="home"]').click();
  await page.locator('[data-act="continue"]').click();
  await expect(page.locator('.player h1')).toContainText(name);
  expect(await saved(page)).toBe(before);
});

test('대학 진학은 확인 시트를 거치고, 다시 고르면 저장을 바꾸지 않는다', async ({ page }) => {
  await resumeWithSave(page, {
    pending: {
      type: 'market',
      res: null,
      m: {
        options: [
          { kind: 'stay', name: '잔류', desc: '' },
          { kind: 'uni', name: '대학 진학', desc: '' },
        ],
        note: '',
        canRetire: false,
      },
    },
  });
  const sheet = page.locator('#sheet');
  const before = await saved(page);
  await sheet.locator('[data-opt="1"]').click();
  await expect(sheet).toContainText('대학에 진학할까요?');
  await expect(sheet).toContainText('되돌릴 수 없어요');
  await sheet.getByRole('button', { name: '다시 고르기' }).click();
  await expect(sheet.locator('[data-opt]')).toHaveCount(2);
  expect(await saved(page)).toBe(before);

  await sheet.locator('[data-opt="1"]').click();
  await sheet.getByRole('button', { name: '대학 진학' }).click();
  await expect(sheet).toBeHidden();
  expect(JSON.parse((await saved(page))!).leagueId).toBe('uni');
});
