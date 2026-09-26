import { test, expect, type Page } from '@playwright/test';
import { startCareer } from './helpers.js';

// T-10-013: 진행 중 커리어가 다른 계정 소유라 서버가 시즌 업로드를 거절하면(outbox가 이벤트로 알린다)
// 홈에서 '지금 계정으로 이어서 기록' / '이 기기에만 두기'를 고른다.
const cidOf = (page: Page) =>
  page.evaluate(() => (JSON.parse(localStorage.getItem('ft_save')!) as { cid: string }).cid);

async function raiseConflict(page: Page) {
  const cid = await cidOf(page);
  await page.evaluate((careerId) => {
    window.dispatchEvent(
      new CustomEvent('offside:owner-conflict', {
        detail: [{ kind: 'season', careerId, year: 2026, body: { events: [] } }],
      }),
    );
  }, cid);
  await expect(page.locator('#toast')).toContainText('다른 계정에 기록돼 있어요');
  await page.locator('[data-act="home"]').click();
  return cid;
}

test('다른 계정 소유 커리어 → 지금 계정으로 이어서 기록하면 새 커리어 ID', async ({ page }) => {
  await startCareer(page);
  const before = await raiseConflict(page);
  const card = page.locator('[data-owner-conflict]');
  await expect(card).toContainText('이 커리어는 다른 계정에 기록돼 있어요');
  await card.locator('[data-act="adopt-career"]').click();
  await expect(card).toHaveCount(0);
  expect(await cidOf(page)).not.toBe(before);
});

test('다른 계정 소유 커리어 → 이 기기에만 두면 다시 묻지 않는다', async ({ page }) => {
  await startCareer(page);
  const cid = await raiseConflict(page);
  await page.locator('[data-act="keep-on-device"]').click();
  await expect(page.locator('[data-owner-conflict]')).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ft_conflict_skip')!))).toBe(
    cid,
  );
  expect(await cidOf(page)).toBe(cid);
});
