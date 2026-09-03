// SCR-031(핵심 경기 챕터) 도달 헬퍼. chapter.spec.ts·a11y.spec.ts가 공유한다(T-1-014 player-creation.ts와
// 같은 관례: "헬퍼 추출은 허용").
import { expect, type Page } from '@playwright/test';
import { resolveCurrentEventScreen } from './player-creation.js';

/** SCR-011 시즌 준비에서 CHAPTER 모드·역할 집중을 골라 season-prep까지 이동한다. */
export async function planPreseasonChapterMode(page: Page): Promise<void> {
  await page.getByRole('link', { name: '계획하러 가기' }).click();
  await expect(page).toHaveURL(/\/career\/.+\/preseason$/);
  await page.getByRole('radio', { name: /^챕터 시즌/ }).click();
  await page.getByRole('radio', { name: /^역할 집중/ }).click();
  await page.getByRole('link', { name: '다음' }).click();
  await expect(page).toHaveURL(/\/career\/.+\/season-prep\b/);
}

/** SCR-012 역할 제안을 받아들인다. */
export async function resolveRoleProposal(page: Page): Promise<void> {
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
export async function advanceToChapter(page: Page): Promise<void> {
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
