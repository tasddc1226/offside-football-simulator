// TEST-E2E(08 문서): 온보딩 KICKOFF → SCR-002 입력 → SCR-003 스타일 선택 → SCR-004 확정 →
// 복구 API로 막히지 않고 SCR-007 계열 도착.
//
// ADVANCE 직후 이벤트 선택은 도메인의 가중 랜덤(selectEligibleEvents가 후보 목록을 주고,
// 그중 하나를 domain이 weight로 고른다)이라 항상 EVT-CON-002(SCR-007)가 뽑힌다는 보장이 없다.
// 그래서 도착 지점은 screenForCareer가 매핑하는 SCR-007 계열 라우트(path·tryout·event) 중
// 하나인지로 검증한다.
import { expect, test } from '@playwright/test';
import {
  fillPlayerInfo,
  fulfillJson,
  goToConfirm,
  META,
  startNewCareer,
} from './helpers/player-creation.js';

test('SCR-002→003→004 KICKOFF는 복구 API를 호출하지 않고 SCR-007 계열로 도착한다', async ({
  page,
}) => {
  await goToConfirm(page);

  let profileCalls = 0;
  let recoveryCodeCalls = 0;
  await page.route('**/v1/profile', (route) => {
    profileCalls += 1;
    return fulfillJson(route, 200, {
      data: {
        id: 'prf_e2e',
        settings: {
          reducedMotion: 'SYSTEM',
          textScale: 100,
          theme: 'SYSTEM',
          defaultSimulationMode: 'FAST',
        },
        linked: { google: false, toss: false },
        recoveryCodeIssuedAt: null,
        createdAt: '2026-09-01T00:00:00Z',
      },
      meta: META,
    });
  });
  await page.route('**/v1/profile/recovery-code', (route) => {
    recoveryCodeCalls += 1;
    return fulfillJson(route, 200, {
      data: { code: 'OFS-ABCD-2345-EFGH', issuedAt: '2026-09-02T00:00:00Z' },
      meta: META,
    });
  });

  await page.getByRole('button', { name: 'KICKOFF' }).click();

  await expect(page).toHaveURL(/\/career\/.+\/(path|tryout|event)$/);
  expect(profileCalls).toBe(0);
  expect(recoveryCodeCalls).toBe(0);
  await expect(page.getByRole('heading', { level: 1, name: '복구 코드를 저장하세요' })).toHaveCount(
    0,
  );
});

test('프로필 API 실패 스텁이 있어도 KICKOFF 직후 흐름은 막히지 않는다', async ({ page }) => {
  await goToConfirm(page);

  await page.route('**/v1/profile', (route) =>
    fulfillJson(route, 503, {
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: '서비스를 이용할 수 없습니다.',
        retryable: true,
      },
      meta: META,
    }),
  );

  await page.getByRole('button', { name: 'KICKOFF' }).click();

  await expect(page).toHaveURL(/\/career\/.+\/(path|tryout|event)$/);
  await expect(
    page.getByText('지금은 발급할 수 없습니다. 설정에서 나중에 발급할 수 있습니다.'),
  ).toHaveCount(0);
});

test('SCR-002: 이름 길이 오류는 입력값을 보존하고 포커스를 이름 입력으로 되돌린다', async ({
  page,
}) => {
  // fillPlayerInfo는 패널 1(정체성) 제출까지 정상 통과를 전제하므로, 여기서는 짧은 이름이
  // validateCurrentPanel을 막아 패널 2로 넘어가지 못하는 상황을 직접 재현한다.
  await startNewCareer(page);
  await page.getByRole('radio', { name: /아카데미의 추가 평가/ }).click();
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await page.getByRole('textbox', { name: '이름', exact: true }).fill('김');
  await page.getByRole('radio', { name: '남성' }).click();
  await page.getByLabel('국적').selectOption('KR');
  await page.getByRole('radio', { name: '왼발' }).click();
  await page.getByRole('button', { name: '다음', exact: true }).click();

  await expect(page.getByText(/이름은 .+자여야 합니다\./)).toBeVisible();
  await expect(page.getByLabel('이름')).toBeFocused();
  await expect(page.getByLabel('이름')).toHaveValue('김');
});

test('SCR-002: 저장한 뒤 새로고침해도 draft가 그대로 보인다', async ({ page }) => {
  await startNewCareer(page);
  await fillPlayerInfo(page);
  await expect(page.getByRole('status')).toContainText('아직 저장하지 않은 변경사항');
  await page.getByRole('button', { name: '플레이 스타일 고르기' }).click();
  await expect(page).toHaveURL(/\/career\/.+\/style$/);

  await page.getByRole('button', { name: '이전' }).click();
  await expect(page).toHaveURL(/\/career\/.+\/create$/);

  await page.reload();

  // handleNext가 "플레이 스타일 고르기" 클릭 시 모든 필드를 도메인 draft로 커밋하고 세션 scratch를
  // 지운다 — "이전"으로 되돌아와 새로고침하면 세션 scratch가 없으니 패널은 0(첫 출발점)부터 다시
  // 보이지만, 각 필드 값은 도메인 draft에서 그대로 복원된다(hasUnsavedChanges가 false가 된다).
  await expect(page.getByRole('radio', { name: /아카데미의 추가 평가/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await expect(page.getByLabel('이름')).toHaveValue('김서준');
  await expect(page.getByLabel('국적')).toHaveValue('KR');
  await expect(page.getByRole('radio', { name: '왼발' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await expect(page.getByRole('radio', { name: /윙어/ })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('status')).not.toContainText('아직 저장하지 않은 변경사항');
});
