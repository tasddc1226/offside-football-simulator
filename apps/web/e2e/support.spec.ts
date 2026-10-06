import { test, expect } from '@playwright/test';

// 메인 하단에서만 자발적 후원 계좌를 안내한다.
test('메인 하단에서 후원 계좌를 복사하고 설정에는 중복 노출하지 않는다', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await expect(page.locator('[data-home-support]')).toContainText('개발자를 위해서 응원해 주세요');
  // T-11-130 계좌번호는 카드에 적지 않는다(복사 버튼만).
  await expect(page.locator('[data-home-support]')).not.toContainText('1000-1599-4723');
  await page.locator('[data-act="coffee"]').click();
  await expect(page.locator('#toast')).toContainText('계좌번호를 복사했어요');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    '토스뱅크 1000-1599-4723 양*영',
  );
  await page.locator('[data-act="settings"]').click();
  await expect(page.locator('[data-act="coffee"]')).toHaveCount(0);
});

test('후원 계좌 복사가 거부되면 알림에 계좌번호를 보인다', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error('clipboard denied');
        },
      },
    });
    document.execCommand = () => false;
  });
  await page.locator('[data-act="coffee"]').click();
  await expect(page.locator('#toast')).toContainText('복사하지 못했어요. 토스뱅크 1000-1599-4723 양*영');
  await page.locator('[data-act="settings"]').click();
  await page.locator('[data-act="home"]').click();
  await expect(page.locator('[data-act="coffee"]')).toHaveCount(1);
});
