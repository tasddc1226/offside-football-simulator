import { test, expect } from '@playwright/test';
import fixture from '../../../packages/game/src/__fixtures__/save-fw26.json' with { type: 'json' };
import { ok, fail } from './helpers.js';

const preview = {
  season: 1,
  number: 10,
  minSeasons: 6,
  recordedSeasons: fixture.career.length,
  clubs: [
    {
      clubId: 'pl-0',
      club: '맨체스터 스카이블루',
      seasons: 4,
      progress: 60,
      eligible: false,
      candidate: false,
      availability: 'open',
    },
    {
      clubId: 'pl-1',
      club: '리버풀 더 레즈',
      seasons: 7,
      progress: 100,
      eligible: true,
      candidate: true,
      availability: 'taken',
    },
  ],
};
for (const [lang, open, career] of [
  ['ko', '영구결번 도전', '커리어'],
  ['en', 'Retire your number', 'Career'],
  ['ja', '永久欠番への挑戦', 'キャリア'],
] as const) {
  test(`retirement guide ${lang}: explicit loading, cached revisit and narrow layout`, async ({
    page,
  }) => {
    let calls = 0;
    await page.setViewportSize({ width: 320, height: 780 });
    await page.addInitScript(
      ({ fixture, lang }) => {
        localStorage.setItem('ft_save', JSON.stringify(fixture));
        localStorage.setItem('ft_lang', JSON.stringify(lang));
      },
      { fixture, lang },
    );
    await page.route('**/v1/**', (route) => route.fulfill(fail(404, 'NOT_FOUND', 'unavailable')));
    await page.route('**/retired-number-progress?*', (route) => {
      calls++;
      return route.fulfill(ok(preview));
    });
    await page.goto('/');
    await page.locator('[data-act="continue"]').click();
    await page.getByRole('tab', { name: career, exact: true }).click();
    await expect(page.locator('[data-rn-guide]')).toBeVisible();
    expect(calls).toBe(0);
    await page.getByRole('button', { name: open }).click();
    await expect(page.locator('[data-rn-club]')).toHaveCount(2);
    expect(calls).toBe(1);
    await page.locator('[data-rn-guide] button').first().click();
    await page.getByRole('button', { name: open }).click();
    await expect(page.locator('[data-rn-club]')).toHaveCount(2);
    expect(calls).toBe(1);
    const bounds = await page.locator('[data-rn-guide]').evaluate((el) => ({
      left: el.getBoundingClientRect().left,
      right: el.getBoundingClientRect().right,
      width: window.innerWidth,
      overflow: el.scrollWidth > el.clientWidth,
    }));
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(bounds.width);
    expect(bounds.overflow).toBe(false);
  });
}

test('retirement guide recovers from a failed request without reporting an open number', async ({
  page,
}) => {
  await page.addInitScript(
    (fixture) => localStorage.setItem('ft_save', JSON.stringify(fixture)),
    fixture,
  );
  await page.route('**/v1/**', (route) => route.fulfill(fail(404, 'NOT_FOUND', 'unavailable')));
  let calls = 0;
  await page.route('**/retired-number-progress?*', (route) =>
    route.fulfill(++calls === 1 ? fail(503, 'STORE_UNAVAILABLE', 'offline') : ok(preview)),
  );
  await page.goto('/');
  await page.locator('[data-act="continue"]').click();
  await page.getByRole('tab', { name: '커리어', exact: true }).click();
  await page.getByRole('button', { name: '영구결번 도전' }).click();
  await expect(page.locator('[data-rn-club]')).toHaveCount(0);
  await page.getByRole('button', { name: '다시 확인', exact: true }).click();
  await expect(page.locator('[data-rn-club]')).toHaveCount(2);
});

for (const openDuringSync of [true, false]) {
  test(`season upload refreshes ${openDuringSync ? 'open' : 'closed'} guide without polling`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 780 });
    await page.addInitScript((fixture) => {
      localStorage.setItem('ft_save', JSON.stringify(fixture));
      localStorage.setItem('ft_lang', JSON.stringify('ko'));
    }, fixture);
    await page.route('**/v1/**', (route) => route.fulfill(fail(404, 'NOT_FOUND', 'unavailable')));
    let synced = false;
    let reads = 0;
    const clubs = Array.from({ length: 12 }, (_, i) => ({
      ...preview.clubs[0],
      clubId: `pl-${i}`,
      club: `구단 ${i + 1}`,
    }));
    await page.route('**/retired-number-progress?*', (route) => {
      reads++;
      return route.fulfill(ok({ ...preview, clubs: synced ? clubs : clubs.slice(0, 11) }));
    });
    await page.goto('/');
    await page.locator('[data-act="continue"]').click();
    await page.getByRole('tab', { name: '커리어', exact: true }).click();
    const toggle = page.locator('[data-rn-guide] button').first();
    await toggle.click();
    await expect(page.locator('[data-rn-club]')).toHaveCount(11);
    expect(reads).toBe(1);
    if (!openDuringSync) await toggle.click();
    // Retry the real persisted outbox through the application's online handler.
    await page.route('**/v1/profile', (route) => route.fulfill(ok({})));
    await page.route('**/v1/careers/*/seasons/*', (route) => {
      synced = true;
      return route.fulfill(ok({}));
    });
    const saved = await page.evaluate(() => localStorage.getItem('ft_save'));
    await page.evaluate((cid) => {
      localStorage.setItem(
        'ft_outbox',
        JSON.stringify([
          { kind: 'season', careerId: cid, year: 2040, body: {} },
          { kind: 'season', careerId: cid, year: 2041, body: {} },
        ]),
      );
      window.dispatchEvent(new Event('online'));
    }, fixture.cid);
    await expect.poll(() => page.evaluate(() => localStorage.getItem('ft_outbox'))).toBe('[]');
    if (!openDuringSync) {
      expect(reads).toBe(1);
      await toggle.click();
    }
    await expect(page.locator('[data-rn-club]')).toHaveCount(12);
    expect(reads).toBe(2);
    await toggle.click();
    await toggle.click();
    await expect(page.locator('[data-rn-club]')).toHaveCount(12);
    expect(reads).toBe(2);
    expect(await page.evaluate(() => localStorage.getItem('ft_save'))).toBe(saved);
    const bounds = await page.locator('[data-rn-guide]').evaluate((el) => ({
      left: el.getBoundingClientRect().left,
      right: el.getBoundingClientRect().right,
      width: innerWidth,
      overflow: el.scrollWidth > el.clientWidth,
    }));
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(bounds.width);
    expect(bounds.overflow).toBe(false);
  });
}
