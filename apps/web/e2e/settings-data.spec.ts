// TEST-E2E(08 문서) T-1-012: SCR-030 계정·데이터. page.route로 API를 스텁한다(실제 api 서버는
// recovery-api.spec.ts만 쓴다). UX-013 구조: 복구 코드·프로필 복구는 계정 카드의 "계정 상세"
// 접이식 안에, 프로필 삭제·이 기기 데이터 삭제는 맨 아래 위험 텍스트 링크(2단계 확인 대화상자 유지).
// (a) 복구 코드 재발급 확인 → 코드 대화상자 → 복사 → 닫힘, 발급일 갱신
// (b) 프로필 복구 오류 3종(형식·RECOVERY_CODE_INVALID·RATE_LIMITED) 문구
// (c) RECOVERY_CONFLICT 선택 대화상자 → mergeChoice를 붙여 재전송
// (d) 프로필 삭제 2단계 → 온보딩
// (e) 이 기기 데이터 삭제 → 온보딩 → 허브 빈 상태
import { expect, test } from '@playwright/test';
import { E2E_META, fulfillJson } from './helpers/sync-conflict.js';
import { expectRoute } from './helpers/route.js';

test('복구 코드 재발급: 확인 → 코드 대화상자 → 복사 → 닫힘, 발급일이 갱신된다', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-write']);
  let profileCalls = 0;
  await page.route('**/v1/profile', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    profileCalls += 1;
    const issuedAt = profileCalls === 1 ? '2026-08-01T08:00:00Z' : '2026-09-03T08:00:00Z';
    await fulfillJson(route, 200, {
      data: {
        id: 'prf_e2e',
        settings: {
          reducedMotion: 'SYSTEM',
          textScale: 100,
          theme: 'SYSTEM',
          defaultSimulationMode: 'FAST',
        },
        linked: { google: false, toss: false },
        recoveryCodeIssuedAt: issuedAt,
        createdAt: '2026-08-01T00:00:00Z',
      },
      meta: E2E_META,
    });
  });
  await page.route('**/v1/profile/recovery-code', (route) =>
    fulfillJson(route, 200, {
      data: { code: 'OFS-ABCD-2345-EFGH', issuedAt: '2026-09-03T08:00:00Z' },
      meta: E2E_META,
    }),
  );

  await page.goto('/settings');
  // UX-013: 복구 코드 행은 "계정 상세" 접이식 안에 있다.
  await page.getByText('계정 상세', { exact: true }).click();
  await expect(page.locator('time[datetime="2026-08-01T08:00:00Z"]')).toBeVisible();

  await page.getByRole('button', { name: '재발급' }).click();
  await expect(page.getByRole('heading', { level: 2, name: '복구 코드 재발급' })).toBeVisible();
  await expect(
    page.getByText('이전 코드는 즉시 쓸 수 없게 됩니다. 새 코드를 적어 두세요.'),
  ).toBeVisible();

  // 배경 대화상자가 열려 있어 aria-hidden 처리된 뒤라 대화상자 안의 "재발급"만 접근성 트리에 남는다.
  await page.getByRole('button', { name: '재발급' }).click();

  await expect(page.getByRole('heading', { level: 2, name: '복구 코드' })).toBeVisible();
  await expect(page.getByText('OFS-ABCD-2345-EFGH')).toBeVisible();

  await page.getByRole('button', { name: '복사' }).click();
  await expect(page.getByText('복사했습니다')).toBeVisible();

  await page.getByRole('button', { name: '적어 두었습니다' }).click();
  await expect(page.getByRole('heading', { level: 2, name: '복구 코드' })).not.toBeVisible();
  await expect(page.locator('time[datetime="2026-09-03T08:00:00Z"]')).toBeVisible();
});

test('프로필 복구: 형식이 잘못된 코드는 필드 옆에 오류를 보여준다(네트워크 요청 없음)', async ({
  page,
}) => {
  let recoverCalled = false;
  await page.route('**/v1/profile/recover', async (route) => {
    recoverCalled = true;
    await route.continue();
  });

  await page.goto('/settings');
  // UX-013: 프로필 복구 폼은 "계정 상세" 접이식 안에 다시 접혀 있다 — 둘 다 열어야 입력을 채울 수 있다.
  await page.getByText('계정 상세', { exact: true }).click();
  await page.getByText('프로필 복구', { exact: true }).click();
  await page.getByLabel('다른 기기에서 발급받은 복구 코드').fill('너무-짧음');
  await page.getByRole('button', { name: '복구' }).click();

  await expect(page.getByText(/복구 코드 형식이 올바르지 않습니다/)).toBeVisible();
  expect(recoverCalled).toBe(false);
});

test('프로필 복구: 코드가 맞지 않으면 안내하고 입력·포커스를 보존한다', async ({ page }) => {
  await page.route('**/v1/profile/recover', (route) =>
    fulfillJson(route, 400, {
      error: {
        code: 'RECOVERY_CODE_INVALID',
        message: '복구 코드가 올바르지 않습니다.',
        retryable: false,
      },
      meta: E2E_META,
    }),
  );

  await page.goto('/settings');
  await page.getByText('계정 상세', { exact: true }).click();
  await page.getByText('프로필 복구', { exact: true }).click();
  const input = page.getByLabel('다른 기기에서 발급받은 복구 코드');
  await input.fill('OFS-ABCD-EFGH-JKMN');
  await page.getByRole('button', { name: '복구' }).click();

  await expect(page.getByText('코드가 맞지 않습니다.')).toBeVisible();
  await expect(input).toHaveValue('OFS-ABCD-EFGH-JKMN');
  await expect(input).toBeFocused();
});

test('프로필 복구: 시도 횟수를 넘으면 잠시 뒤 다시 시도하라고 안내한다', async ({ page }) => {
  await page.route('**/v1/profile/recover', (route) =>
    fulfillJson(route, 429, {
      error: { code: 'RATE_LIMITED', message: '너무 많이 시도했습니다.', retryable: true },
      meta: E2E_META,
    }),
  );

  await page.goto('/settings');
  // UX-013: 프로필 복구 폼은 "계정 상세" 접이식 안에 다시 접혀 있다 — 둘 다 열어야 입력을 채울 수 있다.
  await page.getByText('계정 상세', { exact: true }).click();
  await page.getByText('프로필 복구', { exact: true }).click();
  await page.getByLabel('다른 기기에서 발급받은 복구 코드').fill('OFS-ABCD-EFGH-JKMN');
  await page.getByRole('button', { name: '복구' }).click();

  await expect(page.getByText('시도 횟수를 넘었습니다. 잠시 뒤 다시 시도하세요.')).toBeVisible();
});

test('프로필 복구: RECOVERY_CONFLICT면 선택 대화상자가 뜨고 mergeChoice를 붙여 재전송한다', async ({
  page,
}) => {
  const bodies: Array<{ code: string; mergeChoice?: string }> = [];
  await page.route('**/v1/profile/recover', async (route) => {
    const body = route.request().postDataJSON() as { code: string; mergeChoice?: string };
    bodies.push(body);
    if (body.mergeChoice === undefined) {
      await fulfillJson(route, 409, {
        error: {
          code: 'RECOVERY_CONFLICT',
          message: '이미 진행 중인 커리어가 있습니다.',
          retryable: false,
          details: { currentCareerCount: 2, targetCareerCount: 1 },
        },
        meta: E2E_META,
      });
      return;
    }
    await fulfillJson(route, 200, {
      data: { profileId: 'prf_target', careerCount: 3 },
      meta: E2E_META,
    });
  });
  await page.route('**/v1/careers', async (route) => {
    if (route.request().method() === 'GET') {
      await fulfillJson(route, 200, { data: { items: [], nextCursor: null }, meta: E2E_META });
      return;
    }
    await route.continue();
  });

  await page.goto('/settings');
  // UX-013: 프로필 복구 폼은 "계정 상세" 접이식 안에 다시 접혀 있다 — 둘 다 열어야 입력을 채울 수 있다.
  await page.getByText('계정 상세', { exact: true }).click();
  await page.getByText('프로필 복구', { exact: true }).click();
  await page.getByLabel('다른 기기에서 발급받은 복구 코드').fill('OFS-ABCD-EFGH-JKMN');
  await page.getByRole('button', { name: '복구' }).click();

  await expect(
    page.getByRole('heading', { level: 2, name: '이미 커리어가 있는 기기입니다' }),
  ).toBeVisible();
  await page.getByRole('button', { name: '이 기기의 커리어 2개를 복구할 프로필로 옮기기' }).click();

  await expect(page.getByText('프로필을 복구했습니다. 커리어 3개')).toBeVisible();
  await expect.poll(() => bodies.at(-1)?.mergeChoice).toBe('MOVE_TO_LINKED');
});

test('프로필 삭제: 1단계 → 확인 대화상자 → 2단계 → 온보딩으로 이동한다', async ({ page }) => {
  await page.route('**/v1/profile/delete', async (route) => {
    const raw = route.request().postData();
    const body = raw !== null && raw.length > 0 ? (JSON.parse(raw) as Record<string, unknown>) : {};
    if (Object.keys(body).length === 0) {
      await fulfillJson(route, 200, {
        data: { confirmToken: 'tok_e2e', expiresAt: '2026-09-03T00:10:00Z' },
        meta: E2E_META,
      });
      return;
    }
    await route.fulfill({ status: 204, headers: { 'content-length': '0' } });
  });

  await page.goto('/settings');
  // UX-013: 위험 작업은 맨 아래 위험 텍스트 링크다(1단계 = 링크 자체, 2단계 = 확인 대화상자).
  await page.getByRole('button', { name: '프로필 삭제', exact: true }).click();

  await expect(page.getByRole('heading', { level: 2, name: '프로필 삭제' })).toBeVisible();
  await expect(
    page.getByText(
      '모든 커리어, 복구 코드, 서버 저장 데이터가 즉시 삭제됩니다. 되돌릴 수 없습니다.',
    ),
  ).toBeVisible();

  await page.getByRole('dialog').getByRole('button', { name: '삭제' }).click();

  await expectRoute(page, /\/onboarding$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('이 기기 데이터 삭제: 확인 → 온보딩 → 허브가 빈 상태로 돌아온다', async ({ page }) => {
  await page.route('**/v1/careers/*', async (route) => {
    if (route.request().method() === 'PUT') {
      const baseRevision = Number(route.request().headers()['if-match'] ?? 0);
      await fulfillJson(route, 200, {
        data: { revision: baseRevision + 1, syncedAt: '2026-09-03T00:00:00Z' },
        meta: E2E_META,
      });
      return;
    }
    await route.continue();
  });

  await page.goto('/onboarding');
  await page.getByRole('link', { name: '선수 생성 닫기' }).click();
  await expectRoute(page, /\/$/);
  await page.getByRole('button', { name: '커리어 시작' }).click();
  await expectRoute(page, /\/onboarding$/);
  await page.getByLabel('이름').fill('김서준');
  await page.getByRole('button', { name: /다음 · 후보 카드 열기/ }).click();
  await expectRoute(page, /\/style$/);

  await page.goto('/settings');
  // UX-013: 위험 작업은 맨 아래 위험 텍스트 링크다.
  await page.getByRole('button', { name: '이 기기 데이터 삭제', exact: true }).click();

  await expect(page.getByRole('heading', { level: 2, name: '이 기기 데이터 삭제' })).toBeVisible();
  await expect(page.getByText('복구 코드가 없어 되돌릴 수 없습니다.')).toBeVisible();

  await page.getByRole('dialog').getByRole('button', { name: '삭제' }).click();

  await expectRoute(page, /\/onboarding$/);
  await page.getByRole('link', { name: '선수 생성 닫기' }).click();
  await expectRoute(page, /\/$/);
  await expect(
    page.getByRole('heading', { level: 2, name: '아직 만든 커리어가 없습니다' }),
  ).toBeVisible();
});

// 서비스 정책(SCR-030): 이용약관·개인정보 처리방침은 /legal/*로 이동하는 대신 같은 화면 위에
// 시트로 뜬다(?legal= 검색 파라미터, ADR-009는 그대로 — 여전히 SPA 내부 컴포넌트만 쓴다. /legal
// 라우트 자체는 legal.spec.ts가 계속 확인한다).
test('서비스 정책 시트: 이용약관 행을 클릭해 열고, 뒤로가기로 닫힌다', async ({ page }) => {
  await page.goto('/settings');
  const row = page.getByRole('button', { name: '이용약관' });
  await row.click();

  await expect(page.getByRole('dialog', { name: '이용약관' })).toBeVisible();
  await expectRoute(page, /\?legal=terms$/);

  await page.goBack();

  await expect(page.getByRole('dialog')).toBeHidden();
  await expectRoute(page, /\/settings$/);
});

test('서비스 정책 시트: 닫기 버튼을 누르면 파라미터가 사라지고 포커스가 여는 행으로 돌아온다', async ({
  page,
}) => {
  await page.goto('/settings');
  const row = page.getByRole('button', { name: '개인정보 처리방침' });
  await row.click();
  await expect(page.getByRole('dialog', { name: '개인정보 처리방침' })).toBeVisible();

  await page.getByRole('dialog').getByRole('button', { name: '닫기' }).click();

  await expect(page.getByRole('dialog')).toBeHidden();
  await expectRoute(page, /\/settings$/);
  await expect(row).toBeFocused();
});

test('서비스 정책 시트: /settings?legal=privacy 딥링크로 바로 열린다', async ({ page }) => {
  await page.goto('/settings?legal=privacy');

  await expect(page.getByRole('dialog', { name: '개인정보 처리방침' })).toBeVisible();
});
