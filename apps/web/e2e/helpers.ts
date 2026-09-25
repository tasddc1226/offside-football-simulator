import { expect, type Page } from '@playwright/test';

/** 홈 화면에서 새 커리어를 킥오프하고 선수 화면이 뜰 때까지 기다린다.
 * T-10-002: 생성 화면이 프로필 입력(1/2) → 후보 카드 선택(2/2) 2단계 플로우가 되어, 후보 카드를
 * 하나 열어 고른 뒤에야 [data-act="start"]가 활성화된다. */
export async function startCareer(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: /새 커리어 킥오프/ }).click();
  await page.locator('[data-act="next-candidates"]').click();
  await page.locator('[data-cand="0"]').click();
  await page.locator('[data-act="start"]').click();
  await expect(page.locator('.player h1')).toBeVisible();
}

/** T-10-029 새 커리어를 고교 첫 시즌 직후(이적 시장 대기) 저장본으로 만들고 이어하기로 이적 시장을 연다. */
export async function openMarket(page: Page): Promise<void> {
  await startCareer(page);
  await page.evaluate(() => {
    const g = JSON.parse(localStorage.getItem('ft_save')!);
    g.pending = { type: 'market', res: null, m: null };
    localStorage.setItem('ft_save', JSON.stringify(g));
  });
  await page.reload();
  // 이어하기를 누르면 대기 중인 이적 시장이 바로 열린다.
  await page.locator('[data-act="continue"]').click();
}

/** 이적 시장에서 바로 은퇴한다(은퇴 크레딧이 시작된다). */
export async function retireFromMarket(page: Page): Promise<void> {
  await openMarket(page);
  const sheet = page.locator('#sheet');
  await sheet.getByRole('button', { name: '은퇴하기' }).click();
  await sheet.getByRole('button', { name: '은퇴한다' }).click();
}
