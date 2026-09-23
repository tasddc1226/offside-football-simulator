import { test, expect } from '@playwright/test';

// /guide, /faq, /legal/* 는 크롤러·noscript 사용자를 위한 정적 HTML이다 — 실제 브라우저에서 JS가
// 실행되면 main.ts의 SPA 렌더링이 #app 내용을 즉시 홈 화면으로 덮어쓴다(원본 React 앱과 동일한
// 의도된 동작). 그래서 이 테스트는 JS를 끈 컨텍스트로 "크롤러가 보는 그대로"의 정적 콘텐츠를
// 검증한다.
const pages: Array<{ path: string; heading: RegExp }> = [
  { path: '/guide/', heading: /가이드/ },
  { path: '/faq/', heading: /자주 묻는 질문/ },
  { path: '/legal/terms/', heading: /이용약관/ },
  { path: '/legal/privacy/', heading: /개인정보/ },
];

test.use({ javaScriptEnabled: false });

for (const { path, heading } of pages) {
  test(`${path} 정적 페이지가 렌더링된다`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.ok()).toBeTruthy();
    await expect(page.locator('h1')).toHaveText(heading);
  });
}
