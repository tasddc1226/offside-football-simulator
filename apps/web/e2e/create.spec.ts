// TEST-E2E(08 문서): 온보딩 KICKOFF → SCR-002 입력 → SCR-003 스타일 선택 → SCR-004 확정 →
// 복구 코드 발급(성공·실패 각각) → SCR-007 계열 도착.
//
// ADVANCE 직후 이벤트 선택은 도메인의 가중 랜덤(selectEligibleEvents가 후보 목록을 주고,
// 그중 하나를 domain이 weight로 고른다)이라 항상 EVT-CON-002(SCR-007)가 뽑힌다는 보장이 없다.
// 그래서 도착 지점은 screenForCareer가 매핑하는 SCR-007 계열 라우트(path·tryout·event) 중
// 하나인지로 검증한다.
import { expect, type Page, type Route, test } from '@playwright/test';

const META = { requestId: 'e2e-req' };

async function fulfillJson(route: Route, status: number, body: unknown): Promise<void> {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function startNewCareer(page: Page): Promise<void> {
  await page.goto('/onboarding');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: 'KICKOFF' }).click();
  await expect(page).toHaveURL(/\/career\/.+\/create$/);
}

async function fillPlayerInfo(page: Page, name = '김서준'): Promise<void> {
  await page.getByLabel('이름').fill(name);
  await page.getByRole('radio', { name: '남성' }).click();
  await page.getByLabel('국적').selectOption('KR');
  await page.getByRole('radio', { name: '왼발' }).click();
  await page.getByRole('tab', { name: '공격수' }).click();
  await page.getByRole('radio', { name: /윙어/ }).click();
  await page.getByRole('radio', { name: /클럽 아카데미/ }).click();
}

async function goToConfirm(page: Page): Promise<void> {
  await startNewCareer(page);
  await fillPlayerInfo(page);
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page).toHaveURL(/\/career\/.+\/style$/);

  await page.getByRole('radio', { name: '인사이드 포워드 선택' }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page).toHaveURL(/\/career\/.+\/confirm$/);
  await expect(page.getByRole('heading', { level: 1, name: '확정 전 정보를 확인하세요' })).toBeVisible();
}

test('SCR-002→003→004를 거쳐 복구 코드를 발급하고 SCR-007 계열로 도착한다', async ({ page }) => {
  await goToConfirm(page);

  await page.route('**/v1/profile', (route) =>
    fulfillJson(route, 200, {
      data: {
        id: 'prf_e2e',
        settings: { reducedMotion: 'SYSTEM', textScale: 100, theme: 'SYSTEM', defaultSimulationMode: 'FAST' },
        linked: { google: false, toss: false },
        recoveryCodeIssuedAt: null,
        createdAt: '2026-09-01T00:00:00Z',
      },
      meta: META,
    }),
  );
  await page.route('**/v1/profile/recovery-code', (route) =>
    fulfillJson(route, 200, { data: { code: 'OFS-ABCD-2345-EFGH', issuedAt: '2026-09-02T00:00:00Z' }, meta: META }),
  );

  await page.getByRole('button', { name: 'KICKOFF' }).click();

  await expect(page).toHaveURL(/\/career\/.+\/confirm\?step=recovery$/);
  await expect(page.getByRole('heading', { level: 1, name: '복구 코드를 저장하세요' })).toBeVisible();
  await expect(page.getByText('OFS-ABCD-2345-EFGH')).toBeVisible();

  await page.getByRole('button', { name: '저장했어요' }).click();

  await expect(page).toHaveURL(/\/career\/.+\/(path|tryout|event)$/);
});

test('복구 코드 발급이 실패해도 안내 후 계속 진행할 수 있다', async ({ page }) => {
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
});

test('SCR-002: 이름 길이 오류는 입력값을 보존하고 포커스를 이름 입력으로 되돌린다', async ({ page }) => {
  await startNewCareer(page);

  await fillPlayerInfo(page, '김');
  await page.getByRole('button', { name: '다음' }).click();

  await expect(page.getByText(/이름은 .+자여야 합니다\./)).toBeVisible();
  await expect(page.getByLabel('이름')).toBeFocused();
  await expect(page.getByLabel('이름')).toHaveValue('김');
});

test('SCR-002: 저장한 뒤 새로고침해도 draft가 그대로 보인다', async ({ page }) => {
  await startNewCareer(page);
  await fillPlayerInfo(page);
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page).toHaveURL(/\/career\/.+\/style$/);

  await page.getByRole('button', { name: '이전' }).click();
  await expect(page).toHaveURL(/\/career\/.+\/create$/);

  await page.reload();

  await expect(page.getByLabel('이름')).toHaveValue('김서준');
  await expect(page.getByLabel('국적')).toHaveValue('KR');
  await expect(page.getByRole('radio', { name: '왼발' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('radio', { name: /윙어/ })).toHaveAttribute('aria-checked', 'true');
});
