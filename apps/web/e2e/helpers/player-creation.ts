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
