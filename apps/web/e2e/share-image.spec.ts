import { test, expect, type Page } from '@playwright/test';
import { API, ok, usePreseason } from './helpers.js';

// 프리시즌 기록으로 꾸민 화면이라 시계를 시즌 1 개막 전으로 고정한다.
usePreseason();

// T-10-079 은퇴한 내 선수의 SNS 공유용 한 장 이미지 — 만들면 미리 보기가 뜨고 PNG로 저장된다(공유 시트가 없는 브라우저).
const ID = '0d000000-0000-4000-8000-00000000000d';

/** 서버 기록이 있는 은퇴한 내 선수 하나를 이 기기에 둔다. 받은 칭호는 유럽파(대표) · 원클럽맨. */
async function seed(page: Page, o: { name?: string; public?: boolean } = {}) {
  // 아래 저장 기록은 프리시즌 선수다.
  await page.clock.setFixedTime(new Date('2026-09-30T00:00:00.000Z'));
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
  await page.addInitScript(
    ({ id, name, pub }) => {
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
            name,
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
            public: pub,
            title: 'europe',
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
              titles: [
                { id: 'europe', year: 2031 },
                { id: 'oneclub', year: 2037 },
              ],
            },
          },
        ]),
      );
    },
    { id: ID, name: o.name ?? '공유왕', pub: o.public ?? true },
  );

  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await page.locator('[data-act="open-owner-players"]').click();
  await page.locator('[data-my-player="0"]').click();
}

test('은퇴한 내 선수의 공유 이미지를 만들어 저장한다', async ({ page }) => {
  await seed(page);
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

test('T-11-439 칭호 · 이름 공개 카드가 공유 이미지보다 먼저 오고, 만든 뒤 칭호를 바꾸면 반영하기를 띄운다', async ({
  page,
}) => {
  await seed(page);
  const y = async (sel: string) => (await page.locator(sel).boundingBox())!.y;
  const card = page.locator('[data-share-image]');
  await expect(card).toBeVisible();
  expect(await y('[data-legend-titles]')).toBeLessThan(await y('[data-act="hof-public"]'));
  expect(await y('[data-act="hof-public"]')).toBeLessThan(await y('[data-share-image]'));

  await card.locator('[data-act="share-image-make"]').click();
  await expect(card.locator('[data-share-image-preview]')).toBeVisible();
  // 바뀐 게 없으면 다시 만들기는 작은 링크다.
  await expect(card.locator('[data-share-image-stale]')).toHaveCount(0);
  await expect(card.locator('[data-act="share-image-remake"]')).toHaveClass(/link-btn/);

  const titles = page.locator('[data-legend-titles]');
  await titles.locator('[data-act="legend-title-open"]').click();
  await titles.locator('[data-legend-title-pick="oneclub"]').click();
  await expect(card.locator('[data-share-image-stale]')).toBeVisible();
  const refresh = card.locator('[data-act="share-image-refresh"]');
  await expect(refresh).toHaveText('바뀐 내용 반영하기');
  await expect(card.locator('[data-act="share-image-remake"]')).toHaveCount(0);
  await refresh.click();
  await expect(card.locator('[data-share-image-stale]')).toHaveCount(0);
  await expect(card.locator('[data-act="share-image-remake"]')).toBeVisible();
});

test('T-11-439 이름 공개 중에도 실명 경고가 보이고, 공개할 수 없는 이름은 누르기 전에 알리고 막는다', async ({
  page,
}) => {
  await seed(page);
  await expect(page.locator('[data-publish-warn]')).toContainText('실명은 쓰지 않는 게 좋아요');
  await expect(page.locator('[data-publish-blocked]')).toHaveCount(0);
});

test('T-11-439 링크·욕설이 든 이름은 이름 공개 버튼이 막혀 있다', async ({ page }) => {
  await seed(page, { name: '시발 FC', public: false });
  await expect(page.locator('[data-publish-blocked]')).toContainText('공개할 수 없어요');
  await expect(page.locator('[data-act="hof-public"]')).toBeDisabled();
  await expect(page.locator('[data-publish-warn]')).toHaveCount(0);
});

test('T-11-439 은퇴 리포트 맨 위 점수는 한국어 라벨이고, 자세히를 누르면 점수 구성이 펼쳐진다', async ({
  page,
}) => {
  await seed(page);
  await expect(page.locator('.film-score span')).toHaveText('레전드 점수');
  await page.locator('[data-act="legend-score-more"]').click();
  const more = page.locator('details[data-credit="career"]');
  await expect(more).toHaveAttribute('open', '');
  await expect(more.locator('summary')).toBeInViewport();
});
