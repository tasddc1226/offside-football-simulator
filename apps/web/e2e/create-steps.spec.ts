import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createStep } from './helpers.js';

const noScroll = async (page: import('@playwright/test').Page) => {
  const [full, view] = await page.evaluate(() => [
    document.documentElement.scrollHeight,
    innerHeight,
  ]);
  expect(full).toBeLessThanOrEqual(view);
};

// T-11-605 선수 만들기를 단계로 나눠 한 화면에 한 가지씩 고른다.
test('입력 단계와 후보 고르기가 360×780에서 스크롤 없이 들어온다', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-01T01:00:00Z'));
  await page.goto('/');
  await page.getByRole('button', { name: /새 커리어 킥오프/ }).click();
  for (const pos of ['FW', 'MF', 'DF', 'GK']) {
    await page.locator(`[data-set="pos"][data-val="${pos}"]`).click();
    await noScroll(page);
  }
  await page.locator('[data-set="pos"][data-val="DF"]').click();
  await page.locator('[data-set="dpos"][data-val="LWB"]').click();
  await expect(page.locator('[data-dpos-panel]')).toContainText('왼쪽을 오르내려요');
  await expect(page.locator('[data-tendency]')).toContainText('도움 비중 높음');
  const next = page.locator('[data-act="step-next"]');
  await next.click();
  await expect(page.locator('[data-coach="focus"]')).toContainText('같은 훈련에서');
  await noScroll(page);
  await next.click();
  await noScroll(page);
  await next.click();
  await noScroll(page);
  await page.locator('.create-form [data-step-go="extra"]').click();
  await noScroll(page);
  const { violations } = await new AxeBuilder({ page }).include('.create-wizard').analyze();
  expect(violations.map((v) => v.id)).toEqual([]);

  await page.locator('[data-act="next-candidates"]').click();
  await page.locator('[data-cand="0"]').waitFor();
  await noScroll(page);
  await page.locator('[data-cand="0"]').click();
  await expect(page.locator('[data-cand-edge="0"]')).toBeVisible();
  // Svelte starts a delay animation before the growing card/detail animations. Wait through both.
  await page.locator('[data-cand="0"]').evaluate(async (card) => {
    for (;;) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const running = card
        .getAnimations({ subtree: true })
        .filter(
          (animation) =>
            animation.playState !== 'finished' &&
            animation.effect?.getComputedTiming().endTime !== Infinity,
        );
      if (!running.length) break;
      await Promise.all(running.map((animation) => animation.finished.catch(() => undefined)));
    }
  });
  await noScroll(page);
});

test('등번호가 범위를 벗어나면 그 자리에서 알리고, 빈 이름은 후보 전에 채운다', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: /새 커리어 킥오프/ }).click();
  await createStep(page, 'info');
  const next = page.locator('[data-act="next-candidates"]');
  await page.locator('#f-num').fill('100');
  await expect(page.locator('[data-number-note]')).toContainText('1~99');
  await expect(next).toBeDisabled();
  await page.locator('#f-num').fill('');
  await page.locator('#f-name').fill('');
  await expect(page.locator('.live-card')).toContainText('이름 미정');
  await expect(next).toBeEnabled();
  await next.click();
  await page.locator('[data-cand="0"]').click();
  await page.locator('[data-act="home"]').click();
  await expect(page.locator('#f-name')).not.toHaveValue('');
  await expect(page.locator('#f-num')).not.toHaveValue('');
});

test('새로 고침해도 고르던 입력과 단계가 남고, 뒤로 가기는 이전 단계로 간다', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-01T01:00:00Z'));
  await page.goto('/');
  await page.getByRole('button', { name: /새 커리어 킥오프/ }).click();
  await page.locator('[data-set="pos"][data-val="MF"]').click();
  await page.locator('[data-set="dpos"][data-val="RM"]').click();
  await page.locator('[data-act="step-next"]').click();
  await page.locator('[data-act="step-next"]').click();
  await page.locator('[data-set="trait"][data-val="iron"]').click();
  await page.goBack();
  await expect(page.locator('[data-coach="focus"]')).toBeVisible();
  await page.goForward();
  await expect(page.locator('[data-set="trait"][data-val="iron"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await page.reload();
  await page.getByRole('button', { name: /새 커리어 킥오프/ }).click();
  await expect(page.locator('[data-set="trait"][data-val="iron"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await createStep(page, 'pos');
  await expect(page.locator('[data-set="dpos"][data-val="RM"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});
