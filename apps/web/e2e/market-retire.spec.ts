import { test, expect } from '@playwright/test';
import { startCareer } from './helpers.js';

// T-10-029: 이적 시장("다음 시즌, 어디서 뛸까요?")에는 언제나 은퇴하기가 있다. 은퇴할 나이가 아니면 한 번 더
// 묻고, "조금 더 뛴다"를 누르면 이적 시장으로 돌아온다.
test('이적 시장에서 언제든 은퇴할 수 있다 — 이른 은퇴는 한 번 더 묻는다', async ({ page }) => {
  await startCareer(page);
  // 고교 첫 시즌을 마친 직후(이적 시장 대기) 저장본으로 다시 불러온다.
  await page.evaluate(() => {
    const g = JSON.parse(localStorage.getItem('ft_save')!);
    g.pending = { type: 'market', res: null, m: null };
    localStorage.setItem('ft_save', JSON.stringify(g));
  });
  await page.reload();
  // 이어하기를 누르면 대기 중인 이적 시장이 바로 열린다.
  await page.locator('[data-act="continue"]').click();

  const sheet = page.locator('#sheet');
  await expect(sheet.locator('h2')).toHaveText('다음 시즌, 어디서 뛸까요?');
  const retire = sheet.getByRole('button', { name: '은퇴하기' });
  await retire.click();
  await expect(sheet).toContainText('정말 은퇴하시겠어요?');
  await sheet.getByRole('button', { name: '조금 더 뛴다' }).click();
  await expect(sheet.locator('h2')).toHaveText('다음 시즌, 어디서 뛸까요?');

  await retire.click();
  await sheet.getByRole('button', { name: '은퇴한다' }).click();
  await expect(sheet).toBeHidden();
  await expect(page.locator('[data-act="new"]')).toHaveText(/새 커리어 킥오프/);
});
