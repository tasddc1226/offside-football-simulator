// TEST-E2E-009(접근성 기준): 허브·온보딩·설정·법적 문서 화면에 axe serious·critical 위반이 없다.
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import {
  advanceThroughSeasonToSettlement,
  advanceUntilOffers,
  completeOnboardingAndConfirm,
  completeOnboardingThroughContract,
  continueToPreseason,
  expectFirstContractHeading,
  fillPlayerInfo,
  fillPreseasonPlan,
  goToConfirm,
  planPreseason,
  resolveRoleProposal,
  startNewCareer,
} from './helpers/player-creation.js';
import { E2E_META, fulfillJson, triggerConflictAndOpenDialog } from './helpers/sync-conflict.js';
import { advanceToChapter, seedDeterministicChapterRun } from './helpers/chapter.js';

const PROFILE_WITH_CODE = {
  id: 'prf_e2e',
  settings: {
    reducedMotion: 'SYSTEM' as const,
    textScale: 100 as const,
    theme: 'SYSTEM' as const,
    defaultSimulationMode: 'FAST' as const,
  },
  linked: { google: false, toss: false },
  recoveryCodeIssuedAt: '2026-08-01T08:00:00Z',
  createdAt: '2026-08-01T00:00:00Z',
};

const PROFILE_GOOGLE_LINKED = {
  id: 'prf_e2e_google',
  settings: {
    reducedMotion: 'SYSTEM' as const,
    textScale: 100 as const,
    theme: 'SYSTEM' as const,
    defaultSimulationMode: 'FAST' as const,
  },
  linked: { google: true, toss: false },
  recoveryCodeIssuedAt: null,
  createdAt: '2026-08-01T00:00:00Z',
  googleEmailMasked: 'a***@gmail.com',
  pendingMerge: null,
};

async function expectNoSeriousOrCriticalViolations(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  const seriousOrCritical = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  );

  console.log(
    `[a11y] ${label}: 전체 위반 ${results.violations.length}건, serious/critical ${seriousOrCritical.length}건`,
  );
  if (results.violations.length > 0) {
    console.log(
      JSON.stringify(
        results.violations.map((violation) => ({
          id: violation.id,
          impact: violation.impact,
          nodes: violation.nodes.length,
        })),
        null,
        2,
      ),
    );
  }

  expect(seriousOrCritical).toEqual([]);
}

const STATIC_SCREENS = ['/legal/privacy', '/legal/terms', '/onboarding', '/settings'];

for (const path of STATIC_SCREENS) {
  test(`${path} 화면에 axe serious·critical 위반이 없다`, async ({ page }) => {
    await page.goto(path);
    await expectNoSeriousOrCriticalViolations(page, path);
  });
}

test('빈 허브(첫 방문, 온보딩 건너뛴 뒤) 화면에 axe serious·critical 위반이 없다', async ({
  page,
}) => {
  await page.goto('/onboarding');
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole('heading', { level: 2, name: '아직 만든 커리어가 없습니다' }),
  ).toBeVisible();

  await expectNoSeriousOrCriticalViolations(page, '/ (빈 허브)');
});

test('카드가 있는 허브 화면에 axe serious·critical 위반이 없다', async ({ page }) => {
  await page.goto('/onboarding');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: 'KICKOFF' }).click();
  await expect(page).toHaveURL(/\/career\/.+\/create$/);
  // SCR-002는 허브로 돌아가는 링크를 두지 않는다(hub.spec.ts와 같은 이유).
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 2, name: '이름 없는 선수' })).toBeVisible();

  await expectNoSeriousOrCriticalViolations(page, '/ (카드 있는 허브)');
});

test('SCR-002 선수 정보 화면에 axe serious·critical 위반이 없다', async ({ page }) => {
  await startNewCareer(page);
  await expect(
    page.getByRole('heading', { level: 1, name: '다음 무대를 향해, 킥오프' }),
  ).toBeVisible();

  await expectNoSeriousOrCriticalViolations(page, 'SCR-002');
});

test('SCR-003 플레이 스타일 화면에 axe serious·critical 위반이 없다', async ({ page }) => {
  await startNewCareer(page);
  await fillPlayerInfo(page);
  await page.getByRole('button', { name: '플레이 스타일 고르기' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: '플레이 스타일을 고르세요' }),
  ).toBeVisible();

  await expectNoSeriousOrCriticalViolations(page, 'SCR-003');
});

test('SCR-004 확인 화면에 axe serious·critical 위반이 없다', async ({ page }) => {
  await goToConfirm(page);

  await expectNoSeriousOrCriticalViolations(page, 'SCR-004');
});

test('T-1-011 충돌 대화상자가 열린 상태에 axe serious·critical 위반이 없다', async ({ page }) => {
  // triggerConflictAndOpenDialog의 "지금 동기화" 왕복은 실제 네트워크·React 렌더 타이밍에
  // 걸려 있다 — 병렬 워커로 CPU를 나눠 쓰면 기본 30s 테스트 타임아웃을 넘길 수 있다(관찰됨,
  // sync.spec.ts (b)(c)와 동일한 이유).
  test.slow();
  await triggerConflictAndOpenDialog(page);
  await expect(
    page.getByRole('heading', { level: 2, name: '다른 기기에서 이 커리어가 더 진행됐습니다' }),
  ).toBeVisible();

  await expectNoSeriousOrCriticalViolations(page, 'T-1-011 충돌 대화상자');
});

test('T-1-012 설정: 복구 코드 재발급 확인 대화상자에 axe serious·critical 위반이 없다', async ({
  page,
}) => {
  await page.route('**/v1/profile', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await fulfillJson(route, 200, { data: PROFILE_WITH_CODE, meta: E2E_META });
  });

  await page.goto('/settings');
  // UX-013: 복구 코드 행은 계정 카드의 "계정 상세" 접이식 안에 있다.
  await page.getByText('계정 상세', { exact: true }).click();
  await page.getByRole('button', { name: '재발급' }).click();
  await expect(page.getByRole('heading', { level: 2, name: '복구 코드 재발급' })).toBeVisible();

  await expectNoSeriousOrCriticalViolations(page, 'T-1-012 설정: 복구 코드 재발급 확인');
});

test('T-1-012 설정: 복구 코드 결과 대화상자에 axe serious·critical 위반이 없다', async ({
  page,
}) => {
  await page.route('**/v1/profile/recovery-code', (route) =>
    fulfillJson(route, 200, {
      data: { code: 'OFS-ABCD-2345-EFGH', issuedAt: '2026-09-03T08:00:00Z' },
      meta: E2E_META,
    }),
  );

  await page.goto('/settings');
  // UX-013: 복구 코드 행은 계정 카드의 "계정 상세" 접이식 안에 있다.
  await page.getByText('계정 상세', { exact: true }).click();
  await page.getByRole('button', { name: '발급' }).click();
  await expect(page.getByRole('heading', { level: 2, name: '복구 코드' })).toBeVisible();

  await expectNoSeriousOrCriticalViolations(page, 'T-1-012 설정: 복구 코드 결과');
});

test('T-1-012 설정: 프로필 복구 충돌 선택 대화상자에 axe serious·critical 위반이 없다', async ({
  page,
}) => {
  await page.route('**/v1/profile/recover', (route) =>
    fulfillJson(route, 409, {
      error: {
        code: 'RECOVERY_CONFLICT',
        message: '이미 진행 중인 커리어가 있습니다.',
        retryable: false,
        details: { currentCareerCount: 2, targetCareerCount: 1 },
      },
      meta: E2E_META,
    }),
  );

  await page.goto('/settings');
  // UX-013: 프로필 복구 폼은 "계정 상세" 접이식 안에 다시 접혀 있다 — 둘 다 열어야 입력을 채울 수 있다.
  await page.getByText('계정 상세', { exact: true }).click();
  await page.getByText('프로필 복구', { exact: true }).click();
  await page.getByLabel('다른 기기에서 발급받은 복구 코드').fill('OFS-ABCD-EFGH-JKMN');
  await page.getByRole('button', { name: '복구' }).click();
  await expect(
    page.getByRole('heading', { level: 2, name: '이미 커리어가 있는 기기입니다' }),
  ).toBeVisible();

  await expectNoSeriousOrCriticalViolations(page, 'T-1-012 설정: 프로필 복구 충돌 선택');
});

test('T-1-012 설정: 이 기기 데이터 삭제 확인 대화상자에 axe serious·critical 위반이 없다', async ({
  page,
}) => {
  await page.goto('/settings');
  // UX-013: 위험 작업은 맨 아래 위험 텍스트 링크다.
  await page.getByRole('button', { name: '이 기기 데이터 삭제', exact: true }).click();
  await expect(page.getByRole('heading', { level: 2, name: '이 기기 데이터 삭제' })).toBeVisible();

  await expectNoSeriousOrCriticalViolations(page, 'T-1-012 설정: 이 기기 데이터 삭제 확인');
});

test('T-1-012 설정: 프로필 삭제 확인 대화상자에 axe serious·critical 위반이 없다', async ({
  page,
}) => {
  await page.route('**/v1/profile/delete', (route) =>
    fulfillJson(route, 200, {
      data: { confirmToken: 'tok_a11y', expiresAt: '2026-09-03T00:10:00Z' },
      meta: E2E_META,
    }),
  );

  await page.goto('/settings');
  // UX-013: 위험 작업은 맨 아래 위험 텍스트 링크다.
  await page.getByRole('button', { name: '프로필 삭제', exact: true }).click();
  await expect(page.getByRole('heading', { level: 2, name: '프로필 삭제' })).toBeVisible();

  await expectNoSeriousOrCriticalViolations(page, 'T-1-012 설정: 프로필 삭제 확인');
});

// T-1-014(TEST-E2E-009 접근성 체크리스트): 나머지 Phase 1 화면(SCR-007·008·013·014·009·010·029) +
// 텍스트 크기 150%·모션 감소·aria-live 확인. 기존 줄은 옮기지 않는다(T-1-013 동시 작업 제약).

test('SCR-007/008/013 이벤트 화면·SCR-014 결과 화면에 axe serious·critical 위반이 없다(등장하는 만큼)', async ({
  page,
}) => {
  await completeOnboardingAndConfirm(page);

  let reachedOffers = false;
  const seenScreenIds = new Set<string>();
  for (let step = 0; step < 10 && !reachedOffers; step += 1) {
    await page.waitForURL(/\/career\/.+\/(path|tryout|event|offers)$/);
    const pathname = new URL(page.url()).pathname;
    if (pathname.endsWith('/offers')) {
      reachedOffers = true;
      break;
    }
    const screenId = pathname.endsWith('/path')
      ? 'SCR-007'
      : pathname.endsWith('/tryout')
        ? 'SCR-008'
        : 'SCR-013';
    seenScreenIds.add(screenId);
    await expectNoSeriousOrCriticalViolations(page, `${screenId}(${pathname})`);

    await page.getByRole('radio').first().click();
    await page.getByRole('button', { name: '확정' }).click();
    await expect(page).toHaveURL(/\/event\/result\?rev=\d+$/);
    seenScreenIds.add('SCR-014');
    await expectNoSeriousOrCriticalViolations(page, 'SCR-014(/event/result)');
    await page.getByRole('button', { name: '다음' }).click();
  }
  if (!reachedOffers) throw new Error('offers 화면에 도달하지 못했다(최대 10회 시도)');
  console.log(`[a11y] 이벤트 반복에서 실제로 만난 화면: ${[...seenScreenIds].sort().join(', ')}`);
});

test('SCR-009 제안 비교 화면에 axe serious·critical 위반이 없다', async ({ page }) => {
  await completeOnboardingAndConfirm(page);
  await advanceUntilOffers(page);
  await expectFirstContractHeading(page);

  await expectNoSeriousOrCriticalViolations(page, 'SCR-009');
});

test('SCR-010 계약 화면·SCR-029 대시보드(기본·휴대폰 탭)에 axe serious·critical 위반이 없다', async ({
  page,
}) => {
  await completeOnboardingAndConfirm(page);
  await advanceUntilOffers(page);
  await page.getByRole('link', { name: '제안 상세·결정' }).first().click();
  await expect(page).toHaveURL(/\/career\/.+\/contract\?offerId=.+$/);

  await expectNoSeriousOrCriticalViolations(page, 'SCR-010');

  await page.getByRole('button', { name: '이름 입력' }).click();
  await page.getByRole('textbox', { name: '서명할 이름' }).fill('김서준');
  await page.getByRole('button', { name: '서명하고 계약 확정' }).click();
  await expect(page.getByRole('heading', { level: 1, name: '프로의 첫 유니폼' })).toBeVisible();
  // PlayerCard의 진입 opacity 애니메이션 중간 프레임은 배지와 배경을 임시 혼색한다.
  // 최종 렌더 상태가 된 뒤 실제 색 대비를 검사한다.
  await expect(page.locator('.os-player-card')).toHaveCSS('opacity', '1');
  await expectNoSeriousOrCriticalViolations(page, 'SCR-010 계약 완료');
  await page.getByRole('button', { name: '커리어 시작' }).click();
  await expect(page).toHaveURL(/\/career\/[^/]+$/);
  const signedToast = page.getByText('계약을 맺었습니다');
  await expect(signedToast).toBeVisible();
  // Toast는 마운트 뒤 opacity-0→opacity-100로 200ms 전환한다(packages/ui/src/components/Toast.tsx) —
  // 전환 중간에 axe를 돌리면 실제로는 존재하지 않는 명암비 위반이 잡힌다(중간 opacity가 배경과
  // 섞여 글자색이 흐려 보이는 것뿐). 전환이 끝난 뒤(opacity: 1) 상태 기반으로 기다린다.
  await expect(signedToast).toHaveCSS('opacity', '1');

  await expectNoSeriousOrCriticalViolations(page, 'SCR-029(일정표, 기본)');

  await page.getByRole('tab', { name: '계약' }).click();
  await expect(page.getByText('주급')).toBeVisible();

  await expectNoSeriousOrCriticalViolations(page, 'SCR-029(휴대폰)');
});

// T-2-007(TEST-E2E-009 접근성 체크리스트): 새 화면 4개(SCR-005·011·012·033).

test('SCR-005 프리시즌 계획 화면에 axe serious·critical 위반이 없다', async ({ page }) => {
  await completeOnboardingThroughContract(page);
  await page.getByRole('link', { name: '계획하러 가기' }).click();
  await expect(page.getByRole('heading', { level: 1, name: '프리시즌 계획' })).toBeVisible();

  await expectNoSeriousOrCriticalViolations(page, 'SCR-005');
});

test('SCR-011 시즌 준비 화면에 axe serious·critical 위반이 없다', async ({ page }) => {
  await completeOnboardingThroughContract(page);
  await page.getByRole('link', { name: '계획하러 가기' }).click();
  await fillPreseasonPlan(page, '역할 집중');
  await expect(page.getByRole('heading', { level: 1, name: '시즌 준비' })).toBeVisible();

  await expectNoSeriousOrCriticalViolations(page, 'SCR-011');
});

// 룰셋 1.5.0 승격 뒤에는 'e2e-season-result-01'(옛 1.4.0 seed)로 두 번째 시즌을 시작하면
// computeRoleProposal이 KEEP(현재 포지션·스쿼드 역할과 그대로 일치)을 반환해 시즌 준비 화면이
// ROLE_PROPOSAL을 원자적으로 자동 수락해 버린다 — /role에 실제로 도달하지 못해 이 테스트의 목적
// (SCR-012 화면 자체의 접근성 검사)을 달성할 수 없다. 아래 seed는 dev 서버 + Playwright로 후보
// 문자열을 여러 개 돌려 찾은, 두 번째 시즌 시작 시 POSITION_CHANGE·ROLE_CHANGE(수동 확인이 필요한
// 실제 /role 화면)로 이어지는 것을 확인한 값이다(3회 재실행으로 결정론 확인).
const E2E_ROLE_CHANGE_SEED = 'rc-seed-3';

test('SCR-012 역할 제안 화면에 axe serious·critical 위반이 없다', async ({ page }) => {
  test.slow();
  await page.addInitScript((seed) => {
    window.localStorage.setItem('offside:e2e-seed', seed);
  }, E2E_ROLE_CHANGE_SEED);
  await completeOnboardingThroughContract(page);
  await planPreseason(page, '역할 집중');
  await page.getByRole('button', { name: '시즌 시작' }).click();
  await resolveRoleProposal(page);
  await advanceThroughSeasonToSettlement(page);
  await page.getByRole('button', { name: '결산하기' }).click();
  // "다음 시즌"은 대기 중인 시장(OFFERS)이 있으면 프리시즌 대신 그 화면부터 보낸다 —
  // continueToPreseason이 안전 잔류를 수락해 프리시즌으로 이어간다(룰셋 승격에 따른 seed 드리프트 대비).
  await page.getByRole('link', { name: '다음 시즌' }).click();
  await continueToPreseason(page);
  await fillPreseasonPlan(page, '역할 집중');
  await page.getByRole('button', { name: '시즌 시작' }).click();
  await expect(page).toHaveURL(/\/career\/.+\/role$/);

  await expectNoSeriousOrCriticalViolations(page, 'SCR-012');
});

test('SCR-033 능력치 상세 화면에 axe serious·critical 위반이 없다', async ({ page }) => {
  await completeOnboardingThroughContract(page);
  await page.getByRole('tab', { name: '선수' }).click();
  await page.getByRole('link', { name: '능력치 상세' }).click();
  await expect(page).toHaveURL(/\/career\/.+\/attributes$/);

  await expectNoSeriousOrCriticalViolations(page, 'SCR-033');
});

// T-2-009(TEST-E2E-009 접근성 체크리스트): 시즌 결산 화면(SCR-015) 추가.

test('SCR-015 프로 시즌 결과 화면에 axe serious·critical 위반이 없다', async ({ page }) => {
  await completeOnboardingThroughContract(page);
  await planPreseason(page, '역할 집중');
  await page.getByRole('button', { name: '시즌 시작' }).click();
  await resolveRoleProposal(page);
  await advanceThroughSeasonToSettlement(page);
  await page.getByRole('button', { name: '결산하기' }).click();
  await expect(page).toHaveURL(/\/career\/.+\/season-result$/);
  await expect(page.getByRole('heading', { level: 1, name: '프로 시즌 결과' })).toBeVisible();

  await expectNoSeriousOrCriticalViolations(page, 'SCR-015');
});

test('텍스트 크기 150% + 360px에서 가로 스크롤이 생기지 않는다', async ({ page }) => {
  await page.goto('/settings');
  // UX-013: 텍스트 크기 라디오는 "화면·플레이 설정" 접이식 안에 있다.
  await page.getByText('화면·플레이 설정', { exact: true }).click();
  await page.getByRole('radio', { name: '150%' }).click();

  // 텍스트 크기는 useUiStore(zustand persist)로 전역 적용된다 — 실제 게임 화면(허브)에서 확인한다.
  await page.goto('/onboarding');
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole('heading', { level: 2, name: '아직 만든 커리어가 없습니다' }),
  ).toBeVisible();

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(360);
});

test.describe('모션 감소', () => {
  // useReducedMotion()은 OS prefers-reduced-motion 미디어쿼리(SYSTEM 기본값)를 구독한다
  // (first-contract.spec.ts와 같은 이유) — 컨텍스트 자체를 reduced-motion으로 연다.
  test.use({ contextOptions: { reducedMotion: 'reduce' } });

  test('SCR-008 입단 테스트 결과가 연출 없이 즉시 표시된다(카운트업 없음)', async ({ page }) => {
    // TryoutAnimation은 reducedMotion이면 애니메이션 분기를 아예 마운트하지 않고 onDone을 즉시 부른다
    // (career.$careerId.tryout.tsx:43-56, STEP_DURATION_MS=500·3단계=1500ms). 그 미만 시간 안에
    // /event/result로 넘어가면 연출이 실행되지 않았다는 뜻이다 — ResultCard 자체엔 카운트업 로직이
    // 없어(packages/ui/src/components/ResultCard.tsx) 값은 항상 첫 프레임에 최종값이다.
    await completeOnboardingAndConfirm(page);

    let reachedTryout = false;
    for (let step = 0; step < 10 && !reachedTryout; step += 1) {
      await page.waitForURL(/\/career\/.+\/(path|tryout|event)$/);
      const pathname = new URL(page.url()).pathname;
      if (pathname.endsWith('/tryout')) {
        reachedTryout = true;
        break;
      }
      await page.getByRole('radio').first().click();
      await page.getByRole('button', { name: '확정' }).click();
      await expect(page).toHaveURL(/\/event\/result\?rev=\d+$/);
      await page.getByRole('button', { name: '다음' }).click();
    }
    if (!reachedTryout)
      throw new Error(
        'SCR-008(tryout) 화면에 도달하지 못했다(최대 10회 시도) — 이 테스트는 건너뛸 수 없다',
      );

    await expect(page.getByText('평가는 자동으로 진행되며 다시 볼 수 없습니다.')).toHaveCount(0);

    await page.getByRole('radio').first().click();
    await page.getByRole('button', { name: '확정' }).click();

    // 연출 텍스트가 뜬 적이 아예 없어야 한다(폴링이 아니라, 연출 분기가 렌더된 적이 있는지 확인).
    await expect(page.getByText('평가는 자동으로 진행되며 다시 볼 수 없습니다.')).toHaveCount(0);
    await expect(page).toHaveURL(/\/event\/result\?rev=\d+$/, { timeout: 1500 });
    await expect(page.getByText('평가는 자동으로 진행되며 다시 볼 수 없습니다.')).toHaveCount(0);
  });
});

test('결과 확정 시 aria-live 영역이 정확히 한 번 갱신된다(08 접근성 체크리스트)', async ({
  page,
}) => {
  // 08 접근성 체크리스트: "결과 변화가 aria-live로 한 번만 낭독"을 요구한다. SCR-014
  // (career.$careerId.event_.result.tsx)가 이 화면 전용 aria-live 영역을 두고, 빈 문자열로 마운트한
  // 뒤 결과가 정해지면 텍스트를 한 번만 바꾼다(T-1-017) — MutationObserver로 실제 갱신 횟수를 세어
  // 정확히 1건임을 확인한다.
  await completeOnboardingAndConfirm(page);
  await page.waitForURL(/\/career\/.+\/(path|tryout|event)$/);

  await page.evaluate(() => {
    (window as unknown as { __liveMutations: number }).__liveMutations = 0;
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        const target =
          mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
        if (target?.closest('[aria-live], [role="status"], [role="alert"]') !== null) {
          (window as unknown as { __liveMutations: number }).__liveMutations += 1;
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    (window as unknown as { __liveObserver: MutationObserver }).__liveObserver = observer;
  });

  await page.getByRole('radio').first().click();
  await page.getByRole('button', { name: '확정' }).click();
  await expect(page).toHaveURL(/\/event\/result\?rev=\d+$/);

  // 낭독 문구는 마운트 뒤 effect에서 한 번 채워진다(빈 문자열로 먼저 마운트해야 실제 텍스트 변경이
  // characterData 변형으로 잡힌다) — URL이 바뀐 시점과 effect 실행 시점 사이에 짧은 간극이 있어,
  // 텍스트가 채워지길 먼저 기다린 뒤에 갱신 횟수를 읽는다(그렇지 않으면 부하가 큰 환경에서 이 검사가
  // 0건으로 읽는 경쟁 상태가 생긴다). `[aria-live]`는 이 페이지에 항상 떠 있는 SyncBadge의 영역과도
  // 겹쳐(여러 요소가 매칭되면 toHaveText가 깨진다) SCR-014 전용 영역만 data-testid로 짚는다.
  await expect(page.getByTestId('event-result-announcement')).not.toHaveText('');

  const liveMutations = await page.evaluate(
    () => (window as unknown as { __liveMutations: number }).__liveMutations,
  );
  console.log(
    `[a11y] 결과 확정 시 aria-live/status/alert 영역 갱신 횟수: ${liveMutations}건(기대: 1건)`,
  );
  expect(liveMutations).toBe(1);
});

test('T-1-013 설정: Google 연결 해제 확인 대화상자에 axe serious·critical 위반이 없다', async ({
  page,
}) => {
  await page.route('**/v1/profile', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await fulfillJson(route, 200, { data: PROFILE_GOOGLE_LINKED, meta: E2E_META });
  });

  await page.goto('/settings');
  // UX-013: "연결 해제"는 계정 카드의 "계정 상세" 접이식 안에 있다.
  await page.getByText('계정 상세', { exact: true }).click();
  await page.getByRole('button', { name: '연결 해제' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Google 연결 해제' })).toBeVisible();

  await expectNoSeriousOrCriticalViolations(page, 'T-1-013 설정: Google 연결 해제 확인');
});

test('T-1-013 설정: Google 병합 선택 대화상자에 axe serious·critical 위반이 없다', async ({
  page,
}) => {
  await page.route('**/v1/profile', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await fulfillJson(route, 200, {
      data: {
        id: 'prf_e2e_pending',
        settings: {
          reducedMotion: 'SYSTEM',
          textScale: 100,
          theme: 'SYSTEM',
          defaultSimulationMode: 'FAST',
        },
        linked: { google: false, toss: false },
        recoveryCodeIssuedAt: null,
        createdAt: '2026-08-01T00:00:00Z',
        googleEmailMasked: null,
        pendingMerge: { targetCareerCount: 2 },
      },
      meta: E2E_META,
    });
  });

  await page.goto('/settings');
  await expect(
    page.getByRole('heading', { level: 2, name: 'Google에 연결된 프로필이 있습니다' }),
  ).toBeVisible();

  await expectNoSeriousOrCriticalViolations(page, 'T-1-013 설정: Google 병합 선택');
});

test('T-1-013 설정: 로그아웃 확인 대화상자에 axe serious·critical 위반이 없다', async ({
  page,
}) => {
  await page.route('**/v1/profile', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await fulfillJson(route, 200, { data: PROFILE_GOOGLE_LINKED, meta: E2E_META });
  });

  await page.goto('/settings');
  await page.getByRole('button', { name: '로그아웃' }).click();
  await expect(page.getByRole('heading', { level: 2, name: '로그아웃' })).toBeVisible();

  await expectNoSeriousOrCriticalViolations(page, 'T-1-013 설정: 로그아웃 확인');
});

// T-2-008(TEST-E2E-010 접근성 체크리스트): SCR-031 핵심 경기 챕터(판단 확정 화면·경기 결과 화면).
// 실제 팩의 챕터 3종(CHP-MATCH-001·002·004) 모두 판단이 1개뿐이라("다음 판단"이 아니라 "경기 결과"
// 버튼이 뜬다) chapter.spec.ts와 같은 전제로 확정 직후 곧장 결과 화면까지 확인한다.
test.describe('SCR-031 핵심 경기 챕터', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } });

  test('판단 확정 화면·경기 결과 화면에 axe serious·critical 위반이 없다', async ({ page }) => {
    // 시즌을 시작해 챕터에 도달하기까지 몇 번의 "진행"이 필요한지는 시드에 달렸다 —
    // seedDeterministicChapterRun으로 chapter.spec.ts와 같은 결정론 시드를 강제한다(같은 이유, 같은
    // helpers/chapter.ts). 그래도 병렬 워커로 CPU를 나눠 쓰면 mutateAsync가 느려질 수 있어 기본 30s
    // 테스트 타임아웃 대신 넉넉히 기다린다.
    test.slow();

    await seedDeterministicChapterRun(page);
    await completeOnboardingThroughContract(page);
    await planPreseason(page, '역할 집중');
    await page.getByRole('button', { name: '시즌 시작' }).click();
    await resolveRoleProposal(page);
    await expect(page).toHaveURL(/\/career\/[^/]+$/);

    await advanceToChapter(page);
    await expect(page.getByRole('radio').first()).toBeVisible();

    await expectNoSeriousOrCriticalViolations(page, 'SCR-031(판단 확정)');

    await page.getByRole('radio').first().click();
    await page.getByRole('button', { name: '확정' }).click();
    await expect(page.getByRole('button', { name: '경기 결과' })).toBeVisible();
    await page.getByRole('button', { name: '경기 결과' }).click();
    await expect(page.getByRole('heading', { level: 2, name: '경기 결과' })).toBeVisible();

    await expectNoSeriousOrCriticalViolations(page, 'SCR-031(경기 결과)');
  });
});
