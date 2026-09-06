// T-2-007: SCR-005(프리시즌 계획) → SCR-011(시즌 준비) → SCR-012(역할 제안) → SCR-029(시즌 진행,
// 반복) → 시즌 결산 → SCR-015(자리표시) → 대시보드가 다시 "프리시즌 계획"을 보여준다(시즌 2).
// FAST 모드는 역할 결정 뒤 EVENT 슬롯을 열지 않는다(CHAPTER만 자동 통과, T-3-003 §5: CONTRACT는
// 제안이 있으면 더 이상 자동 통과하지 않는다) — 그래도 만약을 대비해 이벤트 화면이 뜨면 첫 선택지로
// 넘기도록 대비한다(first-contract.spec.ts와 같은 관례).
import { expect, test } from '@playwright/test';
import {
  advanceThroughSeasonToSettlement,
  completeOnboardingThroughContract,
  planPreseason,
  resolveRoleProposal,
  signFirstOffer,
} from './helpers/player-creation.js';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

test('시즌 전체 흐름: 프리시즌 계획 → 시즌 준비 → 역할 제안 → 진행 반복 → 시즌 결산 → 다음 시즌', async ({ page }) => {
  // 12 step 전체 시즌을 결산까지 미는 데다(T-2-008: FAST 모드에서도 MAJOR 챕터가 열려 판단까지 거칠
  // 수 있다) 매 실행 새 시드(crypto.getRandomValues)로 필요한 "진행" 횟수가 달라진다 — 기본 30s
  // 테스트 타임아웃은 그 편차를 흡수하기엔 빠듯하다.
  test.slow();
  const startedAt = Date.now();

  await completeOnboardingThroughContract(page);

  await planPreseason(page, 'FAST', '빠른 시즌', '역할 집중');
  await page.getByRole('button', { name: '시즌 시작' }).click();
  await resolveRoleProposal(page);

  await expect(page).toHaveURL(/\/career\/[^/]+$/);
  await expect(page.getByText('시즌 1 · 1/12 단계')).toBeVisible();
  await page.getByRole('tab', { name: '일정' }).click();
  const seasonTimeline = page.getByLabel('시즌 진행 12 step');
  await expect(seasonTimeline).toBeVisible();
  await expect(seasonTimeline.locator('li')).toHaveCount(12);

  // 새로고침해도 진행 중인 step이 그대로 유지된다(로컬 우선 — ADR-002).
  await page.reload();
  await expect(page.getByText('시즌 1 · 1/12 단계')).toBeVisible();

  await advanceThroughSeasonToSettlement(page);

  // 일정 탭: 시즌 대부분을 진행했으니 최소 한 경기는 스코어가 잡혀 있어야 한다.
  await page.getByRole('tab', { name: '일정' }).click();
  await expect(page.getByText(/\d+:\d+/).first()).toBeVisible();

  // 전술실 구역: 선발 순위 목록에 내 이름 행이 있다.
  await page.getByRole('tab', { name: '선수' }).click();
  await expect(page.getByText('(나)')).toBeVisible();

  // SCR-033: "표시된 능력 × 가중치"가 헤더 Base OVR과 같다(인수 조건).
  await page.getByRole('link', { name: '능력치 상세' }).click();
  await expect(page).toHaveURL(/\/career\/.+\/attributes$/);
  const headerText = await page.getByText(/^Base OVR \d+$/).textContent();
  const computedText = await page.getByText(/^표시된 능력 × 가중치 = \d+$/).textContent();
  expect(computedText?.replace('표시된 능력 × 가중치 = ', '')).toBe(headerText?.replace('Base OVR ', ''));
  // 진짜 잠재력은 이 화면 어디에도 없다(정찰 범위만 보인다).
  await expect(page.getByText('정찰 범위')).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/career\/[^/]+\?view=player$/);

  await page.getByRole('tab', { name: '홈' }).click();
  await page.getByRole('button', { name: '결산하기' }).click();
  await expect(page).toHaveURL(/\/career\/.+\/season-result$/);
  await expect(page.getByRole('heading', { level: 1, name: '프로 시즌 결과' })).toBeVisible();

  await page.getByRole('link', { name: '대시보드' }).click();
  await expect(page).toHaveURL(/\/career\/[^/]+$/);

  // T-3-003 §5: 결산 뒤 계약이 만료·관심 조건에 걸리면 시장이 자동으로 열려, "프리시즌 계획" 대신
  // 제안 카드가 먼저 뜰 수 있다 — 그러면 안전 잔류(첫 제안)를 수락하고 진짜 "프리시즌 계획"으로 간다.
  // STAY(안전 잔류) 수락 뒤에는 결과 카드의 "새 시즌 준비" CTA가 대시보드를 거치지 않고 바로
  // /preseason(SCR-005 프리시즌 계획)에 도착시킬 수 있다(PR #81, signFirstOffer 참고).
  const planCta = page.getByRole('link', { name: '계획하러 가기' });
  const offersCta = page.getByRole('link', { name: '제안 보기' });
  await expect(planCta.or(offersCta)).toBeVisible();
  if (await offersCta.isVisible()) {
    await offersCta.click();
    await signFirstOffer(page);
  }
  if (!/\/preseason$/.test(page.url())) {
    await expect(planCta).toBeVisible();
  }

  const elapsedMs = Date.now() - startedAt;
  console.log(`[season] 계약 뒤 시즌 1 전체(프리시즌 계획→결산)→시즌 2 프리시즌 계획 소요 시간: ${elapsedMs}ms`);
});

test('SCR-011에서 시즌을 시작한 뒤 뒤로 가기로 재진입해도 시즌을 두 번 시작하지 않는다', async ({ page }) => {
  await completeOnboardingThroughContract(page);

  await page.goto('/');
  const revisionBeforeStart = Number(await page.getByTestId('career-card').getAttribute('data-revision'));
  await page.getByRole('button', { name: '이어하기' }).click();

  await planPreseason(page, 'FAST', '빠른 시즌', '역할 집중');
  await page.getByRole('button', { name: '시즌 시작' }).click();
  await resolveRoleProposal(page);
  await expect(page).toHaveURL(/\/career\/[^/]+$/);

  await page.goto('/');
  const revisionAfterStart = Number(await page.getByTestId('career-card').getAttribute('data-revision'));
  // START_SEASON + RESOLVE_ROLE(resolveRoleProposal) = 명령 2개.
  expect(revisionAfterStart).toBe(revisionBeforeStart + 2);

  // 브라우저 뒤로 가기: role → season-prep(스택에 남은 옛 URL). 시즌이 이미 있으니 로더가 즉시
  // 대시보드로 돌려보내 "시즌 시작" 버튼을 다시 보여주지 않는다(season-prep.tsx 로더 가드).
  await page.getByRole('button', { name: '이어하기' }).click();
  await expect(page).toHaveURL(/\/career\/[^/]+$/);
  await page.goto(`${page.url()}/season-prep?mode=FAST&focus=ROLE`);
  await expect(page).not.toHaveURL(/\/season-prep/);
  await expect(page.getByRole('button', { name: '시즌 시작' })).not.toBeVisible();

  await page.goto('/');
  const revisionFinal = Number(await page.getByTestId('career-card').getAttribute('data-revision'));
  // 뒤로 가기로 재진입해도 로더가 즉시 돌려보내 새 명령이 나가지 않는다 — revisionAfterStart와 같아야 한다.
  expect(revisionFinal).toBe(revisionAfterStart);
});

/** T-4-010: 시즌 1 결산 뒤 시장 사유가 INTEREST("타 구단 관심")로 열리는 결정론적 seed. DEV
 * 훅(`offside:e2e-seed`)으로 20개 후보 중 `e2e/_seed-search.spec.ts`(PR에는 남기지 않은 탐색용
 * 스펙)로 찾았다 — 매번 새 무작위 seed를 쓰면 이 경로(타이밍이 아니라 seed 의존 상태 분기, 원인 2)가
 * 우연히만 재현돼 회귀를 잡지 못한다. */
const E2E_INTEREST_MARKET_SEED = 't4010-interest-search-11';

test('시즌 1 결산 뒤 INTEREST 시장이 열리면 안전 잔류 제안을 수락하고 새 시즌 준비로 이동한다', async ({ page }) => {
  await page.addInitScript((seed) => window.localStorage.setItem('offside:e2e-seed', seed), E2E_INTEREST_MARKET_SEED);
  await completeOnboardingThroughContract(page);

  await planPreseason(page, 'FAST', '빠른 시즌', '역할 집중');
  await page.getByRole('button', { name: '시즌 시작' }).click();
  await resolveRoleProposal(page);
  await advanceThroughSeasonToSettlement(page);

  await page.getByRole('button', { name: '결산하기' }).click();
  await expect(page).toHaveURL(/\/career\/.+\/season-result$/);

  // 결산 화면의 다음 시즌 CTA가 최신 pending 시장 상태를 직접 가리킨다.
  const offersCta = page.getByRole('link', { name: '다음 시즌' });
  await expect(offersCta).toBeVisible();
  await offersCta.click();
  await expect(page.getByRole('definition').filter({ hasText: '타 구단 관심' })).toBeVisible();
  // signFirstOffer는 offers[0](안전 잔류)을 수락한다 — STAY 결과 카드에 도착해 "새 시즌 준비"로
  // 프리시즌에 닿는다(state.season === null이면 ctaToPreseason이 그리로 보낸다, PR #76).
  await signFirstOffer(page);
  await expect(page).toHaveURL(/\/career\/[^/]+(?:\/preseason)?$/);
});
