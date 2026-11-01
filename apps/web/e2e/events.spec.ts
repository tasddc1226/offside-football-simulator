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
  // T-11-438 '안전' · '원터치' 선택지가 없으면 뜻 줄도 없다.
  await expect(page.locator('#sheet [data-event-legend]')).toHaveCount(0);
});

// T-11-438 '안전' 뜻은 터치 화면에서도 보이게 선택지 아래 한 줄로 늘 보인다(시트를 잠시 닫지 않아도 뜻을 확인할 수 있다).
test("'안전' 선택지가 있으면 그 뜻이 시트에 보인다", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await resumeWithSave(page, { pending: { type: 'event', id: 'bench-talk' } });
  const legend = page.locator('#sheet [data-event-legend]');
  await expect(legend).toContainText('안전 결과는 확정이지만 보상이 줄고, 가끔 대가가 따라요');
});

test('이벤트를 닫고 일정과 기록을 확인한 뒤 같은 선택지로 돌아온다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await resumeWithSave(page, { pending: { type: 'event', id: 'bench-talk' } });
  const sheet = page.locator('#sheet');
  const choices = await sheet.locator('[data-choice]').allTextContents();
  const saved = await page.evaluate(() => localStorage.getItem('ft_save'));
  await sheet.getByRole('button', { name: '잠시 닫기' }).click();
  await expect(sheet).toBeHidden();
  await page.locator('[data-career-overview] summary').filter({ hasText: '대회 일정' }).click();
  await expect(page.locator('[data-career-overview] .calendar')).toContainText('발탁 필요');
  await page.locator('[data-career-scoring] summary').click();
  await expect(page.locator('[data-career-scoring]')).toContainText('리그 경기만 집계');
  await expect(page.locator('[data-scoring-me]')).toHaveCount(1);
  await page.getByRole('button', { name: '도움', exact: true }).click();
  await expect(page.getByRole('list', { name: '도움', exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('ft_save'))).toBe(saved);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('[data-act="resume"]').click();
  await expect(sheet).toBeVisible();
  expect(await sheet.locator('[data-choice]').allTextContents()).toEqual(choices);
  await page.reload();
  await page.locator('[data-act="continue"]').click();
  await expect(sheet).toContainText('감독실 노크');
  expect(await sheet.locator('[data-choice]').allTextContents()).toEqual(choices);
});
