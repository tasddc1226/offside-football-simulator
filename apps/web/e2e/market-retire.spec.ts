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

  // 은퇴 크레딧: 선수 카드가 먼저 보이고, 아래 장면은 스크롤해 화면에 들어올 때 올라온다(T-10-062).
  await expect(page.locator('[data-credit="player"]')).toBeVisible();
  await expect(page.locator('[data-credit="finale"]')).toBeHidden();
  await expect(page.locator('[data-credit="career"]')).toBeVisible();
  await expect(page.locator('[data-act="new"]')).toHaveText(/새 커리어 킥오프/);
  // 이름 공개·공유 카드 대신 '내 선수에만 남는 기록' 안내.
  await expect(page.locator('[data-share="short"]')).toContainText('내 선수에만 남는 기록');
  await expect(page.locator('[data-act="hof-public"]')).toHaveCount(0);
  await expect(page.locator('[data-act="share-career"]')).toHaveCount(0); // 서버에 없어 공유 링크도 없다
});

test('만 30세가 넘어 은퇴하면 명예의 전당에 기록된다고 묻고, 이름 공개 카드가 나온다 (T-10-032)', async ({
  page,
}) => {
  await openMarket(page, 34);
  const sheet = page.locator('#sheet');
  await sheet.getByRole('button', { name: '은퇴하기' }).click();
  await expect(sheet).toContainText('명예의 전당에 기록되고');
  await sheet.getByRole('button', { name: '은퇴한다' }).click();
  await expect(page.locator('[data-act="hof-public"]')).toBeVisible();
  // T-10-065: 환경설정 '선수 이름 공개'가 기본으로 켜져 있어 이름을 공개한 채로 시작한다.
  await expect(page.locator('[data-act="hof-public"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-share="short"]')).toHaveCount(0);
  // T-10-073: 크레딧 끝자락에서 숨겨져 있던 실제 잠재력을 마지막 스카우트 평가와 함께 공개한다.
  const pot = page.locator('[data-legend-pot]');
  await pot.scrollIntoViewIfNeeded();
  await expect(pot).toBeVisible();
  await expect(pot).toContainText(/끝까지 숨겨져 있던 잠재력\s*[SABCD]\s*스카우트/);
  await expect(pot.locator('[data-legend-ach]')).toContainText(/잠재력 달성도\s*\d+%\s*최고 OVR \d+ · /);
});

test('환경설정에서 선수 이름 공개를 끄면 은퇴 때 익명으로 시작한다 (T-10-065)', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('[data-act="settings"]').click();
  const toggle = page.locator('[data-setting="name-public"]');
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  expect(await page.evaluate(() => localStorage.getItem('ft_name_public'))).toBe('false');

  await openMarket(page, 34);
  const sheet = page.locator('#sheet');
  await sheet.getByRole('button', { name: '은퇴하기' }).click();
  await sheet.getByRole('button', { name: '은퇴한다' }).click();
  await expect(page.locator('[data-act="hof-public"]')).toHaveAttribute('aria-pressed', 'false');
});

test('은퇴 크레딧은 직접 스크롤해 내려가는 대로 장면이 올라오고, 맨 아래에 다음 버튼이 있다', async ({
  page,
}) => {
  await retireFromMarket(page);
  await expect(page.locator('[data-credit="finale"]')).toBeHidden();
  // 자동으로 내려가지 않는다.
  await page.waitForTimeout(1_500);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await page.evaluate(async () => {
    for (let y = 0; y <= document.documentElement.scrollHeight; y += 240) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
  });
  await expect(page.locator('[data-credit="finale"]')).toBeVisible();
  await expect(page.locator('.credit-wait')).toHaveCount(0);
  await expect(page.locator('[data-act="new"]')).toBeInViewport();
});

test('감속 모션이면 은퇴 화면이 연출 없이 처음부터 다 보인다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await retireFromMarket(page);
  await expect(page.locator('[data-credit="career"]')).toBeVisible();
  await expect(page.locator('[data-act="new"]')).toBeVisible();
  await expect(page.locator('[data-credit="finale"]')).toBeVisible();
});
