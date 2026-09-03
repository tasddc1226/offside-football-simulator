// create.spec.ts·first-contract.spec.ts·resilience.spec.ts·session-length.spec.ts가 함께 쓰는 온보딩
// → SCR-002~004 → 이벤트 화면 도착 흐름. T-1-014에서 create.spec.ts·first-contract.spec.ts의 중복
// 정의를 이 파일로 뽑았다(브리프: "헬퍼 추출은 허용"). 기존 스펙의 동작·검증 내용은 바꾸지 않았다.
import { expect, type Page, type Route } from '@playwright/test';

export const META = { requestId: 'e2e-req' };

export async function fulfillJson(route: Route, status: number, body: unknown): Promise<void> {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

/** 온보딩 → KICKOFF로 SCR-002(선수 정보 입력)까지 이동한다. */
export async function startNewCareer(page: Page): Promise<void> {
  await page.goto('/onboarding');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: 'KICKOFF' }).click();
  await expect(page).toHaveURL(/\/career\/.+\/create$/);
}

/** SCR-002의 6개 필드(성별·선호 포지션 포함, PR #32/T-1-016)를 채운다. */
export async function fillPlayerInfo(page: Page, name = '김서준'): Promise<void> {
  await page.getByLabel('이름').fill(name);
  await page.getByRole('radio', { name: '남성' }).click();
  await page.getByLabel('국적').selectOption('KR');
  await page.getByRole('radio', { name: '왼발' }).click();
  await page.getByRole('tab', { name: '공격수' }).click();
  await page.getByRole('radio', { name: /윙어/ }).click();
  await page.getByRole('radio', { name: /클럽 아카데미/ }).click();
}

/** SCR-002 입력 → SCR-003 스타일 선택 → SCR-004 확인 화면 도착까지. */
export async function goToConfirm(page: Page): Promise<void> {
  await startNewCareer(page);
  await fillPlayerInfo(page);
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page).toHaveURL(/\/career\/.+\/style$/);

  await page.getByRole('radio', { name: '인사이드 포워드 선택' }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page).toHaveURL(/\/career\/.+\/confirm$/);
  await expect(page.getByRole('heading', { level: 1, name: '확정 전 정보를 확인하세요' })).toBeVisible();
}

/**
 * 온보딩 → KICKOFF → SCR-002 입력 → SCR-003 스타일 선택 → SCR-004 확정(복구 코드 발급 실패로
 * 스텁 → "계속") → SCR-007/008/013 계열 도착까지. first-contract.spec.ts의 원래 정의와 동일하다.
 */
export async function completeOnboardingAndConfirm(page: Page): Promise<void> {
  await goToConfirm(page);

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
 * 거쳐 "다음"으로 넘어간다. 선택지 자체(어떤 라벨인지)는 보지 않는다. */
export async function resolveCurrentEventScreen(page: Page): Promise<void> {
  await page.getByRole('radio').first().click();
  await page.getByRole('button', { name: '확정' }).click();

  await expect(page).toHaveURL(/\/event\/result\?rev=\d+$/);
  await page.getByRole('button', { name: '다음' }).click();
}

/** OFFERS(SCR-009)에 도착할 때까지 이벤트 화면을 반복해서 넘긴다. 안전 상한 10회. */
export async function advanceUntilOffers(page: Page): Promise<void> {
  for (let step = 0; step < 10; step += 1) {
    await page.waitForURL(/\/career\/.+\/(path|tryout|event|offers)$/);
    if (new URL(page.url()).pathname.endsWith('/offers')) return;
    await resolveCurrentEventScreen(page);
  }
  throw new Error('offers 화면에 도달하지 못했다(최대 10회 시도)');
}

/** SCR-009(제안 비교)에서 첫 제안을 골라 SCR-010(계약)에서 사인한다. 대시보드(SCR-029)로
 * 돌아온다(T-2-007: first-contract.spec.ts 원래 정의에서 뽑았다, season.spec.ts와 공유). */
export async function signFirstOffer(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { level: 1, name: '제안 비교' })).toBeVisible();
  await page.getByRole('link', { name: '이 제안 보기' }).first().click();

  await expect(page).toHaveURL(/\/career\/.+\/contract\?offerId=.+$/);
  await page.getByRole('button', { name: '사인' }).click();

  await expect(page).toHaveURL(/\/career\/[^/]+$/);
  await expect(page.getByText('계약을 맺었습니다')).toBeVisible();
}

/** 온보딩부터 첫 프로 계약 체결까지(대시보드 도착) 전 구간. first-contract.spec.ts·season.spec.ts가
 * 공유한다. */
export async function completeOnboardingThroughContract(page: Page): Promise<void> {
  await completeOnboardingAndConfirm(page);
  await advanceUntilOffers(page);
  await signFirstOffer(page);
}

/** SCR-029의 "프리시즌 계획" CTA에서 SCR-005 입력·SCR-011 확인까지: 모드·훈련 계획을 고르고
 * search 파라미터로 넘어가는지 확인한다. T-2-009: season.spec.ts에서 뽑아 season-result.spec.ts·
 * a11y.spec.ts와 공유한다. */
export async function planPreseason(page: Page, mode: 'FAST' | 'CHAPTER', modeLabel: string, focusLabel: string): Promise<void> {
  await page.getByRole('link', { name: '계획하러 가기' }).click();
  await expect(page).toHaveURL(/\/career\/.+\/preseason$/);
  await expect(page.getByRole('heading', { level: 1, name: '프리시즌 계획' })).toBeVisible();

  await page.getByRole('radio', { name: new RegExp(`^${modeLabel}`) }).click();
  await page.getByRole('radio', { name: new RegExp(`^${focusLabel}`) }).click();
  await page.getByRole('link', { name: '다음' }).click();

  await expect(page).toHaveURL(/\/career\/.+\/season-prep\b/);
  const url = new URL(page.url());
  expect(url.searchParams.get('mode')).toBe(mode);
  await expect(page.getByRole('heading', { level: 1, name: '시즌 준비' })).toBeVisible();
  // SCR-011 인수 조건: "시즌 중 적용" vs "시즌 결산 때 능력에 반영"으로 즉시/시즌 결산 효과를 구분한다.
  await expect(page.getByText('(시즌 중 적용)')).toBeVisible();
  await expect(page.getByText('(시즌 결산 때 능력에 반영, 다음 시즌부터 체감)')).toBeVisible();
}

/** SCR-012: proposal.type이 KEEP("확인")이든 POSITION_CHANGE·ROLE_CHANGE("수락")든 승낙한다
 * (RULE-TIME-002: 시즌 step 1은 항상 ROLE_PROPOSAL). */
export async function resolveRoleProposal(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/career\/.+\/role$/);
  // 두 버튼 중 하나만 렌더된다 — 렌더 전에 count()로 미리 갈라 타면(둘 다 아직 없을 때) 잘못된
  // 쪽을 기다리다 타임아웃 날 수 있어, 정규식 하나로 묶어 실제로 뜨는 쪽을 기다린다.
  await page.getByRole('button', { name: /^(확인|수락)$/ }).click();
}

/** SCR-029에서 "진행"을 반복해(CHAPTER·CONTRACT 자동 통과 슬롯) SETTLEMENT("결산하기")까지
 * 도달한다. 안전 상한 20회. */
export async function advanceThroughSeasonToSettlement(page: Page): Promise<void> {
  // "진행"과 "결산하기"를 하나의 locator로 묶는다 — advance 뒤 이 버튼이 통째로 다른 Card로
  // 바뀔 수 있어(NextDecisionCard 분기), 클릭 직후 곧장 같은(이제 사라진) "진행" locator를 다시
  // 기다리면 detach 경합이 난다. 매번 이 locator를 다시 질의해 disabled(mutateAsync 진행 중)가
  // 풀릴 때까지 기다린 뒤 현재 라벨을 읽는다.
  const nextButton = page.getByRole('button', { name: /^(진행|결산하기)$/ });
  for (let step = 0; step < 20; step += 1) {
    const pathname = new URL(page.url()).pathname;
    if (/\/(event|path|tryout)$/.test(pathname)) {
      await resolveCurrentEventScreen(page);
      continue;
    }
    await expect(nextButton).toBeEnabled();
    if ((await nextButton.textContent()) === '결산하기') return;
    await nextButton.click();
    await expect(nextButton).toBeEnabled();
  }
  throw new Error('SETTLEMENT(결산하기)에 도달하지 못했다(최대 20회 시도)');
}
