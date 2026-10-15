import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { API, ok, resumeWithSave } from './helpers.js';

// T-11-267 진행 팝업 위를 뛰어가던 선수 장면을 뺐다. 진행 · 건너뛰기 · 확인은 그대로다.
test('progress popup has no running player; skip and confirmation keep the results', async ({
  page,
}) => {
  await page.clock.install();
  await page.route(`${API}/v1/careers/**`, (r) => r.fulfill(ok({})));
  await resumeWithSave(page, {
    pending: null,
    phase: 1,
    injury: 0,
    serving: false,
    rng: { seed: 5 },
  });
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await page.locator('[data-act="advance"]').click();
  await expect(page.locator('#sheet')).toContainText('전반기 진행 중');
  await expect(page.locator('[data-progress-runner]')).toHaveCount(0);
  await expect(page.locator('.avatar-stage')).toHaveCount(0);
  const saved = await page.evaluate(() => localStorage.getItem('ft_save'));
  await page.clock.runFor(600);
  await page.locator('#an-skip').click();
  await expect(page.locator('#sheet [data-sheet="0"]')).toBeInViewport();
  await expect(page.locator('[data-block-wdl]')).not.toBeEmpty();
  expect(await page.evaluate(() => localStorage.getItem('ft_save'))).toBe(saved);
  await page.clock.resume();
  // 결과가 떠오르는 중간(반투명)에 대비를 재면 잘못 걸린다. 끝나는 애니메이션이 다 끝난 뒤에 잰다.
  await page.waitForFunction(() =>
    document
      .querySelector('#sheet')!
      .getAnimations({ subtree: true })
      .every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity),
  );
  const issues = await new AxeBuilder({ page }).include('#sheet').analyze();
  expect(issues.violations.map((v) => v.id)).toEqual([]);
  await page.locator('#sheet [data-sheet="0"]').click();
  await expect(page.locator('#sheet')).toBeHidden();
});
