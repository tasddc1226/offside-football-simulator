import { test, expect } from '@playwright/test';
import { resumeWithSave } from './helpers.js';

// T-11-191 도트 선수 꾸미기 — 선수 자금으로 항목을 한 번 사면 그 뒤로는 무료로 바꾸고, 은퇴하면 굳는다.

test('도트 선수를 눌러 꾸미기를 열고, 미리보기 뒤 사서 모양을 바꾼다', async ({ page }) => {
  await resumeWithSave(page, {
    money: 1_000_000,
    age: 26,
    contract: { years: 2, salary: 100_000 },
  });
  await page.locator('[data-act="avatar-look"]').click();
  const dialog = page.getByRole('dialog', { name: '선수 꾸미기' });
  await expect(dialog).toContainText('선수 자금 100억');
  // 머리 모양 '아프로'를 고르면 미리보기만 바뀌고, 사기 버튼이 나온다(연봉 10억 × 0.3 = 3억).
  await dialog.locator('[data-look-item="style"] [data-look-opt="6"]').click();
  await expect(dialog.locator('[data-act="look-buy"]')).toHaveText('머리 모양 3억원에 사기');
  await expect(dialog).toContainText('선수 자금 100억');
  await dialog.locator('[data-act="look-buy"]').click();
  await expect(page.locator('#toast')).toHaveText(
    '머리 모양을 샀어요. 이제 언제든 바꿀 수 있어요.',
  );
  await expect(dialog).toContainText('선수 자금 97억');
  await expect(dialog.locator('[data-look-item="style"]')).toContainText('보유');
  // 산 뒤에는 바로 바뀌고 자금은 그대로다. 저장본에도 남는다.
  await dialog.locator('[data-look-item="style"] [data-look-opt="8"]').click();
  await expect(dialog.locator('[data-look-item="style"] [data-look-opt="8"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(dialog).toContainText('선수 자금 97억');
  const look = await page.evaluate(() => JSON.parse(localStorage.getItem('ft_save')!).look);
  expect(look).toEqual({ owned: ['style'], pick: { style: 8 } });
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('자금이 모자라면 살 수 없다(은퇴 뒤 잠금은 game look.test.ts)', async ({ page }) => {
  await resumeWithSave(page, { money: 100, contract: { years: 2, salary: 100_000 } });
  await page.locator('[data-act="avatar-look"]').click();
  const dialog = page.getByRole('dialog', { name: '선수 꾸미기' });
  await dialog.locator('[data-look-item="glasses"] [data-look-opt="1"]').click();
  await expect(dialog.getByRole('alert')).toHaveText('자금이 모자라요. 6억원이 필요해요.');
  await expect(dialog.locator('[data-act="look-buy"]')).toHaveCount(0);
});
