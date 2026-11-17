import { test, expect } from '@playwright/test';

// /guide, /faq, /legal/* 는 크롤러·noscript 사용자를 위한 정적 HTML이며, 앱 번들 스크립트를
// 포함하지 않으므로 실제 브라우저에서 JS가 켜져 있어도 SPA가 이 콘텐츠를 덮어쓰지 않는다.
const pages: Array<{ path: string; heading: RegExp }> = [
  { path: '/guide/', heading: /가이드/ },
  { path: '/faq/', heading: /자주 묻는 질문/ },
  { path: '/fairness/', heading: /확률과 공정성/ },
  { path: '/legal/terms/', heading: /이용약관/ },
  { path: '/legal/privacy/', heading: /개인정보/ },
];

for (const { path, heading } of pages) {
  test(`${path} 정적 페이지가 렌더링된다`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.ok()).toBeTruthy();
    await expect(page.locator('h1')).toHaveText(heading);
  });
}

// 유료 광고로 처음 온 방문은 브라우저 언어의 소개 페이지로 가고, 소개 페이지의 '웹에서 하기'로 돌아오면 게임 홈에 남는다.
test.describe('광고 첫 방문 소개 페이지', () => {
  test.use({ locale: 'ja-JP' });
  const ad = '/?utm_source=meta&utm_medium=paid&utm_campaign=global_test&utm_content=jp_reels';

  test('일본어 브라우저는 /ja/app/으로 가고 다시 오면 게임 홈에 남는다', async ({ page }) => {
    await page.goto(ad);
    await expect(page).toHaveURL(/\/ja\/app\/\?utm_source=meta&utm_medium=paid/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
    await expect(page.locator('h1')).toContainText('18歳');
    await page.goto(ad);
    await expect(page).toHaveURL(/^[^?]*\/\?utm_source=meta/);
  });

  test('세이브가 있으면 보내지 않는다', async ({ page }) => {
    await page.goto('/guide/');
    await page.evaluate(() => localStorage.setItem('ft_save', '{}'));
    await page.goto(ad);
    await expect(page).toHaveURL(/^[^?]*\/\?utm_source=meta/);
  });

  test('광고가 아닌 유입은 보내지 않는다', async ({ page }) => {
    await page.goto('/?utm_source=x&utm_medium=social&utm_campaign=x_jp');
    await expect(page).toHaveURL(/^[^?]*\/\?utm_source=x/);
  });
});
