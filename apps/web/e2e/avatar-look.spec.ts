import { test, expect } from '@playwright/test';
import { resumeWithSave } from './helpers.js';

// T-11-191 도트 선수 꾸미기 — 선수 자금으로 항목을 한 번 사면 그 뒤로는 무료로 바꾸고, 은퇴 후에는 전용 외형 편집 화면을 쓴다.

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

test('자금이 모자라면 살 수 없다(은퇴 편집은 retired-look.spec.ts)', async ({ page }) => {
  await resumeWithSave(page, { money: 100, contract: { years: 2, salary: 100_000 } });
  await page.locator('[data-act="avatar-look"]').click();
  const dialog = page.getByRole('dialog', { name: '선수 꾸미기' });
  await dialog.locator('[data-look-item="glasses"] [data-look-opt="1"]').click();
  await expect(dialog.getByRole('alert')).toHaveText('자금이 모자라요. 6억원이 필요해요.');
  await expect(dialog.locator('[data-act="look-buy"]')).toHaveCount(0);
});

test('기록 아이템은 칭호를 얻어야 사고, 산 뒤에는 입고 벗는다', async ({ page }) => {
  await resumeWithSave(page, {
    money: 1_000_000,
    contract: { years: 2, salary: 100_000 },
    titles: [{ id: 'topscorer', year: 2030 }],
  });
  await page.locator('[data-act="avatar-look"]').click();
  const dialog = page.getByRole('dialog', { name: '선수 꾸미기' });
  // 칭호가 없는 아이템은 조건만 보이고 살 수 없다.
  await expect(dialog.locator('[data-look-rec="champ-band"]')).toContainText(
    "'챔피언' 칭호를 얻으면 열려요",
  );
  await dialog.locator('[data-look-rec="champ-band"]').click();
  await expect(dialog.locator('[data-act="look-rec-buy"]')).toHaveCount(0);
  // 득점왕 칭호로 열린 황금 축구화(연봉 10억 × 0.5 = 5억).
  await dialog.locator('[data-look-rec="scorer-boots"]').click();
  await expect(dialog.locator('[data-act="look-rec-buy"]')).toHaveText('5억원에 사기');
  await dialog.locator('[data-act="look-rec-buy"]').click();
  await expect(page.locator('#toast')).toHaveText('황금 축구화를 사서 입었어요.');
  await expect(dialog).toContainText('선수 자금 95억');
  await expect(dialog.locator('[data-look-rec="scorer-boots"]')).toContainText('입는 중');
  const look = await page.evaluate(() => JSON.parse(localStorage.getItem('ft_save')!).look);
  expect(look).toEqual({ owned: [], pick: { boots: 10 }, rec: ['scorer-boots'] });
  // 벗으면 기본 축구화로 돌아간다(자금은 그대로).
  await dialog.locator('[data-look-rec="scorer-boots"]').click();
  await expect(dialog.locator('[data-look-rec="scorer-boots"]')).toContainText('입기');
  await expect(dialog).toContainText('선수 자금 95억');
});

for (const width of [320, 390]) {
  test(`미니형 꾸미기가 ${width}px 화면 안에 표시된다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await resumeWithSave(page, { money: 1_000_000, age: 26 });
    const avatar = page.locator('.player .avatar');
    // T-11-270 한 번 합성한 캔버스 한 장(24×32칸 × 10px).
    await expect(avatar).toHaveAttribute('data-avatar-renderer', 'image');
    await expect(avatar).toHaveAttribute('width', '240');
    await expect(avatar).toHaveAttribute('height', '320');
    await expect(avatar).toHaveAttribute('data-ready', 'true');
    await page.locator('[data-act="avatar-look"]').click();
    const dialog = page.getByRole('dialog', { name: '선수 꾸미기' });
    await dialog.locator('[data-look-item="style"] [data-look-opt="2"]').click();
    await expect(dialog.locator('canvas.avatar[data-ready="true"]').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
