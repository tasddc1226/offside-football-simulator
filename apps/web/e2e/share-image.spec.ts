import { test, expect } from '@playwright/test';
import { API, ok, PRESEASON } from './helpers.js';

// 프리시즌 기록으로 꾸민 화면이라 시계를 시즌 1 개막 전으로 고정한다(테스트가 직접 시각을 정하면 그쪽이 이긴다).
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(PRESEASON);
});

// T-10-079 은퇴한 내 선수의 SNS 공유용 한 장 이미지 — 만들면 미리 보기가 뜨고 PNG로 저장된다(공유 시트가 없는 브라우저).
const ID = '0d000000-0000-4000-8000-00000000000d';

test('은퇴한 내 선수의 공유 이미지를 만들어 저장한다', async ({ page }) => {
  await page.route(`${API}/v1/profile`, (r) =>
    r.fulfill(
      ok({
        id: 'u1',
        linked: { google: false, toss: false },
        googleEmailMasked: null,
        recoveryCodeIssuedAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        nickname: null,
      }),
    ),
  );
  await page.route(`${API}/v1/careers/mine`, (r) => r.fulfill(ok({ linked: false, entries: [] })));
  await page.addInitScript((id) => {
    if (localStorage.getItem('ft_hof')) return;
    const career = Array.from({ length: 8 }, (_, i) => ({
      year: 2030 + i,
      age: 26 + i,
      club: '맨체스터 스카이블루',
      league: '프리미어리그',
      apps: 38,
      goals: 20,
      assists: 10,
      cs: 0,
      rating: 7.4,
      rank: 2,
      ovr: 85,
      honors: [],
    }));
    localStorage.setItem(
      'ft_hof',
      JSON.stringify([
        {
          id,
          name: '공유왕',
          pos: 'FW',
          number: 9,
          peak: 86,
          age: 34,
          apps: 304,
          goals: 160,
          assists: 80,
          trophies: 0,
          awards: 0,
          caps: 0,
          ballon: 0,
          lastClub: '맨체스터 스카이블루',
          score: 500,
          date: '2026-09-01',
          public: true,
          detail: {
            number: 9,
            pos: 'FW',
            age: 34,
            peak: 86,
            lastClub: '맨체스터 스카이블루',
            career,
            trophies: [],
            awards: [],
            ballon: [],
            nat: { caps: 0 },
            storyLog: [],
            miles: [],
          },
        },
      ]),
    );
  }, ID);

  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await page.locator('[data-my-player="0"]').click();
  const card = page.locator('[data-share-image]');
  await card.locator('[data-act="share-image-make"]').click();
  const img = card.locator('[data-share-image-preview]');
  await expect(img).toBeVisible();
  expect(
    await img.evaluate((el: HTMLImageElement) =>
      el.decode().then(() => [el.naturalWidth, el.naturalHeight]),
    ),
  ).toEqual([1080, 1350]);
  const download = page.waitForEvent('download');
  await card.locator('[data-act="share-image-save"]').click();
  expect((await download).suggestedFilename()).toBe('offside-공유왕.png');
});
