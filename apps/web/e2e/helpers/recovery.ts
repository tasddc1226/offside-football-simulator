// recovery-api.spec.ts(T-1-012)·recovery-conflict.spec.ts(T-1-014, TEST-E2E-008)가 함께 쓰는
// "컨텍스트 A에서 발급한 복구 코드로 컨텍스트 B가 복구" 앞부분. 실제 apps/api(wrangler dev --local)에
// 붙는다 — E2E_WITH_API=1일 때만 쓴다.
import { expect, type Page } from '@playwright/test';

/** 온보딩 → SCR-002~004 → KICKOFF → 복구 코드 발급 → "저장했어요" → SCR-007 계열 도착까지. */
export async function createCareerAndIssueRecoveryCode(pageA: Page): Promise<{ codeText: string }> {
  await pageA.goto('/onboarding');
  await pageA.getByRole('button', { name: '다음' }).click();
  await pageA.getByRole('button', { name: '다음' }).click();
  await pageA.getByRole('button', { name: 'KICKOFF' }).click();
  await expect(pageA).toHaveURL(/\/career\/.+\/create$/);

  await pageA.getByLabel('이름').fill('김서준');
  await pageA.getByRole('radio', { name: '남성' }).click();
  await pageA.getByLabel('국적').selectOption('KR');
  await pageA.getByRole('radio', { name: '왼발' }).click();
  await pageA.getByRole('tab', { name: '공격수' }).click();
  await pageA.getByRole('radio', { name: /윙어/ }).click();
  await pageA.getByRole('radio', { name: /클럽 아카데미/ }).click();
  await pageA.getByRole('button', { name: '다음' }).click();
  await expect(pageA).toHaveURL(/\/career\/.+\/style$/);

  await pageA.getByRole('radio', { name: '인사이드 포워드 선택' }).click();
  await pageA.getByRole('button', { name: '다음' }).click();
  await expect(pageA).toHaveURL(/\/career\/.+\/confirm$/);

  await pageA.getByRole('button', { name: 'KICKOFF' }).click();
  await expect(pageA).toHaveURL(/\/career\/.+\/confirm\?step=recovery$/);
  // 실제 서버로 확정 상태(revision 2)가 저장된 뒤에 코드를 발급해야 컨텍스트 B가 받는 GET이
  // 최신 상태를 돌려준다 — 디바운스된 PUT을 기다린다.
  await expect(pageA.getByText('저장됨')).toBeVisible({ timeout: 15_000 });

  const codeText = await pageA.getByText(/^OFS-/).innerText();
  expect(codeText).toMatch(/^OFS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);

  await pageA.getByRole('button', { name: '저장했어요' }).click();
  await expect(pageA).toHaveURL(/\/career\/.+\/(path|tryout|event)$/);

  return { codeText };
}

/** 설정에서 복구 코드를 입력해 컨텍스트 B가 같은 커리어를 되찾는다. 허브에 카드가 보일 때까지. */
export async function recoverProfile(pageB: Page, codeText: string): Promise<void> {
  await pageB.goto('/settings');
  // UX-003: 프로필 복구 폼은 기본 접힘이다 — Disclosure summary를 열어야 입력을 채울 수 있다.
  await pageB.getByText('프로필 복구', { exact: true }).click();
  await pageB.getByLabel('다른 기기에서 발급받은 복구 코드').fill(codeText);
  await pageB.getByRole('button', { name: '복구' }).click();

  await expect(pageB.getByText(/프로필을 복구했습니다\. 커리어 \d+개/)).toBeVisible({ timeout: 15_000 });
  await expect(pageB).toHaveURL(/\/$/, { timeout: 15_000 });
  await expect(pageB.getByRole('heading', { level: 2, name: '김서준' })).toBeVisible();
}

/**
 * 지금 뜬 이벤트 화면(SCR-007·008·013 공통 본문)에서 선택지를 확정하고 결과 화면에서 "다음"까지
 * 눌러 한 단계 진행시킨다(실제 api 동기화를 기다린다). `pickLast`가 true면 마지막 선택지를 고른다 —
 * TEST-E2E-008에서 A·B가 같은 pending 이벤트를 서로 다르게 골라야 재생 가능한(fast-forward)
 * 동일 stateHash가 아니라 진짜 충돌(409)이 난다.
 */
export async function advanceOneStep(page: Page, options?: { pickLast?: boolean }): Promise<void> {
  await page.waitForURL(/\/career\/.+\/(path|tryout|event)$/);
  const radios = page.getByRole('radio');
  const choice = options?.pickLast === true ? radios.last() : radios.first();
  await choice.click();
  await page.getByRole('button', { name: '확정' }).click();

  await expect(page).toHaveURL(/\/event\/result\?rev=\d+$/);
  await page.getByRole('button', { name: '다음' }).click();
}
