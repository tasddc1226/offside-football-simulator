import { test, expect } from '@playwright/test';

// /guide, /faq, /legal/* 는 크롤러·noscript 사용자를 위한 정적 HTML이며, 앱 번들 스크립트를
// 포함하지 않으므로 실제 브라우저에서 JS가 켜져 있어도 SPA가 이 콘텐츠를 덮어쓰지 않는다.
const pages: Array<{ path: string; heading: RegExp }> = [
  { path: '/guide/', heading: /가이드/ },
  { path: '/faq/', heading: /자주 묻는 질문/ },
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
