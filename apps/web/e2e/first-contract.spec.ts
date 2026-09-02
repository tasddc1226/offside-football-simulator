// TEST-E2E(08 문서): 온보딩 → SCR-002/003/004 → KICKOFF → SCR-007/008/013(반복) → SCR-014 →
// SCR-009 → SCR-010 → SCR-029 전 구간. T-1-008 병합 전에는 SCR-002~004가 자리표시라 보류했다.
//
// CONFIRM_PLAYER 직후 FAST 모드는 곧장 SETTLEMENT 단계(step 고정)로 진입해, 그 안에서 프로 계약
// 전 서사 이벤트(EVT-CON-002·003 및 상시 조건의 EVT-REL-001 등)가 도메인 가중 랜덤으로 몇 차례
// 뜨고 소진된 뒤에야 제안(OFFERS)이 열린다. 그래서 특정 이벤트·화면을 고정하지 않고, "이벤트 화면
// (SCR-007/008/013)이면 첫 선택지를 확정하고 결과를 다음으로 넘긴다"를 offers 도착까지 반복한다.
import { expect, type Page, type Route, test } from '@playwright/test';

// SCR-008 입단 테스트의 진행 연출(Stepper)을 건너뛰어 결정론적으로 만든다 — useReducedMotion()이
// OS 미디어쿼리(SYSTEM 기본값)를 구독하므로, 브라우저 컨텍스트 자체를 reduced-motion으로 연다.
// reducedMotion은 PlaywrightTestOptions 최상위가 아니라 BrowserContextOptions에 있다(contextOptions로 감싸야 한다).
test.use({ contextOptions: { reducedMotion: 'reduce' } });

const META = { requestId: 'e2e-req' };

async function fulfillJson(route: Route, status: number, body: unknown): Promise<void> {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

/** 온보딩 → KICKOFF → SCR-002 입력 → SCR-003 스타일 선택 → SCR-004 확정(복구 코드 발급 실패로
 * 스텁 → "계속") → SCR-007/008/013 계열 도착까지. create.spec.ts와 같은 흐름을 재사용한다. */
async function completeOnboardingAndConfirm(page: Page): Promise<void> {
  await page.goto('/onboarding');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: 'KICKOFF' }).click();
  await expect(page).toHaveURL(/\/career\/.+\/create$/);

  await page.getByLabel('이름').fill('김서준');
  await page.getByLabel('국적').selectOption('KR');
  await page.getByRole('radio', { name: '왼발' }).click();
  await page.getByRole('tab', { name: '공격수' }).click();
  await page.getByRole('radio', { name: /윙어/ }).click();
  await page.getByRole('radio', { name: /클럽 아카데미/ }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page).toHaveURL(/\/career\/.+\/style$/);

  await page.getByRole('radio', { name: '인사이드 포워드 선택' }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page).toHaveURL(/\/career\/.+\/confirm$/);
  await expect(page.getByRole('heading', { level: 1, name: '확정 전 정보를 확인하세요' })).toBeVisible();

  await page.route('**/v1/profile', (route) =>
    fulfillJson(route, 503, {
      error: { code: 'SERVICE_UNAVAILABLE', message: '서비스를 이용할 수 없습니다.', retryable: true },
      meta: META,
    }),
  );
  await page.getByRole('button', { name: 'KICKOFF' }).click();
  await expect(page.getByText('지금은 발급할 수 없습니다. 설정에서 나중에 발급할 수 있습니다.')).toBeVisible();
  await page.getByRole('button', { name: '계속' }).click();

  await expect(page).toHaveURL(/\/career\/.+\/(path|tryout|event)$/);
}

/** 지금 뜬 이벤트 화면(SCR-007·008·013 공통 본문)에서 첫 선택지를 확정하고, SCR-014 결과 카드를
 * 거쳐 "다음"으로 넘어간다. 선택지 자체(어떤 라벨인지)는 보지 않는다 — 화면마다 다른 서사이기
 * 때문에 흐름(라디오 선택 → 확정 → 결과 → 다음)만 검증한다. */
async function resolveCurrentEventScreen(page: Page): Promise<void> {
  await page.getByRole('radio').first().click();
  await page.getByRole('button', { name: '확정' }).click();

  await expect(page).toHaveURL(/\/event\/result\?rev=\d+$/);
  await page.getByRole('button', { name: '다음' }).click();
}

/** OFFERS(SCR-009)에 도착할 때까지 이벤트 화면을 반복해서 넘긴다. 어떤 이벤트가 몇 번 뜨는지는
 * 도메인 가중 랜덤·태그 매칭에 달려 있어 고정하지 않고, 안전 상한만 둔다(콘텐츠 팩 0.1.0의
 * 유스 단계 이벤트는 10종을 넘지 않는다 — 08 "확정 조건" 참고). */
async function advanceUntilOffers(page: Page): Promise<void> {
  for (let step = 0; step < 10; step += 1) {
    await page.waitForURL(/\/career\/.+\/(path|tryout|event|offers)$/);
    if (new URL(page.url()).pathname.endsWith('/offers')) return;
    await resolveCurrentEventScreen(page);
  }
  throw new Error('offers 화면에 도달하지 못했다(최대 10회 시도)');
}

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
