// recovery-api.spec.ts(T-1-012)·recovery-conflict.spec.ts(T-1-014, TEST-E2E-008)가 함께 쓰는
// "컨텍스트 A에서 발급한 복구 코드로 컨텍스트 B가 복구" 앞부분. 실제 apps/api(wrangler dev --local)에
// 붙는다 — E2E_WITH_API=1일 때만 쓴다.
import { expect, type Page } from '@playwright/test';
import { goToConfirm } from './player-creation.js';
import { expectRoute, waitForRoute } from './route.js';

/** 온보딩 → SCR-002~004 → KICKOFF → SCR-007 계열 → 설정에서 복구 코드 발급 → 원래 결정 복귀. */
export async function createCareerAndIssueRecoveryCode(pageA: Page): Promise<{ codeText: string }> {
  await goToConfirm(pageA);

  await pageA.getByRole('button', { name: /이 선수로 시작/ }).click();
  await expectRoute(pageA, /\/career\/.+\/(path|tryout|event)$/);
  const decisionUrl = pageA.url();
  // 실제 서버로 확정 상태(revision 2)가 저장된 뒤 설정에서 코드를 발급해야 컨텍스트 B가 받는 GET이
  // 최신 상태를 돌려준다 — 디바운스된 PUT을 기다린다. 온보딩이 코드를 막지 않더라도 설정 접근은
  // 그대로 보존돼야 한다.
  await expect(pageA.getByText('저장됨')).toBeVisible({ timeout: 15_000 });

  await pageA.goto('/settings');
  await pageA.getByText('계정 상세', { exact: true }).click();
  await pageA.getByRole('button', { name: '발급', exact: true }).click();
  await expect(pageA.getByRole('heading', { level: 2, name: '복구 코드' })).toBeVisible();
  const codeText = await pageA.getByText(/^OFS-/).innerText();
  expect(codeText).toMatch(/^OFS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);

  await pageA.getByRole('button', { name: '적어 두었습니다' }).click();
  await pageA.goto(decisionUrl);
  await expectRoute(pageA, /\/career\/.+\/(path|tryout|event)$/);

  return { codeText };
}

/** 설정에서 복구 코드를 입력해 컨텍스트 B가 같은 커리어를 되찾는다. 허브에 카드가 보일 때까지. */
export async function recoverProfile(pageB: Page, codeText: string): Promise<void> {
  await pageB.goto('/settings');
  // UX-013: 프로필 복구 폼은 계정 카드의 "계정 상세" 접이식 안에 다시 접혀 있다 — 둘 다 열어야
  // 입력을 채울 수 있다.
  await pageB.getByText('계정 상세', { exact: true }).click();
  await pageB.getByText('프로필 복구', { exact: true }).click();
  await pageB.getByLabel('다른 기기에서 발급받은 복구 코드').fill(codeText);
  await pageB.getByRole('button', { name: '복구' }).click();

  await expect(pageB.getByText(/프로필을 복구했습니다\. 커리어 \d+개/)).toBeVisible({
    timeout: 15_000,
  });
  await expectRoute(pageB, /\/$/, { timeout: 15_000 });
  await expect(pageB.getByRole('heading', { level: 2, name: '김서준' })).toBeVisible();
}

/**
 * 지금 뜬 이벤트 화면(SCR-007·008·013 공통 본문)에서 선택지를 확정하고 결과 화면에서 "다음"까지
 * 눌러 한 단계 진행시킨다(실제 api 동기화를 기다린다). `pickLast`가 true면 마지막 선택지를 고른다 —
 * TEST-E2E-008에서 A·B가 같은 pending 이벤트를 서로 다르게 골라야 재생 가능한(fast-forward)
 * 동일 stateHash가 아니라 진짜 충돌(409)이 난다.
 */
export async function advanceOneStep(page: Page, options?: { pickLast?: boolean }): Promise<void> {
  await waitForRoute(page, /\/career\/.+\/(path|tryout|event)$/);
  const radios = page.getByRole('radio');
  const choice = options?.pickLast === true ? radios.last() : radios.first();
  await choice.click();
  await page.getByRole('button', { name: '확정' }).click();

  await expectRoute(page, /\/event\/result\?rev=\d+$/);
  await page.getByRole('button', { name: '다음' }).click();
}
