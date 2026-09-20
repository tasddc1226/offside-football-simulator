import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { advanceUntilOffers, completeOnboardingAndConfirm } from './helpers/player-creation.js';

test.use({ contextOptions: { hasTouch: true, isMobile: true, reducedMotion: 'reduce' } });
for (const input of ['mouse', 'touch'] as const) {
  test(`${input}: 팝업 서명 획 보존 → 계약서 적용 → 계약 확정`, async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    await completeOnboardingAndConfirm(page);
    await advanceUntilOffers(page);
    await page.getByRole('link', { name: '제안 상세·결정' }).first().click();
    const confirm = page.getByRole('button', { name: '서명하고 계약 확정' });
    await expect(confirm).toBeDisabled();
    await page.getByRole('button', { name: '직접 쓰기', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '계약서에 사인하기' });
    const pad = dialog.getByRole('img', { name: '서명 입력란' });
    await expect(pad).toBeInViewport();
    const bounds = (await pad.boundingBox())!;
    const points = [
      [0.1, 0.5],
      [0.23, 0.25],
      [0.32, 0.7],
      [0.43, 0.3],
      [0.55, 0.65],
      [0.75, 0.4],
    ].map(([x, y]) => ({ x: bounds.x + bounds.width * x!, y: bounds.y + bounds.height * y! }));
    const scroll = await page.locator('.os-shell-main').evaluate((e) => e.scrollTop);
    if (input === 'mouse') {
      await page.mouse.move(points[0]!.x, points[0]!.y);
      await page.mouse.down();
      for (const point of points.slice(1)) await page.mouse.move(point.x, point.y, { steps: 3 });
      await page.mouse.up();
    } else {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ ...points[0]!, id: 1 }],
      });
      for (const point of points.slice(1))
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ ...point, id: 1 }],
        });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await cdp.detach();
    }
    await expect(pad.locator('polyline')).toHaveCount(1);
    const ink = await pad.locator('polyline').getAttribute('points');
    expect(ink!.split(' ').length).toBeGreaterThanOrEqual(points.length);
    await expect(dialog.getByRole('button', { name: '서명 적용', exact: true })).toBeEnabled();
    expect(await page.locator('.os-shell-main').evaluate((e) => e.scrollTop)).toBe(scroll);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    if (input === 'touch') expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`signature-${input}.png`) });
    await dialog.getByRole('button', { name: '서명 적용', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(
      page.getByRole('button', { name: '서명 수정' }).locator('polyline'),
    ).toHaveAttribute('points', ink!);
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect(page.getByRole('heading', { name: '프로의 첫 유니폼' })).toBeVisible();
  });
}
