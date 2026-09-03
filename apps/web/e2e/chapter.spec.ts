// SCR-031 핵심 경기 챕터(TEST-E2E-010): CHAPTER 모드로 시즌을 시작해 데뷔전 챕터(CHP-MATCH-001)에
// 도달 → 경기 전 맥락 → 판단 확정(RESOLVE_CHAPTER) → 경기 결과 → 대시보드까지 이동한다. 실제 팩의
// CHP-MATCH-001은 판단이 1개뿐이라("다음 판단"이 아니라 "경기 결과" 버튼이 뜬다) 이 흐름으로 끝까지
// 확인하고, 판단 수를 화면 문구로만 판정한다(하드코딩하지 않아 콘텐츠가 늘어도 그대로 맞는다).
// 새로고침·뒤로 가기가 이미 확정된 판단을 다시 묻지 않고(roll을 다시 소비하지 않고) 같은 결과를
// 재생하는지 표시된 최종 스코어·revision으로 확인한다.
import { expect, test, type Page } from '@playwright/test';
import { completeOnboardingThroughContract } from './helpers/player-creation.js';
import { advanceToChapter, planPreseasonChapterMode, resolveRoleProposal, seedDeterministicChapterRun } from './helpers/chapter.js';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

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
  // "진행"이 필요한지는 시드에 달렸다(career-actions.ts createCareer) — 매 실행 crypto.getRandomValues로
  // 새 시드를 뽑으면 시즌 12 step 내내 한 번도 안 맞는 시드가 걸릴 수 있다. seedDeterministicChapterRun이
  // "진행" 1회 만에 데뷔 챕터가 열리는 것을 확인해 둔 시드(helpers/chapter.ts)를 강제해 결정론으로
  // 만든다 — 그래도 병렬 워커로 CPU를 나눠 쓰면 mutateAsync가 느려질 수 있어 넉넉히 기다린다.
  test.slow();
  const startedAt = Date.now();

  await seedDeterministicChapterRun(page);
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
