import { test, expect } from '@playwright/test';
import { resumeWithSave } from './helpers.js';

// T-10-033: 이벤트 정의는 import 부수효과로 등록된다. Svelte 포팅 때 게임 경로에서 그 import가 빠져
// 확률 도감을 열기 전엔 랜덤·스토리 이벤트가 하나도 뜨지 않았다(대기 중 이벤트가 있으면 시트가 깨졌다).
// 도감을 열지 않은 채로 대기 중 이벤트를 이어 해서 시트가 뜨고 선택까지 되는지 본다.
test('도감을 열지 않아도 대기 중 랜덤 이벤트가 뜨고 선택할 수 있다', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await resumeWithSave(page, { pending: { type: 'event', id: 'knock' } });

  const sheet = page.locator('#sheet');
  await expect(sheet).toContainText('훈련 중 통증');
  await sheet.locator('[data-choice]').first().click();
  await expect(sheet).not.toContainText('훈련 중 통증');
  expect(errors).toEqual([]);
});

// T-11-432: 선택지에 득실 칩이 보이고, 판정 없는 선택지는 '판정 없음', 확률은 '성공 N%'로 보인다.
test('이벤트 선택지에 득실 칩과 판정 표기가 보인다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await resumeWithSave(page, { pending: { type: 'event', id: 'bench-talk' } });
  const sheet = page.locator('#sheet');
  const roll = sheet.locator('[data-choice="0"]');
  await expect(roll.locator('.odds')).toHaveText(/^성공 \d+%$/);
  await expect(roll.locator('[data-choice-chips]')).toContainText('실패 시 신뢰 ↓');
  const safe = sheet.locator('[data-choice="1"]');
  await expect(safe.locator('.odds')).toHaveText('안전');
  await expect(safe.locator('[data-choice-chips] .chip')).toHaveText([
    '컨디션 ↓',
    '능력치 ↑',
    '가끔 대가',
  ]);
});

test('판정 없는 선택지는 확정 대신 판정 없음으로 보인다', async ({ page }) => {
  await resumeWithSave(page, { pending: { type: 'event', id: 'ad' } });
  const sure = page.locator('#sheet [data-choice="0"]');
  await expect(sure.locator('.odds')).toHaveText('판정 없음');
  await expect(sure.locator('[data-choice-chips] .chip')).toHaveText(['컨디션 ↓', '인기 ↑']);
});
