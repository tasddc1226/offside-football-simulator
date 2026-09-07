// TEST-E2E-007(08 문서): 새로고침·응답 유실·중복 클릭 복구. FR-SAV-001. 스텁 API.
import { expect, test } from '@playwright/test';
import {
  fillPlayerInfo,
  fulfillJson,
  goToConfirm,
  META,
  startNewCareer,
} from './helpers/player-creation.js';

test('(a) 새로고침: SCR-002 draft가 복원되고, SCR-004 확정 뒤에는 이벤트 화면이 그대로 보인다', async ({ page }) => {
  await startNewCareer(page);
  await fillPlayerInfo(page);
  await page.getByRole('button', { name: '플레이 스타일 고르기' }).click();
  await expect(page).toHaveURL(/\/career\/.+\/style$/);

  // UPDATE_PLAYER_DRAFT가 저장한 값이 "이전"으로 되돌아간 SCR-002에서 새로고침해도 그대로 있다.
  // "플레이 스타일 고르기"가 모든 필드를 도메인 draft로 커밋하며 세션 scratch를 지우므로, 새로고침
  // 직후에는 패널 0(첫 출발점)부터 다시 보이지만 값은 도메인 draft에서 그대로 복원된다 — "다음"으로
  // 패널을 다시 넘기며 각 패널의 값이 그대로 있는지 확인한다.
  await page.getByRole('button', { name: '이전' }).click();
  await expect(page).toHaveURL(/\/career\/.+\/create$/);
  await page.reload();

  await expect(page.getByRole('radio', { name: /아카데미의 추가 평가/ })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: '다음', exact: true }).click();

  await expect(page.getByLabel('이름')).toHaveValue('김서준');
  await expect(page.getByLabel('국적')).toHaveValue('KR');
  await expect(page.getByRole('radio', { name: '왼발' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: '다음', exact: true }).click();

  await expect(page.getByRole('radio', { name: /윙어/ })).toHaveAttribute('aria-checked', 'true');

  // SCR-004까지 마저 진행해 확정한다.
  await page.getByRole('button', { name: '플레이 스타일 고르기' }).click();
  await expect(page).toHaveURL(/\/career\/.+\/style$/);
  await page.getByRole('radio', { name: '인사이드 포워드 선택' }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page).toHaveURL(/\/career\/.+\/confirm$/);

  await page.route('**/v1/profile', (route) =>
    fulfillJson(route, 503, {
      error: { code: 'SERVICE_UNAVAILABLE', message: '서비스를 이용할 수 없습니다.', retryable: true },
      meta: META,
    }),
  );
  await page.getByRole('button', { name: 'KICKOFF' }).click();
  // KICKOFF는 곧장 이벤트 화면으로 가지 않고 먼저 `confirm?step=recovery`로 전환해 발급 실패
  // 배너를 보여준다 — 그 전환·렌더가 끝나길 기다리지 않고 곧장 "계속"을 누르면 아직 이전 화면에
  // 남아 있는 다른 요소를 클릭하게 될 수 있다(player-creation.ts의 completeOnboardingAndConfirm과
  // 같은 동기화점).
  await expect(
    page.getByText('지금은 발급할 수 없습니다. 설정에서 나중에 발급할 수 있습니다.'),
  ).toBeVisible();
  await page.getByRole('button', { name: '계속' }).click();
  await expect(page).toHaveURL(/\/career\/.+\/(path|tryout|event)$/);

  const eventUrl = page.url();
  await page.reload();

  await expect(page).toHaveURL(eventUrl);
  await expect(page.getByRole('radio').first()).toBeVisible();
  await expect(page.getByRole('button', { name: '확정' })).toBeVisible();
});

test('(b) 확정 버튼을 두 번 클릭해도 revision은 정확히 2(CONFIRM_PLAYER+ADVANCE)만 증가하고 카드는 하나다', async ({
  page,
}) => {
  await page.route('**/v1/careers/**', async (route) => {
    if (route.request().method() === 'PUT') {
      await fulfillJson(route, 200, { data: { revision: 1, syncedAt: '2026-09-03T00:00:00Z' }, meta: META });
      return;
    }
    await route.continue();
  });
  await page.route('**/v1/profile', (route) =>
    fulfillJson(route, 503, {
      error: { code: 'SERVICE_UNAVAILABLE', message: '서비스를 이용할 수 없습니다.', retryable: true },
      meta: META,
    }),
  );

  await goToConfirm(page);

  await page.goto('/');
  const card = page.getByTestId('career-card');
  await expect(card).toHaveCount(1);
  const revisionBefore = Number(await card.getAttribute('data-revision'));

  await page.getByRole('button', { name: '이어하기' }).click();
  await expect(page).toHaveURL(/\/career\/.+\/confirm$/);

  const kickoff = page.getByRole('button', { name: 'KICKOFF' });
  await Promise.all([kickoff.click({ timeout: 2000 }).catch(() => {}), kickoff.click({ timeout: 2000 }).catch(() => {})]);

  // 확정(+ADVANCE)이 끝나야만 도착하는 화면까지 기다린다 — 둘 중 하나가 이겨도 결국 여기 온다.
  await expect(page).toHaveURL(/\/career\/.+\/(confirm\?step=recovery|path|tryout|event)$/, { timeout: 10_000 });

  await page.goto('/');
  await expect(page.getByTestId('career-card')).toHaveCount(1);
  const revisionAfter = Number(await page.getByTestId('career-card').getAttribute('data-revision'));
  expect(revisionAfter).toBe(revisionBefore + 2);
});

test('(c) PUT 유실: 첫 요청이 실패하면 "저장 다시 시도 중"이 보이고, 같은 Idempotency-Key로 재시도해 "저장됨"이 된다', async ({
  page,
}) => {
  let attempt = 0;
  const idempotencyKeys: string[] = [];
  await page.route('**/v1/careers/*', async (route) => {
    if (route.request().method() !== 'PUT') {
      await route.continue();
      return;
    }
    attempt += 1;
    idempotencyKeys.push(route.request().headers()['idempotency-key'] ?? '');
    if (attempt === 1) {
      await route.abort('failed');
      return;
    }
    await fulfillJson(route, 200, { data: { revision: 1, syncedAt: '2026-09-03T00:00:00Z' }, meta: META });
  });

  await startNewCareer(page);

  await expect(page.getByText('저장 다시 시도 중')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('저장됨')).toBeVisible({ timeout: 10_000 });

  expect(attempt).toBeGreaterThanOrEqual(2);
  expect(idempotencyKeys[0]).not.toBe('');
  expect(idempotencyKeys[1]).toBe(idempotencyKeys[0]);
});

test('(d) 명령 응답 대기 중(COMMITTING) 뒤로 가기: 재진입하면 확정 결과가 보인다', async ({ page }) => {
  // 이 테스트는 의도적으로 CDP CPU 스로틀링(rate 30)을 걸었다 풀었다 한다 — 병렬 워커로 실제
  // 머신 CPU를 나눠 쓰면 스로틀을 푼 뒤에도 백그라운드 확정 커맨드가 15s보다 오래 걸릴 수 있다
  // (관찰됨). season.spec.ts와 같은 이유로 test.slow()를 쓴다.
  test.slow();
  await page.route('**/v1/careers/**', async (route) => {
    if (route.request().method() === 'PUT') {
      await fulfillJson(route, 200, { data: { revision: 1, syncedAt: '2026-09-03T00:00:00Z' }, meta: META });
      return;
    }
    await route.continue();
  });
  await page.route('**/v1/profile', (route) =>
    fulfillJson(route, 503, {
      error: { code: 'SERVICE_UNAVAILABLE', message: '서비스를 이용할 수 없습니다.', retryable: true },
      meta: META,
    }),
  );

  await goToConfirm(page);

  // CPU를 강하게 스로틀링해 로컬 Worker 왕복(확정 처리)을 늘려, COMMITTING 화면을 안정적으로
  // 관찰할 시간을 확보한다(waitForTimeout 없이 상태 기반 대기만 쓴다 — CDP 스로틀은 perf.spec.ts와
  // 같은 기법이다).
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 30 });

  await page.getByRole('button', { name: 'KICKOFF' }).click();
  await expect(page.getByText('선수 카드를 등록하고 있습니다')).toBeVisible({ timeout: 10_000 });

  // T-1-017: COMMITTING 중 이탈 경고는 beforeunload(탭 닫기·새로고침·주소창 이동)만 연결하는 최소
  // 구현으로 남겼다 — popstate 기반 뒤로 가기 경고를 만들려면 더미 히스토리 항목이 필요한데, 그
  // 항목엔 TanStack Router(`@tanstack/history`)가 popstate 방향 계산에 쓰는 내부 키
  // `state.__TSR_index`가 없어 라우터의 히스토리 인덱스 추적이 깨진다(직접 확인, PR 본문 기록).
  // 그래서 인앱 뒤로 가기는 여전히 대화상자 없이 즉시 진행된다 — 현재 동작을 그대로 기록한다.
  await page.goBack();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });

  // 확정(CONFIRM_PLAYER+ADVANCE)은 컴포넌트가 언마운트돼도 백그라운드에서 끝까지 실행된다. 재진입하면
  // useCareerStepGuard가 최신 상태로 이벤트 화면(또는 복구 코드 단계)까지 자동으로 데려간다.
  // 45s로 넓혀도 극단적 머신 과부하(load average가 코어 수를 크게 넘는 상황, PR 본문 참고)에서는
  // 여전히 넘길 수 있음을 확인했다 — 더 키워도 해결되지 않아 test.slow()가 주는 여유만 남기고
  // 원래 값으로 되돌린다(대기 대상·로직은 처음부터 그대로다).
  await expect(page).toHaveURL(/\/career\/.+\/(confirm\?step=recovery|path|tryout|event)$/, { timeout: 15_000 });

  await page.goto('/');
  await expect(page.getByText('진행 중')).toBeVisible();
  await expect(page.getByText('만드는 중')).toHaveCount(0);
});
