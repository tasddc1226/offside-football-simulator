import { test, expect } from '@playwright/test';

// The web has no rewarded ad. Seed the shared persisted reward only to verify
// range rendering, reload recovery and selection → actual saved potential.
test('revealed candidate ranges survive reload and the selected potential reaches the save', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-10-06T01:00:00Z'));
  await page.goto('/');
  await page.locator('[data-act="new"]').click();
  await page.locator('[data-act="next-candidates"]').click();
  await page.locator('[data-cand="0"]').click();
  await expect(page.locator('[data-cand="0"]')).toContainText('초기 잠재력 범위 미확인');
  await page.evaluate(() =>
    localStorage.setItem('ft_scout_reveal', localStorage.getItem('ft_scout_seed')!),
  );
  await page.reload();
  await page.locator('[data-act="new"]').click();
  await page.locator('[data-act="next-candidates"]').click();
  await page.locator('[data-cand="1"]').click();
  const text = await page.locator('[data-cand="1"]').textContent();
  const [, min, max] = text!.match(/초기 잠재력 (\d+)–(\d+)/)!;
  await page.locator('[data-act="start"]').click();
  const saved = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('ft_save')!);
    return { cid: s.cid, value: s.pot + s.bloom };
  });
  expect(saved.value).toBeGreaterThanOrEqual(Number(min));
  expect(saved.value).toBeLessThanOrEqual(Number(max));
  await page.reload();
  await page.locator('[data-act="continue"]').click();
  expect(
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('ft_save')!);
      return { cid: s.cid, value: s.pot + s.bloom };
    }),
  ).toEqual(saved);
});
