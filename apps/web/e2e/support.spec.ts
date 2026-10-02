import { test, expect } from '@playwright/test';

// T-11-051 설정 맨 아래 '커피 한잔 사주기'는 후원 계좌를 클립보드에 복사한다.
test('설정의 커피 한잔 사주기를 누르면 후원 계좌가 복사된다', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await page.locator('[data-act="settings"]').click();
  await page.locator('[data-act="coffee"]').click();
  await expect(page.locator('#toast')).toContainText('계좌번호를 복사했어요');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    '토스뱅크 1000-1599-4723 양*영',
  );
});
