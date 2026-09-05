// T-2-016: staging 리허설 자동화. 오케스트레이터가 U-016 준비 때 임시로 돌리던 예행(온보딩 → 선수
// 생성 → 첫 계약 → FAST 시즌 완주 → 시즌 결산, `/onboarding` LINE TEST 안내 확인)을 커밋해 누구나
// `pnpm --filter @offside/web e2e:staging`으로 실제 staging에 대해 재실행할 수 있게 한다.
// `playwright.staging.config.ts`로만 실행되며(testMatch), 기본 `pnpm e2e`에는 포함되지 않는다
// (`playwright.config.ts`의 testIgnore). 실제 staging에 커리어·복구 코드·분석 이벤트가 남으므로
// 실행 전 apps/web/e2e/README.md "staging 리허설" 절의 정리 절차를 확인한다.
//
// 네트워크를 스텁하지 않는다 — `helpers/recovery.ts`(실 api 전용, E2E_WITH_API 모드에서 이미 쓰인다)와
// `helpers/player-creation.ts`의 스텁 없는 헬퍼만 재사용한다. 온보딩 확정 흐름을 503 스텁으로 우회하는
// `helpers/player-creation.ts`의 completeOnboardingAndConfirm/completeOnboardingThroughContract는
// staging에서 실제 응답을 왜곡하므로 쓰지 않는다.
import { expect, test } from '@playwright/test';
import { createCareerAndIssueRecoveryCode } from './helpers/recovery.js';
import {
  advanceThroughSeasonToSettlement,
  advanceUntilOffers,
  planPreseason,
  resolveRoleProposal,
  signFirstOffer,
} from './helpers/player-creation.js';

test('staging 리허설: 온보딩 → 선수 생성 → 첫 계약 → FAST 시즌 완주 → 결산', async ({ page }, testInfo) => {
  test.slow();
  const startedAt = Date.now();
  let deviceId: string | undefined;

  page.on('request', (request) => {
    if (request.method() !== 'POST' || !request.url().includes('/v1/analytics/events')) return;
    try {
      const body = JSON.parse(request.postData() ?? '{}') as { clientId?: unknown };
      if (!deviceId && typeof body.clientId === 'string') deviceId = body.clientId;
    } catch {
      // 분석 배치 본문 파싱 실패는 무시한다 — deviceId는 진단용이라 테스트를 막지 않는다.
    }
  });

  // (a) 새 기기 → 온보딩. 커리어가 없는 새 브라우저 컨텍스트는 SCR-034(온보딩)로 리다이렉트된다.
  await page.goto('/');
  await page.waitForURL(/\/(onboarding)?$/);
  const landedPath = new URL(page.url()).pathname;
  console.log('[rehearsal] fresh device landed on', landedPath);

  // (b) /onboarding에 LINE TEST 안내 문구(첫 슬라이드에서만 노출).
  if (landedPath === '/onboarding') {
    await expect(page.getByTestId('onboarding-service-season-notice')).toContainText('LINE TEST');
    console.log('[rehearsal] onboarding LINE TEST notice visible');
  }

  const { codeText } = await createCareerAndIssueRecoveryCode(page);
  const careerId = new URL(page.url()).pathname.match(/^\/career\/([^/]+)\//)?.[1] ?? 'unknown';
  console.log(`[rehearsal] careerId=${careerId} recoveryCode=${codeText}`);

  // 선수 생성 → 진로 → 입단 테스트 → 첫 계약.
  await advanceUntilOffers(page);
  await signFirstOffer(page);
  console.log(`[rehearsal] contract signed at ${Date.now() - startedAt}ms`);

  // FAST 시즌 완주 → 결산 화면.
  await planPreseason(page, 'FAST', '빠른 시즌', '역할 집중');
  await page.getByRole('button', { name: '시즌 시작' }).click();
  await resolveRoleProposal(page);
  await expect(page).toHaveURL(/\/career\/[^/]+$/);
  await expect(page.getByText(/시즌 1 · .* · step 1\/12/)).toBeVisible();

  await advanceThroughSeasonToSettlement(page);
  await page.getByRole('button', { name: '결산하기' }).click();
  await expect(page).toHaveURL(/\/career\/.+\/season-result$/);
  await expect(page.getByRole('heading', { level: 1, name: '프로 시즌 결과' })).toBeVisible();
  console.log(`[rehearsal] season settled at ${Date.now() - startedAt}ms`);

  // 분석 큐(10초 타이머 또는 20건)가 최소 한 번 flush될 시간을 준다 — deviceId 확보용, assert는 걸지 않는다.
  await page.waitForTimeout(12_000);
  console.log(`[rehearsal] deviceId(clientId)=${deviceId ?? '(미확보)'}`);

  // (c) 오케스트레이터가 D1 synthetic 행을 정리할 수 있도록 careerId·deviceId를 attachment로 남긴다.
  await testInfo.attach('rehearsal-ids', {
    body: JSON.stringify({ careerId, recoveryCode: codeText, deviceId: deviceId ?? null }, null, 2),
    contentType: 'application/json',
  });

  console.log(`[rehearsal] total elapsed ${Date.now() - startedAt}ms`);
});

test('staging 리허설: /onboarding 첫 슬라이드 LINE TEST 안내(T-2-015)', async ({ page }) => {
  await page.goto('/onboarding');
  await expect(page.getByTestId('onboarding-service-season-notice')).toContainText('LINE TEST', { timeout: 15_000 });
  console.log('[rehearsal] onboarding notice:', await page.getByTestId('onboarding-service-season-notice').innerText());
});
