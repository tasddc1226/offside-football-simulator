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
  // KEEP은 "확인" 하나, POSITION_CHANGE·ROLE_CHANGE는 "거절"·"수락" 둘을 보여준다 — 어느 쪽이든
  // 받아들이는 버튼을 하나의 locator로 묶어 렌더 경합 없이 기다린다(count() 스냅샷은 로더 직후
  // 첫 렌더 전에 0을 읽을 수 있다).
  const acceptButton = page.getByRole('button', { name: /^(확인|수락)$/ });
  await acceptButton.first().waitFor({ state: 'visible' });
  await acceptButton.first().click();
}

/** SCR-031(핵심 경기 챕터): T-2-008 이전에는 advance가 chapterCandidates를 채우지 않아 이 슬롯이
 * 열릴 일이 없었다(그래서 이 파일의 원래 코멘트는 CHAPTER를 CONTRACT와 함께 "자동 통과"로 적어
 * 뒀었다 — 틀렸다: packages/domain의 isAutoPassablePending은 CHAPTER를 자동 통과 대상에서 뺀다).
 * FAST 모드라도 MAJOR 챕터(예: 데뷔전)는 열린다(selectChapter는 importance==='MAJOR'면 FAST도
 * 통과시킨다) — 그래서 이 시즌 전체 흐름 테스트도 챕터를 만날 수 있다. 세부 판단 내용은
 * chapter.spec.ts가 검증하므로, 여기서는 남은 판단을 모두 첫 선택지로 확정하고 결과 화면을 지나
 * "다음"으로 대시보드까지 최단 경로로 통과시킨다. 안전 상한 10회.
 *
 * 라디오·진행 버튼 중 뭐가 뜰지 매 스텝 다르므로, 그중 하나가 나타날 때까지 먼저 기다린 뒤에야
 * count()로 어느 쪽인지 가린다(기다리지 않고 바로 count()를 읽으면 로더 직후 첫 렌더 전 0을 읽는
 * 경합이 난다 — chapter.spec.ts의 resolveRoleProposal과 같은 종류의 문제). */
async function resolveCurrentChapterScreen(page: Page): Promise<void> {
  for (let step = 0; step < 10; step += 1) {
    const nextButton = page.getByRole('button', { name: '다음' });
    const progressButton = page.getByRole('button', { name: /^(다음 판단|경기 결과)$/ });
    const radio = page.getByRole('radio').first();
    await nextButton.or(progressButton).or(radio).first().waitFor({ state: 'visible' });

    if ((await nextButton.count()) > 0) {
      await nextButton.click();
      return;
    }
    if ((await progressButton.count()) > 0) {
      await progressButton.click();
      continue;
    }
    await radio.click();
    await page.getByRole('button', { name: '확정' }).click();
    // 확정 뒤 결과(다음 판단·경기 결과 버튼)로 전환되길 기다린다 — 이 대기 없이 곧장 다음 루프로
    // 가면 라디오가 checked·disabled로 전환되는 프레임을 "아직 안 골랐다"로 오판해 같은 라디오를
    // 다시 클릭해 버린다(사라지기 직전 라디오를 잡는 detach 경합).
    await progressButton.or(nextButton).first().waitFor({ state: 'visible' });
  }
  throw new Error('챕터 화면(SCR-031)을 벗어나지 못했다(최대 10회 시도)');
}

/** SCR-029에서 "진행"을 반복해(CONTRACT 자동 통과 슬롯, CHAPTER는 위 resolveCurrentChapterScreen으로
 * 직접 통과시킨다) SETTLEMENT("결산하기")까지 도달한다. 안전 상한 20회.
 *
 * "진행"·"결산하기"는 exact locator로 서로 완전히 분리한다 — 예전에는 하나의 regex locator
 * (`/^(진행|결산하기)$/`)로 묶었는데, "진행" 클릭 직후 다음 루프에 들어가면 mutateAsync의 isPending
 * 반영(disabled)이 아직 DOM에 안 실린 틈이 있어 `toBeEnabled`가 즉시 통과 → click()이 actionability
 * 재확인 중 대기하는 사이 step 12/12가 되어 버튼이 결산하기로 바뀌는데, 같은 regex locator라 그
 * 바뀐 버튼에 클릭이 그대로 떨어져(TOCTOU) season-result로 새는 경우가 있었다(부하가 걸려 창이
 * 넓어지면 재현). "진행" exact locator는 이름이 바뀐 순간 더 이상 매치되지 않으므로 이 오클릭이
 * 원천적으로 없다.
 *
 * CHAPTER/EVENT를 열면 대시보드에 머물지 않고 버튼째 곧장 그 화면으로 내비게이트된다("버튼이 다시
 * 켜짐"과 "화면이 전환됨"은 매 스텝마다 어느 쪽이 일어날지 모르는 두 갈래다) — 클릭 직후에만
 * 기다리고 다음 스텝 진입 시점의 pathname 재검사에만 기대면, mutateAsync가 아직 안 끝난 채 다음
 * 스텝에 들어가 "곧 사라질 버튼이 다시 켜지길" 기다리다 타임아웃할 수 있다(실제로는 정상적으로
 * 화면이 전환되는 중이다). 그래서 매 스텝 진입 시 이 둘을 함께 기다린 뒤에야 pathname으로 어느
 * 쪽이었는지 가린다. 클릭 뒤에도 마찬가지로 헤더의 step 텍스트 변화 또는 pathname 변화 — 관측
 * 가능한 상태 변화 — 를 기다린 뒤에야 다음 루프로 들어가서, 같은 step에서 두 번 클릭하는 일이 없게
 * 한다. */
async function advanceThroughSeasonToSettlement(page: Page): Promise<void> {
  const progressButton = page.getByRole('button', { name: '진행', exact: true });
  const settleButton = page.getByRole('button', { name: '결산하기', exact: true });
  const stepCaption = page.getByText(/step \d+\/12/);
  for (let step = 0; step < 20; step += 1) {
    const pathnameBefore = new URL(page.url()).pathname;
    if (pathnameBefore.endsWith('/chapter')) {
      await resolveCurrentChapterScreen(page);
      continue;
    }
    if (/\/(event|path|tryout)$/.test(pathnameBefore)) {
      await resolveCurrentEventScreen(page);
      continue;
    }
    if (await settleButton.isVisible()) return;
    // 병렬 워커로 같이 도는 다른 테스트와 CPU를 나눠 쓰면 mutateAsync가 기본 5s보다 오래 걸릴 수
    // 있다 — 넉넉히 기다린다.
    await Promise.race([
      page.waitForURL((url) => url.pathname !== pathnameBefore, { timeout: 60_000 }),
      expect(progressButton).toBeEnabled({ timeout: 60_000 }),
      settleButton.waitFor({ state: 'visible', timeout: 60_000 }),
    ]);
    if (new URL(page.url()).pathname !== pathnameBefore) continue;
    if (await settleButton.isVisible()) return;
    const stepTextBefore = await stepCaption.textContent();
    // 클릭 액션 자체의 actionability 재확인 도중에도(디스패치 전) advance 성공→화면 전환이 끼어들어
    // 버튼이 사라질 수 있다 — 그 detach는 실패로 삼키고(클릭이 실제로 먹혔는지는 다음 스텝 진입 시
    // 위 pathname·step 텍스트 재검사가 가린다), 여기서 무한정(테스트 전체 타임아웃까지) 기다리지
    // 않는다.
    await progressButton.click({ timeout: 15_000 }).catch(() => {});
    await Promise.race([
      page.waitForURL((url) => url.pathname !== pathnameBefore, { timeout: 60_000 }),
      expect(stepCaption).not.toHaveText(stepTextBefore ?? '', { timeout: 60_000 }),
    ]);
  }
  throw new Error('SETTLEMENT(결산하기)에 도달하지 못했다(최대 20회 시도)');
}

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
