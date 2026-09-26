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

/** 새 커리어를 만들고 저장본에 patch를 덮어쓴 뒤 다시 불러와 이어하기를 누른다(대기 중인 시트가 있으면 바로 열린다). */
export async function resumeWithSave(page: Page, patch: Record<string, unknown>): Promise<void> {
  await startCareer(page);
  await page.evaluate((patch) => {
    const g = JSON.parse(localStorage.getItem('ft_save')!);
    localStorage.setItem('ft_save', JSON.stringify(Object.assign(g, patch)));
  }, patch);
  await page.reload();
  await page.locator('[data-act="continue"]').click();
}

/** T-10-029 새 커리어를 고교 첫 시즌 직후(이적 시장 대기) 저장본으로 만들고 이어하기로 이적 시장을 연다. */
export async function openMarket(page: Page, age?: number): Promise<void> {
  await resumeWithSave(page, { pending: { type: 'market', res: null, m: null }, ...(age ? { age } : {}) });
}

/** 이적 시장에서 바로 은퇴한다(은퇴 크레딧이 시작된다). age를 주면 그 나이로 바꿔 은퇴한다 — 고교 선수라
 * 몇 살이든 은퇴할 때가 아니어서 한 번 더 묻는다. 만 30세 전이면 짧은 커리어(T-10-032)다. */
export async function retireFromMarket(page: Page, age?: number): Promise<void> {
  await openMarket(page, age);
  const sheet = page.locator('#sheet');
  await sheet.getByRole('button', { name: '은퇴하기' }).click();
  await sheet.getByRole('button', { name: '은퇴한다' }).click();
}

/** 구간 진행 뒤 이어지는 이벤트가 있으면(액션바 '이벤트 확인') 첫 선택지로 넘기고 결과 시트를 닫는다. */
export async function clearPendingEvent(page: Page): Promise<void> {
  const resume = page.locator('[data-act="resume"]');
  if (!(await resume.count())) return;
  await expect(resume).toContainText('이벤트 확인');
  await resume.click();
  await page.locator('.choice').first().click();
  await page.locator('#sheet [data-sheet]').first().click();
  await expect(page.locator('#sheet')).toBeHidden();
}
