// TEST-E2E-009 + 11 "세션 길이 목표"(첫 방문→첫 프로 계약 5분 이하, SCR-034 진입~SCR-010 완료):
// 온보딩 "건너뛰기" → 선수 만들기 → 진로 → 입단 테스트 → 제안 → 계약까지. 스텁 API.
//
// 08 "세션 길이·결정 예산 테스트"가 요구하는 두 값을 모두 기록한다: (a) 실제 브라우저 자동화 시간
// (performance.now() 차이), (b) "최소 조작 시간" — phase-1-plan.md D-22의 고정 단가(화면 1.0초·
// 선택 2.0초·텍스트 입력 4.0초·확정 1.5초, 애니메이션 대기는 건너뛰면 0)로 계산한다. 화면·선택·입력·
// 확정 횟수는 이 스크립트가 실제로 수행한 동작을 그대로 센다(자동 추정이 아니라 각 액션 옆에 직접
// 센다) — "화면"은 SCR ID가 바뀌는 새 라우트 진입, "선택"은 라디오·탭·카드·드롭다운 선택,
// "텍스트 입력"은 텍스트 필드 채움, "확정(CTA)"은 흐름을 다음으로 넘기는 버튼 클릭이다.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { expect, type Page, test } from '@playwright/test';
import {
  advanceThroughSeasonToSettlement,
  completeOnboardingThroughContract,
  fulfillJson,
  META,
  planPreseason,
  resolveRoleProposal,
} from './helpers/player-creation.js';
import { planPreseasonChapterMode, seedDeterministicChapterRun } from './helpers/chapter.js';

// SCR-008 입단 테스트 연출을 건너뛰어(reducedMotion) "애니메이션 대기" 항을 0으로 고정한다
// (D-22: "애니메이션 대기(건너뛰기 누르면 0)").
test.use({ contextOptions: { reducedMotion: 'reduce' } });

type Counts = { screens: number; selections: number; textInputs: number; confirmations: number };

const RATE_SEC = { screen: 1.0, selection: 2.0, textInput: 4.0, confirmation: 1.5 } as const;

function minimalHandlingSec(counts: Counts): number {
  return (
    counts.screens * RATE_SEC.screen +
    counts.selections * RATE_SEC.selection +
    counts.textInputs * RATE_SEC.textInput +
    counts.confirmations * RATE_SEC.confirmation
  );
}

/** 지금 뜬 이벤트 화면에서 선택지를 확정하고 결과 화면을 거쳐 다음으로 넘어가며, 그동안의 선택·
 * 확정·화면 전환을 counts에 더한다. */
async function resolveEventScreenCounting(page: Page, counts: Counts): Promise<void> {
  await page.getByRole('radio').first().click();
  counts.selections += 1;
  await page.getByRole('button', { name: '확정' }).click();
  counts.confirmations += 1;

  await expect(page).toHaveURL(/\/event\/result\?rev=\d+$/);
  counts.screens += 1; // SCR-014

  await page.getByRole('button', { name: '다음' }).click();
  counts.confirmations += 1;
}

test('온보딩 건너뛰기 → 첫 프로 계약: 자동화 시간과 최소 조작 시간을 측정한다', async ({ page }) => {
  const counts: Counts = { screens: 0, selections: 0, textInputs: 0, confirmations: 0 };

  await page.route('**/v1/profile', (route) =>
    fulfillJson(route, 503, {
      error: { code: 'SERVICE_UNAVAILABLE', message: '서비스를 이용할 수 없습니다.', retryable: true },
      meta: META,
    }),
  );

  const startedAt = performance.now();

  // SCR-034 온보딩 진입 → "건너뛰기"로 곧장 빈 허브(SCR-001)로.
  await page.goto('/onboarding');
  counts.screens += 1;
  await page.getByRole('button', { name: '건너뛰기' }).click();
  counts.confirmations += 1;
  await expect(page).toHaveURL(/\/$/);
  counts.screens += 1;

  // 허브에서 "커리어 시작" → SCR-002.
  await page.getByRole('button', { name: '커리어 시작' }).click();
  counts.confirmations += 1;
  await expect(page).toHaveURL(/\/career\/.+\/create$/);
  counts.screens += 1;

  // SCR-002: 이름(텍스트 입력 1) + 성별·국적·주발·포지션 구분 탭·포지션·배경(선택 6).
  await page.getByLabel('이름').fill('김서준');
  counts.textInputs += 1;
  await page.getByRole('radio', { name: '남성' }).click();
  counts.selections += 1;
  await page.getByLabel('국적').selectOption('KR');
  counts.selections += 1;
  await page.getByRole('radio', { name: '왼발' }).click();
  counts.selections += 1;
  await page.getByRole('tab', { name: '공격수' }).click();
  counts.selections += 1;
  await page.getByRole('radio', { name: /윙어/ }).click();
  counts.selections += 1;
  await page.getByRole('radio', { name: /클럽 아카데미/ }).click();
  counts.selections += 1;
  await page.getByRole('button', { name: '다음' }).click();
  counts.confirmations += 1;
  await expect(page).toHaveURL(/\/career\/.+\/style$/);
  counts.screens += 1;

  // SCR-003: 아키타입 선택(선택 1).
  await page.getByRole('radio', { name: '인사이드 포워드 선택' }).click();
  counts.selections += 1;
  await page.getByRole('button', { name: '다음' }).click();
  counts.confirmations += 1;
  await expect(page).toHaveURL(/\/career\/.+\/confirm$/);
  counts.screens += 1;

  // SCR-004: KICKOFF(확정) → 복구 코드 발급 실패(스텁) → "계속"(확정) → 이벤트 화면.
  await page.getByRole('button', { name: 'KICKOFF' }).click();
  counts.confirmations += 1;
  await expect(page.getByText('지금은 발급할 수 없습니다. 설정에서 나중에 발급할 수 있습니다.')).toBeVisible();
  await page.getByRole('button', { name: '계속' }).click();
  counts.confirmations += 1;
  await expect(page).toHaveURL(/\/career\/.+\/(path|tryout|event)$/);
  counts.screens += 1;

  // SCR-007/008/013(반복) → SCR-014 → ... → SCR-009. 안전 상한 10회(first-contract.spec.ts와 동일).
  let reachedOffers = false;
  for (let step = 0; step < 10 && !reachedOffers; step += 1) {
    await page.waitForURL(/\/career\/.+\/(path|tryout|event|offers)$/);
    if (new URL(page.url()).pathname.endsWith('/offers')) {
      reachedOffers = true;
      break;
    }
    await resolveEventScreenCounting(page, counts);
    counts.screens += 1; // 다음 이벤트 화면 또는 offers
  }
  if (!reachedOffers) throw new Error('offers 화면에 도달하지 못했다(최대 10회 시도)');

  await expect(page.getByRole('heading', { level: 1, name: '제안 비교' })).toBeVisible();

  // SCR-009: 제안 선택(확정) → SCR-010.
  await page.getByRole('link', { name: '이 제안 보기' }).first().click();
  counts.confirmations += 1;
  await expect(page).toHaveURL(/\/career\/.+\/contract\?offerId=.+$/);
  counts.screens += 1;

  // SCR-010: 사인(확정) → 계약 완료(대시보드).
  await page.getByRole('button', { name: '사인' }).click();
  counts.confirmations += 1;
  await expect(page).toHaveURL(/\/career\/[^/]+$/);
  await expect(page.getByText('계약을 맺었습니다')).toBeVisible();

  const automationMs = performance.now() - startedAt;

  const result = { automationMs, minimalHandlingSec: minimalHandlingSec(counts), counts };
  console.log(`[session-length] ${JSON.stringify(result)}`);

  const outDir = path.join(import.meta.dirname, '..', 'test-results');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, 'session-length.json'), JSON.stringify(result, null, 2));

  expect(automationMs).toBeLessThan(5 * 60 * 1000);
  expect(result.minimalHandlingSec).toBeLessThan(5 * 60);
});

// T-2-011 8번 "FAST 6분·CHAPTER 12분 스크립트 플레이": 계약 뒤 시즌 하나를 완주시키며 (a) 실제
// 자동화 시간(performance.now() 차이)과 (b) 시즌 진행 중 발생한 도메인 명령 수를 기록한다. 여기서는
// D-22 고정 단가로 "최소 조작 시간"을 계산하지 않는다(브리프: "판정 기준은 자동화 시간 × 사람 보정이
// 아니라 자동화 시간 자체를 기록") — 사람 기준 6분/12분 판정은 오케스트레이터가 U-005 플레이테스트
// 결과와 합쳐 별도로 내린다. 그래서 이 두 테스트는 시간에 대한 통과·실패 기준을 걸지 않는다.
//
// 명령 수는 hub의 career-card `data-revision`(커맨드 하나당 revision +1)을 시즌 시작 직전·직후에
// 각각 읽어 차이를 낸다 — season.spec.ts "시즌을 두 번 시작하지 않는다" 테스트가 이미 쓰는 방식과
// 같다. 시즌 시작 직전 값에서 START_SEASON·RESOLVE_ROLE 2건을, 결산 직전 값에서 결산 자체
// (SETTLE_SEASON, "결산하기" 클릭 1건)를 빼면 그 사이(advanceThroughSeasonToSettlement)에서 실제로
// 나간 ADVANCE·RESOLVE_EVENT·RESOLVE_CHAPTER 합계만 남는다. 세 종류를 개별로 세려면
// helpers/player-creation.ts·helpers/chapter.ts의 폴링 로직 자체를 계측용으로 고쳐야 하는데, 이
// 헬퍼들은 그대로 쓰기로 했으므로(TOCTOU를 피하려 공들여 다듬은 대기 로직을 다시 손대지 않는다)
// 합계 하나로만 보고한다.
//
// FAST·CHAPTER 둘 다 chapter.spec.ts와 같은 결정론 시드(E2E_DEBUT_CHAPTER_SEED)를 강제한다 — 매
// 실행 새 시드(crypto.getRandomValues)를 쓰면 시즌 진행에 필요한 "진행" 횟수·챕터/이벤트 등장
// 여부가 매번 달라져 두 모드의 자동화 시간을 비교할 수 없다.
async function readRevisionAndReturn(page: Page): Promise<number> {
  await page.goto('/');
  const revision = Number(await page.getByTestId('career-card').getAttribute('data-revision'));
  await page.getByRole('button', { name: '이어하기' }).click();
  return revision;
}

test.describe('T-2-011 8번: 시즌 완주 스크립트 플레이 시간', () => {
  test('FAST 시즌 1개 완주(프리시즌 계획→결산 화면): 자동화 시간·명령 수를 기록한다', async ({ page }) => {
    test.slow();

    await seedDeterministicChapterRun(page);
    await completeOnboardingThroughContract(page);

    const startedAt = performance.now();

    await planPreseason(page, 'FAST', '빠른 시즌', '역할 집중');
    await page.getByRole('button', { name: '시즌 시작' }).click();
    await resolveRoleProposal(page);
    await expect(page).toHaveURL(/\/career\/[^/]+$/);

    const revisionAtSeasonStart = await readRevisionAndReturn(page);

    await advanceThroughSeasonToSettlement(page);
    const revisionBeforeSettle = await readRevisionAndReturn(page);

    await page.getByRole('button', { name: '결산하기', exact: true }).click();
    await expect(page).toHaveURL(/\/career\/.+\/season-result$/);
    await expect(page.getByRole('heading', { level: 1, name: '프로 시즌 결과' })).toBeVisible();

    const automationMs = performance.now() - startedAt;
    // revisionAtSeasonStart는 이미 START_SEASON+RESOLVE_ROLE을 포함한 값이므로 그대로 빼면
    // advanceThroughSeasonToSettlement가 만든 ADVANCE·RESOLVE_EVENT·RESOLVE_CHAPTER 합계만 남는다.
    const commandCount = revisionBeforeSettle - revisionAtSeasonStart;

    const result = { mode: 'FAST', automationMs, commandCount, budgetMs: 60_000 };
    console.log(`[session-length:fast-season] ${JSON.stringify(result)}`);

    const outDir = path.join(import.meta.dirname, '..', 'test-results');
    mkdirSync(outDir, { recursive: true });
    writeFileSync(path.join(outDir, 'session-length-fast-season.json'), JSON.stringify(result, null, 2));
  });

  test('CHAPTER 시즌 1개 완주(프리시즌 계획→결산 화면, 챕터 판단 포함): 자동화 시간·명령 수를 기록한다', async ({
    page,
  }) => {
    test.slow();

    await seedDeterministicChapterRun(page);
    await completeOnboardingThroughContract(page);

    const startedAt = performance.now();

    await planPreseasonChapterMode(page);
    await page.getByRole('button', { name: '시즌 시작' }).click();
    await resolveRoleProposal(page);
    await expect(page).toHaveURL(/\/career\/[^/]+$/);

    const revisionAtSeasonStart = await readRevisionAndReturn(page);

    await advanceThroughSeasonToSettlement(page);
    const revisionBeforeSettle = await readRevisionAndReturn(page);

    await page.getByRole('button', { name: '결산하기', exact: true }).click();
    await expect(page).toHaveURL(/\/career\/.+\/season-result$/);
    await expect(page.getByRole('heading', { level: 1, name: '프로 시즌 결과' })).toBeVisible();

    const automationMs = performance.now() - startedAt;
    const commandCount = revisionBeforeSettle - revisionAtSeasonStart;

    const result = { mode: 'CHAPTER', automationMs, commandCount, budgetMs: 120_000 };
    console.log(`[session-length:chapter-season] ${JSON.stringify(result)}`);

    const outDir = path.join(import.meta.dirname, '..', 'test-results');
    mkdirSync(outDir, { recursive: true });
    writeFileSync(path.join(outDir, 'session-length-chapter-season.json'), JSON.stringify(result, null, 2));
  });
});
