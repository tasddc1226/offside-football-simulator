import { test, expect } from '@playwright/test';
import { startCareer } from './helpers.js';

// T-10-033: 이벤트 정의는 import 부수효과로 등록된다. Svelte 포팅 때 게임 경로에서 그 import가 빠져
// 확률 도감을 열기 전엔 랜덤·스토리 이벤트가 하나도 뜨지 않았다(대기 중 이벤트가 있으면 시트가 깨졌다).
// 도감을 열지 않은 채로 대기 중 이벤트를 이어 해서 시트가 뜨고 선택까지 되는지 본다.
test('도감을 열지 않아도 대기 중 랜덤 이벤트가 뜨고 선택할 수 있다', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startCareer(page);
  await page.evaluate(() => {
    const g = JSON.parse(localStorage.getItem('ft_save')!);
    g.pending = { type: 'event', id: 'knock' };
    localStorage.setItem('ft_save', JSON.stringify(g));
  });
  await page.reload();
  await page.locator('[data-act="continue"]').click();

  const sheet = page.locator('#sheet');
  await expect(sheet).toContainText('훈련 중 통증');
  await sheet.locator('[data-choice]').first().click();
  await expect(sheet).not.toContainText('훈련 중 통증');
  expect(errors).toEqual([]);
});
