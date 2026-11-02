import { test, expect } from '@playwright/test';
import { retireFromMarket } from './helpers.js';

// T-11-611 은퇴 리포트 끝의 앱 안내. 은퇴 직후엔 옮길 커리어가 없어 다음 선수를 앱에서 시작하도록 권한다.
test.describe('은퇴 화면 앱 안내', () => {
  test.use({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  });

  test('은퇴하면 다음 선수를 앱에서 키우도록 안내하고, 닫으면 7일 숨긴다', async ({ page }) => {
    await retireFromMarket(page);
    const card = page.locator('[data-app-conversion="retire"]');
    await expect(card).toBeVisible();
    await expect(card.getByText('다음 선수는 앱에서 키워요')).toBeVisible();
    await expect(card.locator('[data-act="app-store"]')).toHaveAttribute(
      'href',
      /apps\.apple\.com/,
    );
    // 옮길 커리어가 없으니 커리어 옮기기 안내는 뺀다.
    await expect(card.locator('.transfer')).toHaveCount(0);
    // 첫 은퇴에는 내 구단으로 가는 길도 함께 보여 준다.
    await expect(page.locator('[data-act="my-club"]')).toHaveText('내 구단 만들기');
    await card.getByRole('button', { name: '앱 안내 7일간 닫기' }).click();
    await expect(card).toHaveCount(0);
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('ft_app_conversion_dismissed_until')))
      .not.toBeNull();
  });
});
