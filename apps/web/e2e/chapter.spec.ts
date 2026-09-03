// SCR-031 핵심 경기 챕터(TEST-E2E-010): CHAPTER 모드로 시즌을 시작해 데뷔전 챕터(CHP-MATCH-001)에
// 도달 → 경기 전 맥락 → 판단 확정(RESOLVE_CHAPTER) → 경기 결과 → 대시보드까지 이동한다. 실제 팩의
// CHP-MATCH-001은 판단이 1개뿐이라("다음 판단"이 아니라 "경기 결과" 버튼이 뜬다) 이 흐름으로 끝까지
// 확인하고, 판단 수를 화면 문구로만 판정한다(하드코딩하지 않아 콘텐츠가 늘어도 그대로 맞는다).
// 새로고침·뒤로 가기가 이미 확정된 판단을 다시 묻지 않고(roll을 다시 소비하지 않고) 같은 결과를
// 재생하는지 표시된 최종 스코어·revision으로 확인한다.
import { expect, test, type Page } from '@playwright/test';
import { completeOnboardingThroughContract, resolveCurrentEventScreen } from './helpers/player-creation.js';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

async function planPreseasonChapterMode(page: Page): Promise<void> {
  await page.getByRole('link', { name: '계획하러 가기' }).click();
  await expect(page).toHaveURL(/\/career\/.+\/preseason$/);
  await page.getByRole('radio', { name: /^챕터 시즌/ }).click();
  await page.getByRole('radio', { name: /^역할 집중/ }).click();
  await page.getByRole('link', { name: '다음' }).click();
  await expect(page).toHaveURL(/\/career\/.+\/season-prep\b/);
}

async function resolveRoleProposal(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/career\/.+\/role$/);
  // KEEP은 "확인" 하나, POSITION_CHANGE·ROLE_CHANGE는 "거절"·"수락" 둘을 보여준다 — 어느 쪽이든
  // 받아들이는 버튼을 하나의 locator로 묶어 렌더 경합 없이 기다린다(count() 스냅샷은 로더 직후
  // 첫 렌더 전에 0을 읽을 수 있다).
  const acceptButton = page.getByRole('button', { name: /^(확인|수락)$/ });
  await acceptButton.first().waitFor({ state: 'visible' });
  await acceptButton.first().click();
}

/** SCR-029에서 "진행"을 반복해(EVENT는 첫 선택지로 흘려보낸다) SCR-031(핵심 경기 챕터)에 도달한다.
 * 안전 상한 20회(season.spec.ts의 advanceThroughSeasonToSettlement와 같은 관례).
 *
 * CHAPTER pending은 screenForCareer가 SCR-031(= /chapter)로 바로 매핑하므로, advance 성공은 대시보드에
 * 머물지 않고 "진행" 버튼째 곧장 /chapter로 내비게이트해 버린다(EVENT도 마찬가지로 /event로 곧장
 * 간다). "버튼이 다시 켜짐"과 "화면이 전환됨"은 매 스텝마다 어느 쪽이 일어날지 모르는 두 갈래라 —
 * 클릭 직후에만 기다리고 다음 스텝 진입 시점의 pathname 재검사에만 기대면, mutateAsync가 아직
 * 안 끝난 채 다음 스텝에 들어가 "곧 사라질 버튼이 다시 켜지길" 기다리다 타임아웃할 수 있다(실제로는
 * 정상적으로 화면이 전환되는 중이다). 그래서 매 스텝 진입 시 이 둘을 함께 기다린 뒤에야 pathname으로
 * 어느 쪽이었는지 가린다.
 */
async function advanceToChapter(page: Page): Promise<void> {
  for (let step = 0; step < 20; step += 1) {
    const pathnameBefore = new URL(page.url()).pathname;
    if (pathnameBefore.endsWith('/chapter')) return;
    if (pathnameBefore.endsWith('/event')) {
      await resolveCurrentEventScreen(page);
      continue;
    }
    const nextButton = page.getByRole('button', { name: '진행' });
    // 병렬 워커로 같이 도는 다른 테스트와 CPU를 나눠 쓰면 mutateAsync가 기본 5s보다 오래 걸릴 수
    // 있다 — 넉넉히 기다린다.
    await Promise.race([
      page.waitForURL((url) => url.pathname !== pathnameBefore, { timeout: 60_000 }),
      expect(nextButton).toBeEnabled({ timeout: 60_000 }),
    ]);
    if (new URL(page.url()).pathname !== pathnameBefore) continue;
    // 클릭 액션 자체의 actionability 재확인 도중에도(디스패치 전) advance 성공→화면 전환이 끼어들어
    // 버튼이 사라질 수 있다 — 그 detach는 실패로 삼키고(클릭이 실제로 먹혔는지는 다음 스텝 진입 시
    // 위 Promise.race·pathname 재검사가 가린다), 여기서 무한정(테스트 전체 타임아웃까지) 기다리지
    // 않는다.
    await nextButton.click({ timeout: 15_000 }).catch(() => {});
  }
  throw new Error('핵심 경기 챕터(SCR-031)에 도달하지 못했다(최대 20회 시도)');
}

/** 허브로 갔다가 career-card의 data-revision을 읽고, 같은 커리어 대시보드로 돌아온다. */
async function readRevisionAndReturn(page: Page): Promise<number> {
  await page.goto('/');
  const revision = Number(await page.getByTestId('career-card').getAttribute('data-revision'));
  await page.getByRole('button', { name: '이어하기' }).click();
  return revision;
}

test('CHAPTER 모드 데뷔전: 경기 전 맥락 → 판단 확정 → 경기 결과 → 대시보드, 새로고침·뒤로 가기가 재생만 한다', async ({
  page,
}) => {
  // DEBUT 트리거(matchesTrigger: seasonIndex===1 && isFirstCareerAppearance && minutes>0)까지 몇 번의
  // "진행"이 필요한지는 매 실행 새로 뽑는 시드에 달렸다(crypto.getRandomValues 기반, career-actions.ts
  // createCareer) — 대부분 한두 번이면 열리지만, 기본 30s 테스트 타임아웃은 그 편차를 흡수하기엔
  // 빠듯하다.
  test.slow();
  const startedAt = Date.now();

  await completeOnboardingThroughContract(page);
  await planPreseasonChapterMode(page);
  await page.getByRole('button', { name: '시즌 시작' }).click();
  await resolveRoleProposal(page);
  await expect(page).toHaveURL(/\/career\/[^/]+$/);

  const revisionBeforeChapter = await readRevisionAndReturn(page);
  await advanceToChapter(page);

  // 경기 전 맥락(상단 고정): 데뷔전 라벨·스코어보드·출전 여부.
  await expect(page.getByRole('heading', { level: 1, name: '프로 데뷔전' })).toBeVisible();
  await expect(page.getByTestId('chapter-time-label')).toBeVisible();
  await expect(page.getByTestId('chapter-score')).toBeVisible();

  // D1의 세 선택지(SAFE·ROLE·BOLD)가 보인다.
  await expect(page.getByRole('radio', { name: /안전한 첫 플레이/ })).toBeVisible();
  await expect(page.getByRole('radio', { name: /역할 수행/ })).toBeVisible();
  await expect(page.getByRole('radio', { name: /과감한 존재감/ })).toBeVisible();

  await page.getByRole('radio').first().click();
  await page.getByRole('button', { name: '확정' }).click();

  // CHP-MATCH-001은 판단이 1개뿐이라 확정 즉시 pending이 닫힌다(nextAction ADVANCE) — "다음 판단"이
  // 아니라 "경기 결과" 버튼이 뜬다.
  await expect(page.getByRole('button', { name: '경기 결과' })).toBeVisible();
  await expect(page.getByRole('button', { name: '다음 판단' })).toHaveCount(0);

  // mid-flow 새로고침(경기 결과로 넘어가기 전): 판단을 다시 묻지 않고 곧장 결과로 간다 — roll을
  // 다시 소비했다면 스코어·평점이 실행마다 달라질 것이다(아래에서 대조).
  await page.reload();
  await expect(page.getByRole('heading', { level: 2, name: '경기 결과' })).toBeVisible();
  await expect(page.getByRole('radio')).toHaveCount(0);
  const finalScore = await page.locator('[aria-label^="최종 스코어"]').textContent();

  // 한 번 더 새로고침해도 같은 값이다(결정론).
  await page.reload();
  await expect(page.getByRole('heading', { level: 2, name: '경기 결과' })).toBeVisible();
  expect(await page.locator('[aria-label^="최종 스코어"]').textContent()).toBe(finalScore);

  // "다음"은 advance()를 부르지 않고 대시보드로만 이동한다(브리프 — pending은 이미 null).
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page).toHaveURL(/\/career\/[^/]+$/);

  // 뒤로 가기: 챕터 결과 화면이 재생만 한다(판단을 다시 묻지 않고, 같은 결과).
  await page.goBack();
  await expect(page.getByRole('heading', { level: 2, name: '경기 결과' })).toBeVisible();
  await expect(page.getByRole('radio')).toHaveCount(0);
  expect(await page.locator('[aria-label^="최종 스코어"]').textContent()).toBe(finalScore);

  const revisionAfterChapter = await readRevisionAndReturn(page);
  // START_SEASON + RESOLVE_ROLE + (advanceToChapter가 쓴 ADVANCE·RESOLVE_EVENT 수, 실행마다 다를 수
  // 있다) + RESOLVE_CHAPTER 1건 — 정확한 상한은 모르지만 최소 하나는 늘어야 한다.
  expect(revisionAfterChapter).toBeGreaterThan(revisionBeforeChapter);
  // 새로고침 2회·뒤로 가기 1회가 명령을 하나도 만들지 않았는지(재생 결정성) 다시 읽어 대조한다.
  const revisionSecondCheck = await readRevisionAndReturn(page);
  expect(revisionSecondCheck).toBe(revisionAfterChapter);

  const elapsedMs = Date.now() - startedAt;
  console.log(`[chapter] 계약 뒤 CHAPTER 시즌 시작→데뷔전 챕터 확정→대시보드 소요 시간: ${elapsedMs}ms`);
});
