import { test, expect } from '@playwright/test';
import { openMarket, retireFromMarket } from './helpers.js';

// T-10-029: 이적 시장("다음 시즌, 어디서 뛸까요?")에는 언제나 은퇴하기가 있다. 은퇴할 나이가 아니면 한 번 더
// 묻고, "조금 더 뛴다"를 누르면 이적 시장으로 돌아온다.
test('이적 시장에서 언제든 은퇴할 수 있다 — 이른 은퇴는 한 번 더 묻는다', async ({ page }) => {
  await openMarket(page);

  const sheet = page.locator('#sheet');
  await expect(sheet.locator('h2')).toHaveText('다음 시즌, 어디서 뛸까요?');
  const retire = sheet.getByRole('button', { name: '은퇴하기' });
  await retire.click();
  await expect(sheet).toContainText('정말 은퇴하시겠어요?');
  // T-10-032: 만 30세 전 은퇴는 짧은 커리어라 전체 명예의 전당에 오르지 않는다고 미리 알린다.
  await expect(sheet).toContainText('짧은 커리어는 전체 명예의 전당과 공유 링크에 오르지 않고');
  await sheet.getByRole('button', { name: '조금 더 뛴다' }).click();
  await expect(sheet.locator('h2')).toHaveText('다음 시즌, 어디서 뛸까요?');

  await retire.click();
  await sheet.getByRole('button', { name: '은퇴한다' }).click();
  await expect(sheet).toBeHidden();

  // 은퇴 크레딧: 선수 카드부터 하나씩 올라오고, 끝나기 전엔 다음 버튼이 없다. 건너뛰면 한 번에 펼친다.
  await expect(page.locator('[data-credit="player"]')).toBeVisible();
  await expect(page.locator('[data-credit="highlights"]')).toHaveCount(0);
  await expect(page.locator('[data-act="new"]')).toHaveCount(0);
  await expect(page.locator('[data-credit="highlights"]')).toBeVisible({ timeout: 4_000 });
  await page.locator('[data-act="credits-skip"]').click();
  await expect(page.locator('[data-act="credits-skip"]')).toHaveCount(0);
  await expect(page.locator('[data-credit="career"]')).toBeVisible();
  await expect(page.locator('[data-act="new"]')).toHaveText(/새 커리어 킥오프/);
  // 이름 공개·공유 카드 대신 '내 선수에만 남는 기록' 안내.
  await expect(page.locator('[data-share="short"]')).toContainText('내 선수에만 남는 기록');
  await expect(page.locator('[data-act="hof-public"]')).toHaveCount(0);
});

test('만 30세가 넘어 은퇴하면 명예의 전당에 기록된다고 묻고, 이름 공개 카드가 나온다 (T-10-032)', async ({ page }) => {
  await openMarket(page, 34);
  const sheet = page.locator('#sheet');
  await sheet.getByRole('button', { name: '은퇴하기' }).click();
  await expect(sheet).toContainText('명예의 전당에 기록되고');
  await sheet.getByRole('button', { name: '은퇴한다' }).click();
  await page.locator('[data-act="credits-skip"]').click();
  await expect(page.locator('[data-act="hof-public"]')).toBeVisible();
  await expect(page.locator('[data-share="short"]')).toHaveCount(0);
});

test('은퇴 크레딧은 끝까지 흘러가면 마지막에 다음 버튼이 올라온다', async ({ page }) => {
  await retireFromMarket(page);
  // 짧은 커리어(고교 1시즌)라도 섹션이 차례로 다 나오고 마지막에 버튼이 생긴다.
  await expect(page.locator('[data-act="new"]')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('[data-act="credits-skip"]')).toHaveCount(0);
  await expect(page.locator('[data-credit="career"]')).toBeVisible();
});

test('감속 모션이면 은퇴 화면이 연출 없이 처음부터 다 보인다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await retireFromMarket(page);
  await expect(page.locator('[data-credit="career"]')).toBeVisible();
  await expect(page.locator('[data-act="new"]')).toBeVisible();
  await expect(page.locator('[data-act="credits-skip"]')).toHaveCount(0);
});
