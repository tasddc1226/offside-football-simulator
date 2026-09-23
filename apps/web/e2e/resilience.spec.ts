// TEST-E2E-007(08 문서): 새로고침·응답 유실·중복 클릭 복구. FR-SAV-001. 스텁 API.
import { expect, test } from '@playwright/test';
import { currentRoute, expectRoute } from './helpers/route.js';
import {
  fillPlayerInfo,
  fulfillJson,
  goToConfirm,
  META,
  readCurrentCareerState,
  startNewCareer,
} from './helpers/player-creation.js';

test('(a) 새로고침: SCR-002 draft가 복원되고, SCR-004 확정 뒤에는 이벤트 화면이 그대로 보인다', async ({
  page,
}) => {
  await startNewCareer(page);
  await fillPlayerInfo(page);
  await page.getByRole('button', { name: /다음 · 후보 카드 열기/ }).click();
  await expectRoute(page, /\/career\/.+\/style$/);

  await page.getByRole('link', { name: '수정', exact: true }).click();
  await expectRoute(page, /\/career\/.+\/create$/);
  await page.reload();
  await expect(page.getByLabel('이름')).toHaveValue('김서준');
  await expect(page.getByLabel('출발 배경')).toHaveValue('club-academy');
  await expect(page.getByRole('radio', { name: '왼발' })).toBeChecked();
  await expect(page.getByRole('radio', { name: /윙어/ })).toBeChecked();

  // SCR-004까지 마저 진행해 확정한다.
  await page.getByRole('button', { name: /다음 · 후보 카드 열기/ }).click();
  await expectRoute(page, /\/career\/.+\/style$/);
  await page.getByRole('button', { name: '3장 모두 열기' }).click();
  await page.getByRole('button', { name: '인사이드 포워드 후보 선택' }).click();
  await page.getByRole('button', { name: /이 후보로 진행/ }).click();
  await expectRoute(page, /\/career\/.+\/confirm$/);

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
  await page.getByRole('button', { name: /이 선수로 시작/ }).click();
  await expectRoute(page, /\/career\/.+\/(path|tryout|event)$/);

  const eventRoute = await currentRoute(page);
  await page.reload();

  await expectRoute(page, eventRoute);
  await expect(page.getByRole('radio').first()).toBeVisible();
  await expect(page.getByRole('button', { name: '확정' })).toBeVisible();
});

test('(b) 확정 버튼을 두 번 클릭해도 revision은 정확히 2(CONFIRM_PLAYER+ADVANCE)만 증가하고 카드는 하나다', async ({
  page,
}) => {
  await page.route('**/v1/careers/**', async (route) => {
    if (route.request().method() === 'PUT') {
      await fulfillJson(route, 200, {
        data: { revision: 1, syncedAt: '2026-09-03T00:00:00Z' },
        meta: META,
      });
      return;
    }
    await route.continue();
  });
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

  await goToConfirm(page);

  await page.goto('/');
  const card = page.getByTestId('career-card');
  await expect(card).toHaveCount(1);
  const revisionBefore = Number(await card.getAttribute('data-revision'));

  await page.getByRole('button', { name: '이어하기' }).click();
  await expectRoute(page, /\/career\/.+\/confirm$/);

  const kickoff = page.getByRole('button', { name: /이 선수로 시작/ });
  await Promise.all([
    kickoff.click({ timeout: 2000 }).catch(() => {}),
    kickoff.click({ timeout: 2000 }).catch(() => {}),
  ]);

  // 확정(+ADVANCE)이 끝나야만 도착하는 화면까지 기다린다 — 둘 중 하나가 이겨도 결국 여기 온다.
  await expectRoute(page, /\/career\/.+\/(path|tryout|event)$/, { timeout: 10_000 });

  await page.goto('/');
  await expect(page.getByTestId('career-card')).toHaveCount(1);
  const revisionAfter = Number(await page.getByTestId('career-card').getAttribute('data-revision'));
  expect(revisionAfter).toBe(revisionBefore + 2);
});

test('(c) PUT 유실: 첫 요청이 실패하면 "저장 다시 시도 중"이 보이고, 같은 Idempotency-Key로 재시도해 "저장됨"이 된다', async ({
  page,
}) => {
  await page.route('**/v1/careers/*', async (route) => {
    if (route.request().method() !== 'PUT') {
      await route.continue();
      return;
    }
    const body = route.request().postDataJSON();
    await fulfillJson(route, 200, {
      data: { revision: body.snapshot.revision, syncedAt: '2026-09-03T00:00:00Z' },
      meta: META,
    });
  });
  await goToConfirm(page);
  await expect(page.getByText('저장됨')).toBeVisible();
  const editUrl = (await currentRoute(page)).replace('/confirm', '/create');
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
    await fulfillJson(route, 200, {
      data: {
        revision: route.request().postDataJSON().snapshot.revision,
        syncedAt: '2026-09-03T00:00:00Z',
      },
      meta: META,
    });
  });

  await page.goto(editUrl);
  await page.getByLabel('이름').fill('정서준');
  await page.getByRole('button', { name: /다음 · 후보 카드 열기/ }).click();

  await expect(page.getByText('저장 다시 시도 중')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('저장됨')).toBeVisible({ timeout: 10_000 });

  expect(attempt).toBeGreaterThanOrEqual(2);
  expect(idempotencyKeys[0]).not.toBe('');
  expect(idempotencyKeys[1]).toBe(idempotencyKeys[0]);
});

test('(d) 명령 응답 대기 중(COMMITTING) 뒤로 가기: 재진입하면 확정 결과가 보인다', async ({
  page,
}) => {
  // 이 테스트는 의도적으로 CDP CPU 스로틀링(rate 30)을 걸었다 풀었다 한다 — 병렬 워커로 실제
  // 머신 CPU를 나눠 쓰면 스로틀을 푼 뒤에도 백그라운드 확정 커맨드가 15s보다 오래 걸릴 수 있다
  // (관찰됨). season.spec.ts와 같은 이유로 test.slow()를 쓴다.
  test.slow();
  await page.route('**/v1/careers/**', async (route) => {
    if (route.request().method() === 'PUT') {
      await fulfillJson(route, 200, {
        data: { revision: 1, syncedAt: '2026-09-03T00:00:00Z' },
        meta: META,
      });
      return;
    }
    await route.continue();
  });
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

  await goToConfirm(page);

  // CPU를 강하게 스로틀링해 로컬 Worker 왕복(확정 처리)을 늘려, COMMITTING 화면을 안정적으로
  // 관찰할 시간을 확보한다(waitForTimeout 없이 상태 기반 대기만 쓴다 — CDP 스로틀은 perf.spec.ts와
  // 같은 기법이다).
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 30 });
  const confirmedRoute = await currentRoute(page);

  await page.getByRole('button', { name: /이 선수로 시작/ }).click();
  await expect(page.getByText('선수 등록을 완료합니다')).toBeVisible({ timeout: 10_000 });

  // T-1-017: COMMITTING 중 이탈 경고는 beforeunload(탭 닫기·새로고침·주소창 이동)만 연결하는 최소
  // 구현으로 남겼다(use-committing-exit-guard.ts 머리말 참고). T-7-039로 라우터 히스토리가 메모리
  // 히스토리로 바뀌면서 물리 뒤로 가기는 packages/platform/src/web/index.ts의 가드 엔트리를 거쳐
  // `router.history.back()`으로 이어진다 — 화면별 확인 대화상자는 여전히 없으므로 인앱 뒤로 가기는
  // 대화상자 없이 즉시 진행된다(현재 동작을 그대로 기록한다).
  await page.goBack();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await expect.poll(async () => (await readCurrentCareerState(page)).pending?.kind,
    { timeout: 15_000 }).toBe('EVENT');
  // Re-enter the saved route explicitly; leaving COMMITTING must not force navigation.
  await page.goto(confirmedRoute);

  // 확정(CONFIRM_PLAYER+ADVANCE)은 컴포넌트가 언마운트돼도 백그라운드에서 끝까지 실행된다. 재진입하면
  // useCareerStepGuard가 최신 상태로 이벤트 화면까지 자동으로 데려간다.
  // 45s로 넓혀도 극단적 머신 과부하(load average가 코어 수를 크게 넘는 상황, PR 본문 참고)에서는
  // 여전히 넘길 수 있음을 확인했다 — 더 키워도 해결되지 않아 test.slow()가 주는 여유만 남기고
  // 원래 값으로 되돌린다(대기 대상·로직은 처음부터 그대로다).
  await expectRoute(page, /\/career\/.+\/(path|tryout|event)$/, { timeout: 15_000 });

  await page.goto('/');
  await expect(page.getByText('진행 중')).toBeVisible();
  await expect(page.getByText('만드는 중')).toHaveCount(0);
});
