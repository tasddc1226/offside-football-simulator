// create.spec.ts·first-contract.spec.ts·resilience.spec.ts·session-length.spec.ts가 함께 쓰는 온보딩
// → SCR-002~004 → 이벤트 화면 도착 흐름. T-1-014에서 create.spec.ts·first-contract.spec.ts의 중복
// 정의를 이 파일로 뽑았다(브리프: "헬퍼 추출은 허용"). 기존 스펙의 동작·검증 내용은 바꾸지 않았다.
import { expect, type Page, type Route } from '@playwright/test';

export const META = { requestId: 'e2e-req' };

export async function fulfillJson(route: Route, status: number, body: unknown): Promise<void> {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

/** 온보딩 → KICKOFF로 SCR-002(선수 정보 입력)까지 이동한다. */
export async function startNewCareer(page: Page): Promise<void> {
  await page.goto('/onboarding');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: 'KICKOFF' }).click();
  await expect(page).toHaveURL(/\/career\/.+\/create$/);
}

/** SCR-002의 6개 필드(성별·선호 포지션 포함, PR #32/T-1-016)를 채운다. */
export async function fillPlayerInfo(page: Page, name = '김서준'): Promise<void> {
  await page.getByLabel('이름').fill(name);
  await page.getByRole('radio', { name: '남성' }).click();
  await page.getByLabel('국적').selectOption('KR');
  await page.getByRole('radio', { name: '왼발' }).click();
  await page.getByRole('tab', { name: '공격수' }).click();
  await page.getByRole('radio', { name: /윙어/ }).click();
  await page.getByRole('radio', { name: /클럽 아카데미/ }).click();
}

/** SCR-002 입력 → SCR-003 스타일 선택 → SCR-004 확인 화면 도착까지. */
export async function goToConfirm(page: Page): Promise<void> {
  await startNewCareer(page);
  await fillPlayerInfo(page);
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page).toHaveURL(/\/career\/.+\/style$/);

  await page.getByRole('radio', { name: '인사이드 포워드 선택' }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page).toHaveURL(/\/career\/.+\/confirm$/);
  await expect(page.getByRole('heading', { level: 1, name: '확정 전 정보를 확인하세요' })).toBeVisible();
}

/**
 * 온보딩 → KICKOFF → SCR-002 입력 → SCR-003 스타일 선택 → SCR-004 확정(복구 코드 발급 실패로
 * 스텁 → "계속") → SCR-007/008/013 계열 도착까지. first-contract.spec.ts의 원래 정의와 동일하다.
 */
export async function completeOnboardingAndConfirm(page: Page): Promise<void> {
  await goToConfirm(page);

  await page.route('**/v1/profile', (route) =>
    fulfillJson(route, 503, {
      error: { code: 'SERVICE_UNAVAILABLE', message: '서비스를 이용할 수 없습니다.', retryable: true },
      meta: META,
    }),
  );
  await page.getByRole('button', { name: 'KICKOFF' }).click();
  await expect(page.getByText('지금은 발급할 수 없습니다. 설정에서 나중에 발급할 수 있습니다.')).toBeVisible();
  await page.getByRole('button', { name: '계속' }).click();

  await expect(page).toHaveURL(/\/career\/.+\/(path|tryout|event)$/);
}

/** 지금 뜬 이벤트 화면(SCR-007·008·013 공통 본문)에서 첫 선택지를 확정하고, SCR-014 결과 카드를
 * 거쳐 "다음"으로 넘어간다. 선택지 자체(어떤 라벨인지)는 보지 않는다. */
export async function resolveCurrentEventScreen(page: Page): Promise<void> {
  await page.getByRole('radio').first().click();
  await page.getByRole('button', { name: '확정' }).click();

  await expect(page).toHaveURL(/\/event\/result\?rev=\d+$/);
  await page.getByRole('button', { name: '다음' }).click();
}

/** OFFERS(SCR-009)에 도착할 때까지 이벤트 화면을 반복해서 넘긴다. 안전 상한 10회. */
export async function advanceUntilOffers(page: Page): Promise<void> {
  for (let step = 0; step < 10; step += 1) {
    await page.waitForURL(/\/career\/.+\/(path|tryout|event|offers)$/);
    if (new URL(page.url()).pathname.endsWith('/offers')) return;
    await resolveCurrentEventScreen(page);
  }
  throw new Error('offers 화면에 도달하지 못했다(최대 10회 시도)');
}

/** SCR-009(제안 비교)에서 첫 제안을 골라 SCR-010(계약)에서 사인한다. 대시보드(SCR-029)로
 * 돌아온다(T-2-007: first-contract.spec.ts 원래 정의에서 뽑았다, season.spec.ts와 공유). */
export async function signFirstOffer(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { level: 1, name: '제안 비교' })).toBeVisible();
  await page.getByRole('link', { name: '이 제안 보기' }).first().click();

  await expect(page).toHaveURL(/\/career\/.+\/contract\?offerId=.+$/);
  await page.getByRole('button', { name: '사인' }).click();

  await expect(page).toHaveURL(/\/career\/[^/]+$/);
  await expect(page.getByText('계약을 맺었습니다')).toBeVisible();
}

/** 온보딩부터 첫 프로 계약 체결까지(대시보드 도착) 전 구간. first-contract.spec.ts·season.spec.ts가
 * 공유한다. */
export async function completeOnboardingThroughContract(page: Page): Promise<void> {
  await completeOnboardingAndConfirm(page);
  await advanceUntilOffers(page);
  await signFirstOffer(page);
}

/** SCR-029의 "프리시즌 계획" CTA에서 SCR-005 입력·SCR-011 확인까지: 모드·훈련 계획을 고르고
 * search 파라미터로 넘어가는지 확인한다. T-2-009: season.spec.ts에서 뽑아 season-result.spec.ts·
 * a11y.spec.ts와 공유한다. */
export async function planPreseason(page: Page, mode: 'FAST' | 'CHAPTER', modeLabel: string, focusLabel: string): Promise<void> {
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
export async function resolveRoleProposal(page: Page): Promise<void> {
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
 * 통과시킨다) — 그래서 시즌 전체 흐름 테스트도 챕터를 만날 수 있다. 세부 판단 내용은
 * chapter.spec.ts가 검증하므로, 여기서는 남은 판단을 모두 첫 선택지로 확정하고 결과 화면을 지나
 * "다음"으로 대시보드까지 최단 경로로 통과시킨다. 안전 상한 10회.
 *
 * 라디오·진행 버튼 중 뭐가 뜰지 매 스텝 다르므로, 그중 하나가 나타날 때까지 먼저 기다린 뒤에야
 * count()로 어느 쪽인지 가린다(기다리지 않고 바로 count()를 읽으면 로더 직후 첫 렌더 전 0을 읽는
 * 경합이 난다 — resolveRoleProposal과 같은 종류의 문제). */
export async function resolveCurrentChapterScreen(page: Page): Promise<void> {
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

/** SCR-029에서 "진행"을 반복해(CHAPTER는 위 resolveCurrentChapterScreen으로 직접 통과시킨다)
 * SETTLEMENT("결산하기")까지 도달한다. 안전 상한 20회.
 *
 * T-3-003 §9: 첫 계약 기간이 룰셋 min(1시즌)이면 step 7에서 재계약 사전 협상(CONTRACT, 제안 있음)이
 * 열려 더 이상 "진행"으로 자동 통과하지 않는다 — SCR-009(offers 화면)가 뜨면 signFirstOffer로
 * 첫 제안을 수락하고 계속한다(안전 잔류 제안이 항상 offers[0]이므로 재계약이든 결산 뒤 새 시장이든
 * 같은 헬퍼로 충분하다).
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
export async function advanceThroughSeasonToSettlement(page: Page): Promise<void> {
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
    if (pathnameBefore.endsWith('/offers')) {
      await signFirstOffer(page);
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
