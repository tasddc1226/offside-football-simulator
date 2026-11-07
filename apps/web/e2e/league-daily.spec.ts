import { expect, test } from '@playwright/test';
import { mockDaily } from './leagueDailyMock.js';

// T-11-652 오프사이드 데일리: 끝난 라운드 신문 · 빅매치 예측 · 경기 기사 · 라운지 공유 · 라이벌 · 더비.
test('리그 화면 신문 → 예측 → 기사 읽기 · 공유, 신문은 한 번만 부른다', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-07T13:00:00.000Z'));
  const { hits, puts } = await mockDaily(page);
  await page.goto('/');
  await page.locator('[data-league-banner]').click();

  const daily = page.locator('[data-league-daily="3"]');
  await expect(daily).toContainText('3라운드 소식');
  await expect(daily.locator('[data-league-news]')).toHaveCount(6);
  await expect(daily.locator('[data-league-news="upset"] h3')).toHaveText(
    '숲속 FC, OVR 7 차를 뒤집다',
  );
  await expect(daily.locator('[data-league-news="derby"] h3')).toHaveText('3위와 4위의 맞대결');
  await expect(daily.locator('[data-league-pred-record]')).toHaveText('내 적중 2/3');
  await expect(daily.locator('[data-league-pred-split]')).toHaveText(
    '80명 예측 · 홈 51% · 무 15% · 원정 34%',
  );

  // 빅매치 예측: 고르면 저장하고 내 예측을 보인다.
  await daily.locator('[data-act="league-pick"][data-pick="away"]').click();
  await expect(daily.locator('[data-league-my-pick="away"]')).toHaveText('내 예측: 원정 승');
  expect(puts).toEqual(['away']);

  // 라이벌(바로 위 · 아래 팀 중 승점 차가 작은 팀)과 다음 라운드 더비.
  await expect(page.locator('[data-league-rival]')).toContainText('라이벌 한강 유나이티드');
  await expect(page.locator('[data-league-rival-tag]')).toHaveCount(1);

  // 기사 읽기 → 경기 상세 기사(중계를 건너뛰면 기사가 보인다).
  await daily.locator('[data-league-news="upset"] [data-act="league-news-open"]').click();
  await expect(page.locator('[data-act="league-detail-back"]')).toBeVisible();
  await page.locator('[data-act="league-detail-back"]').click();
  await daily.locator('[data-league-news="upset"] [data-act="league-news-open"]').click();
  const article = page.locator('[data-league-article]');
  await expect(article.locator('h2')).toHaveText('숲속 FC, 밀리고도 이겼다');
  await expect(article).toContainText('0.7이었지만 2:0 승리는 숲속 FC의 몫이었습니다.');
  await expect(article).toContainText('정우진이 두 골을 넣었습니다.');
  await page.locator('[data-act="league-article-share"]').click();
  await expect.poll(() => hits['POST /v1/chat/share']).toBe(1);

  expect(hits['GET /v1/leagues/2/news/3']).toBe(1);
  expect(hits['GET /v1/leagues/2/predictions/me']).toBe(1);
});
