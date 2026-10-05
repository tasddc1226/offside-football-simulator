import { expect, type Page } from '@playwright/test';

/** e2e 기본 API 주소 — 실제 서버 없이 page.route로 흉내 낸다. */
export const API = 'http://localhost:8787';
/** 성공 응답(route.fulfill 인자). 서버처럼 { data, meta } 봉투로 담는다. */
export const ok = (data: unknown, status = 200) => ({
  status,
  json: { data, meta: { requestId: 'req_e2e' } },
});
/** 오류 응답(route.fulfill 인자). */
export const fail = (status: number, code: string, message: string) => ({
  status,
  json: { error: { code, message, retryable: false }, meta: { requestId: 'req_e2e' } },
});

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
  await resumeWithSave(page, {
    pending: { type: 'market', res: null, m: null },
    ...(age ? { age } : {}),
  });
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
  // T-10-089: 미니게임 선택지면 장면(버튼)을 한 번 탭해야 결과 시트가 뜬다.
  const tap = page.locator('#sheet [data-mg-tap]');
  if (await tap.isVisible()) await tap.click();
  await page.locator('#sheet [data-sheet]:not([data-mg-tap])').first().click();
  await expect(page.locator('#sheet')).toBeHidden();
}

/** 프리시즌(시즌 1 개막 2026-10-06 00:00 KST 전) 시각. 프리시즌 기록을 꾸며 쓰는 spec은 브라우저 시계를 여기에 고정한다 —
 * 실제 시계로 돌면 개막 뒤 기본 시즌이 1로 바뀌어 요청·목록이 달라진다. */
export const PRESEASON = new Date('2026-10-01T12:00:00+09:00');
