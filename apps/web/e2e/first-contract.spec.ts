// TEST-E2E(08 문서): 온보딩 → SCR-002/003/004 → KICKOFF → SCR-007/008/013(반복) → SCR-014 →
// SCR-009 → SCR-010 → SCR-029 전 구간.
//
// CONFIRM_PLAYER 직후 FAST 모드는 곧장 SETTLEMENT 단계(step 고정)로 진입해, 그 안에서 프로 계약
// 전 서사 이벤트(EVT-CON-002·003 및 상시 조건의 EVT-REL-001 등)가 도메인 가중 랜덤으로 몇 차례
// 뜨고 소진된 뒤에야 제안(OFFERS)이 열린다. 그래서 특정 이벤트·화면을 고정하지 않고, "이벤트 화면
// (SCR-007/008/013)이면 첫 선택지를 확정하고 결과를 다음으로 넘긴다"를 offers 도착까지 반복한다.
import { expect, test } from '@playwright/test';
import { advanceUntilOffers, completeOnboardingAndConfirm } from './helpers/player-creation.js';

// SCR-008 입단 테스트의 진행 연출(Stepper)을 건너뛰어 결정론적으로 만든다 — useReducedMotion()이
// OS 미디어쿼리(SYSTEM 기본값)를 구독하므로, 브라우저 컨텍스트 자체를 reduced-motion으로 연다.
// reducedMotion은 PlaywrightTestOptions 최상위가 아니라 BrowserContextOptions에 있다(contextOptions로 감싸야 한다).
test.use({ contextOptions: { reducedMotion: 'reduce' } });

test('온보딩부터 계약·대시보드까지: SCR-002~004 → 이벤트 → SCR-009 → SCR-010 → SCR-029', async ({ page }) => {
  const startedAt = Date.now();

  await completeOnboardingAndConfirm(page);
  await advanceUntilOffers(page);

  await expect(page.getByRole('heading', { level: 1, name: '제안 비교' })).toBeVisible();
  await page.getByRole('link', { name: '이 제안 보기' }).first().click();

  await expect(page).toHaveURL(/\/career\/.+\/contract\?offerId=.+$/);
  await page.getByRole('button', { name: '사인' }).click();

  await expect(page).toHaveURL(/\/career\/[^/]+$/);
  await expect(page.getByText('계약을 맺었습니다')).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: '김서준' })).toBeVisible();
  // 계약 후에만 열리는 전술 적합도·감독 신뢰(06 "점진적 공개")가 보이면 계약이 실제로 반영된 것이다.
  await expect(page.getByText('전술 적합도')).toBeVisible();

  await page.getByRole('tab', { name: '휴대폰' }).click();
  await expect(page.getByText('팀')).toBeVisible();
  await expect(page.getByText('주급')).toBeVisible();

  const elapsedMs = Date.now() - startedAt;
  console.log(`[first-contract] 온보딩→계약·대시보드 소요 시간: ${elapsedMs}ms`);
  expect(elapsedMs).toBeLessThan(5 * 60 * 1000);
});
