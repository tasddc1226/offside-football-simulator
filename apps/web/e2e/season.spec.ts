// T-2-007: SCR-005(프리시즌 계획) → SCR-011(시즌 준비) → SCR-012(역할 제안) → SCR-029(시즌 진행,
// 반복) → 시즌 결산 → SCR-015(자리표시) → 대시보드가 다시 "프리시즌 계획"을 보여준다(시즌 2).
// FAST 모드는 역할 결정 뒤 EVENT 슬롯을 열지 않는다(CHAPTER·CONTRACT만 자동 통과) — 그래도 만약을
// 대비해 이벤트 화면이 뜨면 첫 선택지로 넘기도록 대비한다(first-contract.spec.ts와 같은 관례).
import { expect, test, type Page } from '@playwright/test';
import { completeOnboardingThroughContract, resolveCurrentEventScreen } from './helpers/player-creation.js';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

/** SCR-029의 "프리시즌 계획" CTA에서 SCR-005 입력·SCR-011 확인까지: 모드·훈련 계획을 고르고
 * search 파라미터로 넘어가는지 확인한다. */
async function planPreseason(page: Page, mode: 'FAST' | 'CHAPTER', modeLabel: string, focusLabel: string): Promise<void> {
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
async function resolveRoleProposal(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/career\/.+\/role$/);
  const confirmButton = page.getByRole('button', { name: '확인' });
  if ((await confirmButton.count()) > 0) {
    await confirmButton.click();
  } else {
    await page.getByRole('button', { name: '수락' }).click();
  }
}

/** SCR-029에서 "진행"을 반복해(CHAPTER·CONTRACT 자동 통과 슬롯) SETTLEMENT("결산하기")까지
 * 도달한다. 안전 상한 20회. */
async function advanceThroughSeasonToSettlement(page: Page): Promise<void> {
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

test('시즌 전체 흐름: 프리시즌 계획 → 시즌 준비 → 역할 제안 → 진행 반복 → 시즌 결산 → 다음 시즌', async ({ page }) => {
  const startedAt = Date.now();

  await completeOnboardingThroughContract(page);

  await planPreseason(page, 'FAST', '빠른 시즌', '역할 집중');
  await page.getByRole('button', { name: '시즌 시작' }).click();
  await resolveRoleProposal(page);

  await expect(page).toHaveURL(/\/career\/[^/]+$/);
  await expect(page.getByText(/시즌 1 · .* · step 1\/12/)).toBeVisible();
  const seasonTimeline = page.getByLabel('시즌 진행 12 step');
  await expect(seasonTimeline).toBeVisible();
  await expect(seasonTimeline.locator('li')).toHaveCount(12);

  // 새로고침해도 진행 중인 step이 그대로 유지된다(로컬 우선 — ADR-002).
  await page.reload();
  await expect(page.getByText(/시즌 1 · .* · step 1\/12/)).toBeVisible();

  await advanceThroughSeasonToSettlement(page);

  // 일정표 구역(기본 탭): 시즌 대부분을 진행했으니 최소 한 경기는 스코어가 잡혀 있어야 한다.
  await page.getByRole('tab', { name: '일정표' }).click();
  await expect(page.getByText(/\d+:\d+/).first()).toBeVisible();

  // 전술실 구역: 선발 순위 목록에 내 이름 행이 있다.
  await page.getByRole('tab', { name: '전술실' }).click();
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
  await expect(page).toHaveURL(/\/career\/[^/]+$/);

  await page.getByRole('button', { name: '결산하기' }).click();
  await expect(page).toHaveURL(/\/career\/.+\/season-result$/);
  await expect(page.getByText('준비 중')).toBeVisible();

  await page.getByRole('link', { name: '대시보드로' }).click();
  await expect(page).toHaveURL(/\/career\/[^/]+$/);
  await expect(page.getByRole('link', { name: '계획하러 가기' })).toBeVisible();

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
