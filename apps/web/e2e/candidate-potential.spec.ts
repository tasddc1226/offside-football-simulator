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
  await expect(page.locator('[data-cand="0"]')).toContainText('잠재력 등급 범위 미확인');
  await page.evaluate(() =>
    localStorage.setItem('ft_scout_reveal', localStorage.getItem('ft_scout_seed')!),
  );
  await page.reload();
  await page.locator('[data-act="new"]').click();
  await page.locator('[data-act="next-candidates"]').click();
  await page.locator('[data-cand="1"]').click();
  const text = await page.locator('[data-cand="1"]').textContent();
  const [, min, upper] = text!.match(/초기 잠재력 ([DCBAS])(?:–([DCBAS]))?등급/)!;
  const max = upper ?? min;
  expect(text).not.toMatch(/초기 잠재력 \d+/);
  await page.locator('[data-act="start"]').click();
  const saved = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('ft_save')!);
    return { cid: s.cid, value: s.pot + s.bloom };
  });
  const grade =
    saved.value >= 90
      ? 'S'
      : saved.value >= 84
        ? 'A'
        : saved.value >= 78
          ? 'B'
          : saved.value >= 70
            ? 'C'
            : 'D';
  expect('DCBAS'.indexOf(grade)).toBeGreaterThanOrEqual('DCBAS'.indexOf(min!));
  expect('DCBAS'.indexOf(grade)).toBeLessThanOrEqual('DCBAS'.indexOf(max!));
  await page.reload();
  await page.locator('[data-act="continue"]').click();
  expect(
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('ft_save')!);
      return { cid: s.cid, value: s.pot + s.bloom };
    }),
  ).toEqual(saved);
});
