// 공유 생성 여정: 짧은 프로필 입력 → 후보 3장 공개 → 선수 카드 확정 → 첫 결정.
import { expect, type Page, type Route } from '@playwright/test';
import type { CareerState } from '@offside/domain';

export const META = { requestId: 'e2e-req' };

/** Version-sensitive mechanics tests pin the service response, not just the engine debug default. */
export async function pinServiceSeasonPair(
  page: Page,
  rulesetVersion: string,
  contentPackVersion: string,
): Promise<void> {
  await page.route('**/v1/service-seasons/current', (route) =>
    fulfillJson(route, 200, {
      data: {
        id: 'svc_kickoff',
        name: 'Kickoff',
        status: 'ACTIVE',
        isTest: false,
        startsAt: '2026-09-01T00:00:00Z',
        endsAt: '2026-12-31T23:59:59Z',
        rulesetVersion,
        contentPackVersion,
        notice: null,
      },
      meta: META,
    }),
  );
}

/** Read-only persistence evidence; never constructs or edits a simulated state. */
export async function readCurrentCareerState(page: Page): Promise<CareerState> {
  const careerId = /\/career\/([^/]+)/.exec(page.url())?.[1];
  if (!careerId) throw new Error('Expected career URL');
  return page.evaluate(
    (cid) =>
      new Promise<CareerState>((resolve, reject) => {
        const req = indexedDB.open('offside');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('snapshots', 'readonly');
          const get = tx.objectStore('snapshots').index('careerId').getAll(cid);
          get.onerror = () => reject(get.error);
          get.onsuccess = () => {
            const records = get.result as Array<{ revision: number; state: string }>;
            records.sort((a, b) => a.revision - b.revision);
            const last = records.at(-1);
            db.close();
            if (!last) reject(new Error('Missing snapshot'));
            else resolve(JSON.parse(last.state) as CareerState);
          };
        };
      }),
    careerId,
  );
}

export async function fulfillJson(route: Route, status: number, body: unknown): Promise<void> {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

/** 생성 폼을 연다. 실제 커리어는 폼 제출 때 만들어진다. */
export async function startNewCareer(page: Page): Promise<void> {
  await page.goto('/onboarding');
  await expect(page.getByRole('heading', { name: '선수 생성' })).toBeVisible();
}

/** SCR-002의 6개 필드(성별·선호 포지션 포함, PR #32/T-1-016)를 채운다. */
export async function fillPlayerInfo(
  page: Page,
  name = '김서준',
  backgroundName: RegExp = /아카데미의 추가 평가/,
): Promise<void> {
  const options = await page
    .getByLabel('출발 배경')
    .locator('option')
    .evaluateAll((nodes) =>
      nodes.map((node) => ({
        label: node.textContent ?? '',
        value: (node as HTMLOptionElement).value,
      })),
    );
  const background = options.find((option) => backgroundName.test(option.label));
  if (!background) throw new Error(`Unknown background: ${backgroundName}`);
  await page.getByLabel('출발 배경').selectOption(background.value);
  await page.getByLabel('이름', { exact: true }).fill(name);
  await page.locator('summary').filter({ hasText: '상세 프로필' }).click();
  await page.getByLabel('성별', { exact: true }).selectOption('MALE');
  await page.getByLabel('국적').selectOption('KR');
  await page.getByRole('radio', { name: '왼발' }).click();
  await page.getByRole('radio', { name: /윙어/ }).click();
}

/**
 * SCR-002 입력 → SCR-003 스타일 선택 → SCR-004 확인 화면 도착까지. `backgroundName`은
 * fillPlayerInfo로 그대로 넘긴다(생략하면 기본값인 club-academy/"아카데미의 추가 평가").
 */
export async function goToConfirm(page: Page, backgroundName?: RegExp): Promise<void> {
  await startNewCareer(page);
  await fillPlayerInfo(page, undefined, backgroundName ?? /아카데미의 추가 평가/);
  await page.getByRole('button', { name: /다음 · 후보 카드 열기/ }).click();
  await expect(page).toHaveURL(/\/career\/.+\/style$/);

  await page.getByRole('button', { name: '3장 모두 열기' }).click();
  await page.getByRole('button', { name: '인사이드 포워드 후보 선택' }).click();
  await page.getByRole('button', { name: /이 후보로 진행/ }).click();
  await expect(page).toHaveURL(/\/career\/.+\/confirm$/);
  await expect(page.getByRole('heading', { level: 1, name: '이번 생의 주인공' })).toBeVisible();
}

/**
 * 프로필 입력 → 후보 선택 → 선수 카드 확정 → 복구 코드 화면 없이
 * SCR-007/008/013 계열 도착까지. 프로필 실패 스텁은 첫 계약 뒤 복구 안내에서 결정론적으로 쓴다.
 * `backgroundName`은 goToConfirm으로 그대로 넘긴다(생략하면 기본값 club-academy — 그 경로는
 * "남아 추가 평가"만으로 끝나 1.7.2/0.6.6에서도 SCR-008(입단 테스트)로 가지 않는다. SCR-008을
 * 보려면 school/street 배경을 넘겨야 한다).
 */
export async function completeOnboardingAndConfirm(
  page: Page,
  backgroundName?: RegExp,
): Promise<void> {
  await goToConfirm(page, backgroundName);

  await page.route('**/v1/profile', (route) =>
    fulfillJson(route, 503, {
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: '서비스를 이용할 수 없습니다.',
        retryable: true,
      },
      meta: META,
    }),
  );
  await page.getByRole('button', { name: /이 선수로 시작/ }).click();

  await expect(page).toHaveURL(/\/career\/.+\/(path|tryout|event)$/);
}

/** 지금 뜬 이벤트 화면(SCR-007·008·013 공통 본문)에서 첫 선택지를 확정하고, SCR-014 결과 카드를
 * 거쳐 "다음"으로 넘어간다. INJURY와 관계 이벤트도 같은 본문이라 별도 분기 없이 처리한다. */
export async function resolveCurrentEventScreen(
  page: Page,
  options: { onScreen?: (title: string) => void } = {},
): Promise<void> {
  const firstChoice = page.getByRole('radio').first();
  await firstChoice.waitFor({ state: 'visible' });
  if (options.onScreen) {
    // 사건 선택 시트가 열리면 배경 h1은 접근성 트리에서 숨겨진다.
    const title = page
      .getByRole('dialog')
      .getByRole('heading')
      .first()
      .or(page.getByRole('heading', { level: 1 }))
      .first();
    options.onScreen((await title.innerText()).trim());
  }
  await firstChoice.click();
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

/**
 * 이슈 159: SCR-009 첫 계약 표제는 제안 건수로 갈린다 — 1건 "받은 제안", 2건 이상 "제안 비교".
 * 첫 계약 제안 수는 seed·보유 태그(offerRules.countBonusTags → clamp(1+보너스, 1, maxOffers))에
 * 따라 달라지므로 화면의 카드 수를 세어 그 건수에 맞는 정확한 표제를 단언한다(정규식 완화 아님).
 */
export async function expectFirstContractHeading(page: Page): Promise<void> {
  await page
    .getByRole('heading', { level: 1, name: /^(제안 비교|받은 제안)$/ })
    .waitFor({ state: 'visible' });
  const offerCount = await page.locator('.os-offer-grid > article').count();
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: offerCount > 1 ? '제안 비교' : '받은 제안',
      exact: true,
    }),
  ).toBeVisible();
}

/**
 * SCR-009 첫 계약이면 `제안 비교`·`제안 상세·결정`·`사인` 퍼널을 타고, Phase 3
 * 시장 제안이면 `이적시장 제안 비교`·`제안 상세·결정`·`이 조건 수락`·SCR-020을 탄다. 두
 * 화면을 heading/link로 먼저 구분해야 PRE_NEGOTIATION의 새 UI가 기존 시즌 진행 헬퍼에서
 * FIRST_CONTRACT로 오인되지 않는다.
 */
export async function signFirstOffer(
  page: Page,
  options: { preferredMinLengthSeasons?: number; stopAtRecovery?: boolean } = {},
): Promise<void> {
  // 이슈 #159: 제안 1건이면 "받은 제안"·"이적시장 제안", 2건 이상이면 "제안 비교"·"이적시장 제안 비교".
  // 이 헬퍼는 두 화면을 가르는 분기 탐지기라 건수와 무관하게 두 표제 모두 받는다.
  const firstContractHeading = page.getByRole('heading', {
    level: 1,
    name: /^(제안 비교|받은 제안)$/,
  });
  const marketHeading = page.getByRole('heading', { level: 1, name: /^이적시장 제안( 비교)?$/ });
  await firstContractHeading
    .or(marketHeading)
    .first()
    .waitFor({ state: 'visible', timeout: 60_000 });
  if (await firstContractHeading.isVisible()) {
    const offerLinks = page.getByRole('link', { name: '제안 상세·결정' });
    const offerCards = page.locator('[data-compare-layout="stacked"] > div');
    let targetOffer = offerLinks.first();
    if ((await offerCards.count()) > 1 && options.preferredMinLengthSeasons !== undefined) {
      // 기존 helper의 기본값은 첫 제안 수락으로 보존한다. 특정 E2E만 원하는 계약 기간을 명시한다.
      const preferredLength = options.preferredMinLengthSeasons;
      const preferredCard = offerCards
        .filter({ hasText: new RegExp(`[${preferredLength}-9]시즌`) })
        .first();
      await expect(preferredCard).toHaveCount(1);
      targetOffer = preferredCard.getByRole('link', { name: '제안 상세·결정' });
    }
    await targetOffer.click();

    await expect(page).toHaveURL(/\/career\/.+\/contract\?offerId=.+$/);
    await enterTypedSignature(page);
    await page.getByRole('button', { name: '서명하고 계약 확정' }).click();

    await expect(page.getByRole('heading', { level: 1, name: '프로의 첫 유니폼' })).toBeVisible();
    await page.getByRole('button', { name: '커리어 시작' }).click();

    const recoveryHeading = page.getByRole('heading', {
      level: 1,
      name: '복구 코드를 저장하세요',
    });
    const signedToast = page.getByText('계약을 맺었습니다');
    await recoveryHeading.or(signedToast).first().waitFor({ state: 'visible' });
    if (await recoveryHeading.isVisible()) {
      if (options.stopAtRecovery === true) return;
      // 이미 복구 코드를 발급한 실제 프로필은 조회가 끝나면 이 화면을 자동 통과한다.
      // 제목의 첫 렌더만 보고 버튼을 기다리면 이미 도착한 대시보드에서 멈춘다.
      const dashboardUrl = /\/career\/[^/]+$/;
      const continueButton = page.getByRole('button', { name: /^(저장했어요|계속)$/ });
      await Promise.race([
        page.waitForURL(dashboardUrl),
        continueButton.waitFor({ state: 'visible' }),
      ]);
      if (!dashboardUrl.test(page.url())) {
        await continueButton.click({ timeout: 5_000 }).catch((error: unknown) => {
          if (!dashboardUrl.test(page.url())) throw error;
        });
      }
    }

    await expect(page).toHaveURL(/\/career\/[^/]+$/);
    await expect(page.getByText('계약을 맺었습니다')).toBeVisible();
    return;
  }

  await expect(marketHeading).toBeVisible();
  await page.getByRole('link', { name: '제안 상세·결정' }).first().click();
  await expect(page).toHaveURL(/\/career\/.+\/contract\?offerId=.+$/);
  const signedAccept = page.getByRole('button', { name: '서명하고 계약 확정' });
  const stayConfirm = page.getByRole('button', { name: '현재 팀 잔류 확정' });
  // isVisible()은 스냅샷 한 번뿐이라 URL이 바뀐 직후(라우트 전환 렌더가 아직 안 끝난 시점)에
  // 부르면 두 버튼 다 아직 안 붙어 있어 signedAccept가 false로 읽히고 잘못 stayConfirm 분기로
  // 빠질 수 있다(offers[0]이 서명이 필요한 재계약 제안일 때 재현됨 — stayConfirm은 이 화면에
  // 끝내 없어 90s 타임아웃). 둘 중 하나가 실제로 뜨는 것부터 기다린 뒤 분기한다.
  await signedAccept.or(stayConfirm).first().waitFor({ state: 'visible' });
  if (await signedAccept.isVisible()) {
    await enterTypedSignature(page);
    await signedAccept.click();
  } else {
    await stayConfirm.click();
  }
  // 안전 잔류 제안(항상 offers[0])을 수락하면 /transfer-result?rev=N(&interested=K)의 STAY 결과
  // 카드에 도착한다(T-4-011). 그 외 제안도 같은 화면에 도착한다 — "대시보드로"/"새 시즌 준비"
  // 링크를 눌러야 대시보드에 닿는다. rev 뒤에 다른 시장이 붙인 &interested=K가 있을 수 있으므로
  // 쿼리 유무와 무관하게 매칭한다.
  const transferResultOrDashboard =
    /(?:\/career\/.+\/transfer-result\?rev=\d+(?:&[^#]*)?|\/career\/[^/]+)$/;
  await expect(page).toHaveURL(transferResultOrDashboard);
  if (/\/transfer-result\?rev=\d+(?:&[^#]*)?$/.test(page.url())) {
    await page.getByRole('link', { name: /^(대시보드로|새 시즌 준비)$/ }).click();
  }
  await expect(page).toHaveURL(/\/career\/[^/]+(?:\/preseason)?$/);
}

export async function enterTypedSignature(page: Page, name = '김서준'): Promise<void> {
  await page.getByRole('button', { name: '이름 입력' }).click();
  await page.getByRole('textbox', { name: '서명할 이름' }).fill(name);
  await page.getByRole('button', { name: '서명 적용', exact: true }).click();
}

/** 온보딩부터 첫 프로 계약 체결까지(대시보드 도착) 전 구간. first-contract.spec.ts·season.spec.ts가
 * 공유한다. */
export async function completeOnboardingThroughContract(page: Page): Promise<void> {
  await completeOnboardingAndConfirm(page);
  await advanceUntilOffers(page);
  await signFirstOffer(page);
}

/** SCR-029의 "프리시즌 계획" CTA에서 SCR-005 입력·SCR-011 확인까지: 훈련 계획을 고르고 search
 * 파라미터로 넘어가는지 확인한다. 사용자 결정(2026-09-13, D-77)으로 시뮬레이션 모드 선택 단계는
 * 없다 — 모든 시즌은 항상 FAST로 시작한다. T-2-009: season.spec.ts에서 뽑아 season-result.spec.ts·
 * a11y.spec.ts와 공유한다. */
export async function planPreseason(page: Page, focusLabel: string): Promise<void> {
  await page.getByRole('link', { name: '계획하러 가기' }).click();
  await expect(page).toHaveURL(/\/career\/.+\/preseason$/);
  await fillPreseasonPlan(page, focusLabel);
}

/** 이미 SCR-005 프리시즌 화면에 있는 경우의 입력 경로. 결과 화면 CTA가 프리시즌으로 이동한
 * 뒤에는 `계획하러 가기`가 없으므로 planPreseason과 분리해 같은 저장·진행 검증을 재사용한다. */
export async function fillPreseasonPlan(page: Page, focusLabel: string): Promise<void> {
  const lifeHeading = page.getByRole('heading', {
    level: 1,
    name: '이번 시즌, 어떤 선수가 될까?',
    exact: true,
  });
  const legacyHeading = page.getByRole('heading', { level: 1, name: '프리시즌 계획', exact: true });
  await expect(lifeHeading.or(legacyHeading)).toBeVisible();
  if (await lifeHeading.isVisible()) {
    const state = await readCurrentCareerState(page);
    expect(['3.0.0', '3.1.0', '3.2.0']).toContain(state.rulesetVersion);
    await expect(
      page.getByRole('button', { name: '새 시즌 훈련장으로', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('시즌을 세 구간으로 나눠 훈련과 함께할 사람을 고릅니다.', { exact: false }),
    ).toBeVisible();
    return;
  }
  await expect(page.getByRole('heading', { level: 1, name: '프리시즌 계획' })).toBeVisible();

  // 사용자 결정(2026-09-13, D-77): 시뮬레이션 모드 라디오는 더 이상 없다.
  await expect(page.getByText('시뮬레이션 모드', { exact: true })).not.toBeVisible();
  await page.getByRole('radio', { name: new RegExp(`^${focusLabel}`) }).click();
  await page.getByRole('link', { name: '다음' }).click();

  await expect(page).toHaveURL(/\/career\/.+\/season-prep\b/);
  const url = new URL(page.url());
  expect(url.searchParams.has('mode')).toBe(false);
  await expect(page.getByRole('heading', { level: 1, name: '시즌 준비' })).toBeVisible();
  // SCR-011 인수 조건: 훈련 계획은 시즌 결산 때 능력에 반영된다.
  await expect(page.getByText('훈련 계획은 시즌 결산 때 능력에 반영됩니다.')).toBeVisible();
}

export async function startPlannedSeason(page: Page): Promise<void> {
  if (new URL(page.url()).pathname.endsWith('/preseason')) {
    await page.getByRole('button', { name: '새 시즌 훈련장으로', exact: true }).click();
  } else {
    await expect(page).toHaveURL(/\/season-prep\b/);
    await page.getByRole('button', { name: '시즌 시작', exact: true }).click();
  }
}

/** SCR-015의 "다음 시즌" CTA는 항상 SCR-005(프리시즌 계획)로 가지는 않는다 — 링크가 가리키는
 * 대상은 결산 직후 상태의 `nextTarget`(season-result.tsx)이라, 계약 만료·관심 등으로 대기 중인
 * 시장(OFFERS)이 있으면 그 화면(SCR-009 계열)으로 먼저 보낸다. seed·룰셋 버전이 바뀌어 이 분기가
 * 달라져도 테스트가 깨지지 않도록, offers 화면이면 안전 잔류(offers[0], signFirstOffer)를 수락해
 * 프리시즌으로 이어가고, 이미 프리시즌이면 그대로 둔다(season.spec.ts의 동일 처리를 공용화했다). */
export async function continueToPreseason(page: Page): Promise<void> {
  if (/\/offers$/.test(page.url())) {
    await signFirstOffer(page);
  }
  await expect(page).toHaveURL(/\/preseason$/);
}

/** SCR-012의 POSITION_CHANGE·ROLE_CHANGE를 승낙한다. 현재 역할과 완전히 같은 KEEP은 시즌 준비
 * 화면이 원자적으로 수락하고 대시보드로 바로 이동하므로, 그 경로에서는 할 일이 없다. KEEP 자동
 * 수락의 두 번째 명령이 실패한 경우에는 복구용 /role이 남아 이 함수가 "확인"으로 마무리한다. */
export async function resolveRoleProposal(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/career\/[^/]+(?:\/role)?$/);
  if (!page.url().endsWith('/role')) return;
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
 * 라디오·진행 버튼 중 뭐가 뜰지 매 스텝 다르므로, 각 후보를 현재 visible+enabled 상태로 좁힌
 * union의 첫 locator 자체를 클릭한다. count()는 hidden·disabled 요소도 세므로 actionability 판정에
 * 쓰지 않는다 — 특히 hidden "다음"이 visible한 진행 CTA보다 먼저 선택되면 안 된다. */
export async function resolveCurrentChapterScreen(page: Page): Promise<void> {
  for (let step = 0; step < 10; step += 1) {
    const enabled = page.locator(':enabled:not([aria-disabled="true"])');
    const nextButton = page
      .getByRole('button', { name: '다음', exact: true })
      .filter({ visible: true })
      .and(enabled);
    const progressButton = page
      .getByRole('button', { name: /^(다음 판단|경기 결과)$/ })
      .filter({ visible: true })
      .and(enabled);
    const radio = page.getByRole('radio').filter({ visible: true }).and(enabled).first();
    const current = nextButton.or(progressButton).or(radio).first();
    await current.waitFor({ state: 'visible' });
    await expect(current).toBeEnabled();

    const role = await current.getAttribute('role');
    const accessibleName = (
      (await current.getAttribute('aria-label')) ?? (await current.innerText())
    ).trim();
    await current.click();

    if (role === 'radio') {
      await page.getByRole('button', { name: '확정', exact: true }).click();
      // 확정 뒤 결과(다음 판단·경기 결과 버튼)로 전환되길 기다린다 — 이 대기 없이 곧장 다음 루프로
      // 가면 라디오가 checked·disabled로 전환되는 프레임을 "아직 안 골랐다"로 오판해 같은 라디오를
      // 다시 클릭해 버린다(사라지기 직전 라디오를 잡는 detach 경합).
      await progressButton.or(nextButton).first().waitFor({ state: 'visible' });
      continue;
    }
    if (accessibleName === '다음') return;

    // 진행 CTA를 누른 뒤에는 다음 반복에서 visible+enabled인 현재 CTA를 다시 resolve한다.
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
export async function advanceThroughSeasonToSettlement(
  page: Page,
  options: { onEventScreen?: (title: string) => void } = {},
): Promise<void> {
  const progressButton = page.getByRole('button', { name: '진행', exact: true });
  const settleButton = page.getByRole('button', { name: '결산하기', exact: true });
  const currentStepCaption = page.getByRole('progressbar', { name: '시즌 진행', exact: true });
  for (let step = 0; step < 20; step += 1) {
    const pathnameBefore = new URL(page.url()).pathname;
    if (pathnameBefore.endsWith('/chapter')) {
      await resolveCurrentChapterScreen(page);
      continue;
    }
    if (/\/(event|path|tryout)$/.test(pathnameBefore)) {
      await resolveCurrentEventScreen(
        page,
        options.onEventScreen === undefined ? {} : { onScreen: options.onEventScreen },
      );
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
    const stepTextBefore = await currentStepCaption.getAttribute('aria-valuenow');
    // 클릭 액션 자체의 actionability 재확인 도중에도(디스패치 전) advance 성공→화면 전환이 끼어들어
    // 버튼이 사라질 수 있다 — 그 detach는 실패로 삼키고(클릭이 실제로 먹혔는지는 다음 스텝 진입 시
    // 위 pathname·step 텍스트 재검사가 가린다), 여기서 무한정(테스트 전체 타임아웃까지) 기다리지
    // 않는다.
    await progressButton.click({ timeout: 15_000 }).catch(() => {});
    await Promise.race([
      page.waitForURL((url) => url.pathname !== pathnameBefore, { timeout: 60_000 }),
      expect(currentStepCaption).not.toHaveAttribute('aria-valuenow', stepTextBefore ?? '', {
        timeout: 60_000,
      }),
    ]);
  }
  throw new Error('SETTLEMENT(결산하기)에 도달하지 못했다(최대 20회 시도)');
}
