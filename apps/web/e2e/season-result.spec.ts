// TEST-E2E-002 "프리시즌→핵심 경기→시즌 결산": SCR-015 프로 시즌 결과 화면 — 공통 지표 합, 평균
// 평점 미집계 구분, CompareCards 세그먼트 전환·차이만 보기, 카운트업 완료, 헤더 OVR과 결산
// after 일치, 다이어리 연대기·다음 시즌 이동. 두 번째 테스트는 결산 PUT 응답 유실 복구
// (resilience.spec.ts (c)와 같은 방식)로 같은 result.hash를 확인한다.
import { expect, test, type Page } from '@playwright/test';
import {
  advanceThroughSeasonToSettlement,
  completeOnboardingThroughContract,
  fillPreseasonPlan,
  fulfillJson,
  META,
  planPreseason,
  resolveRoleProposal,
} from './helpers/player-creation.js';

/** CompareCards assertions need a settlement without a random post-season market; this DEV-only seed was replayed
 * repeatedly and keeps the second-season setup on the intended deterministic path. */
const E2E_SEASON_RESULT_SEED = 'e2e-season-result-01';

/** "공통 지표" dl에서 라벨이 정확히 일치하는 dt의 형제 dd 텍스트를 정수로 읽는다(선발·교체 등
 * CountUp이 아닌 평범한 값). */
async function statValue(page: Page, label: string): Promise<number> {
  const text = await page.locator(`dt:text-is("${label}") + dd`).first().textContent();
  if (text === null) throw new Error(`통계 값을 찾지 못했다: ${label}`);
  return Number(text);
}

/** CountUp이 채운 dd 안의 `[data-value]`를 읽는다(애니메이션 중에도 확정값이 이미 들어있다). */
async function countUpValue(page: Page, dtLabel: string): Promise<number> {
  const value = await page.locator(`dt:text-is("${dtLabel}") + dd [data-value]`).first().getAttribute('data-value');
  if (value === null) throw new Error(`CountUp data-value를 찾지 못했다: ${dtLabel}`);
  return Number(value);
}

/** 계약 체결 뒤 프리시즌 계획→시즌 시작→역할 제안→진행 반복→결산하기로 SCR-015에 도착한다. */
async function settleOneSeason(page: Page): Promise<void> {
  await planPreseason(page, '역할 집중');
  await page.getByRole('button', { name: '시즌 시작' }).click();
  await resolveRoleProposal(page);
  await advanceThroughSeasonToSettlement(page);
  // 결산 전 일정의 실제 분 수를 독립 기준으로 삼는다. 저장 집계의 잘못된 total을
  // 기대값으로 재사용하면 같은 오류를 화면과 테스트가 함께 통과시킬 수 있다.
  // 일정표는 "일정" 탭 안에 있다(기본 탭은 "홈") — 먼저 탭을 열어야 span.os-num이 보인다.
  await page.getByRole('tab', { name: '일정' }).click();
  const scheduleTexts = await page.locator('span.os-num').allTextContents();
  await page.getByRole('tab', { name: '홈' }).click();
  const matches = scheduleTexts.flatMap((text) => {
    const match = /^\d+:\d+ · (.+) · (\d+)분 · /.exec(text);
    return match === null ? [] : [{ appearance: match[1], minutes: Number(match[2]) }];
  });
  expect(matches.length).toBeGreaterThan(0);
  await page.getByRole('button', { name: '결산하기' }).click();
  await expect(page).toHaveURL(/\/career\/.+\/season-result$/);
  expect(await countUpValue(page, '출전')).toBe(matches.filter((match) => match.minutes > 0).length);
  expect(await statValue(page, '교체')).toBe(matches.filter((match) => match.appearance === '교체' && match.minutes > 0).length);
  expect(await statValue(page, '0분')).toBe(matches.filter((match) => match.minutes === 0).length);
}

test('SCR-015 프로 시즌 결과: 결산 요약·비교·카운트업을 보여주고 헤더 OVR과 일치한다', async ({ page }) => {
  await page.addInitScript((seed) => {
    window.localStorage.setItem('offside:e2e-seed', seed);
  }, E2E_SEASON_RESULT_SEED);
  await completeOnboardingThroughContract(page);
  await settleOneSeason(page);

  const root = page.getByTestId('season-result');
  await expect(root).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: '프로 시즌 결과' })).toBeVisible();

  // T-7-005(#175): 공통 지표·비교 섹션이 전부 <details class="os-season-breakdown">(요약 "시즌
  // 상세 기록 보기") 안으로 옮겨갔다 — 접힌 채로도 textContent는 읽히지만(아래 statValue 등)
  // toBeVisible()은 실제로 펼쳐야 통과한다. 설정 화면의 "위험 작업 보기"와 같은 패턴으로 연다.
  await page.getByText('시즌 상세 기록 보기').click();

  // 800ms 뒤 사라지는 버튼은 count()와 click() 사이에도 없어질 수 있다. 특히 화면 전환 중
  // Playwright의 안정성 대기가 겹치므로 E2E는 자연 완료를 검증한다. 건너뛰기 클릭의 즉시 확정·
  // 버튼 제거·콜백은 shared/countup.test.tsx에서 별도로 검증한다. 애니메이션은 끄지 않는다.
  const minutesDd = page.locator('dt:text-is("출전 시간(분)") + dd');
  const minutesValueEl = minutesDd.locator('[data-value]');
  const minutesDataValue = await minutesValueEl.getAttribute('data-value');
  expect(minutesDataValue).not.toBeNull();
  await expect(minutesValueEl).toHaveAttribute('data-animating', 'false');
  await expect(minutesValueEl).toHaveText(minutesDataValue ?? '');
  await expect(minutesDd.getByRole('button', { name: '건너뛰기' })).toHaveCount(0);

  // #60: 실제 출전 = 선발 + 실제 교체. 결장·미사용 교체(0분)는 출전에서 제외한다.
  const [started, sub, zeroMinute, out, total] = await Promise.all([
    statValue(page, '선발'),
    statValue(page, '교체'),
    statValue(page, '0분'),
    statValue(page, '결장'),
    countUpValue(page, '출전'),
  ]);
  expect(started + sub).toBe(total);
  expect(out).toBeLessThanOrEqual(zeroMinute);

  // 평균 평점: 미집계(ratedMatches 0)면 "—", 아니면 소수 1자리. CountUp이 애니메이션 중이면
  // "건너뛰기" 버튼이 dd 안에 같이 있어 dd 전체 textContent에는 버튼 라벨까지 섞인다 — 값
  // 자체를 담은 `.os-num` 스팬만 읽는다.
  const avgRatingDd = page.locator('dt:text-is("평균 평점") + dd');
  const avgRatingText = (await avgRatingDd.locator('.os-num').first().textContent())?.trim() ?? '';
  expect(avgRatingText === '—' || /^\d+\.\d$/.test(avgRatingText)).toBe(true);

  // "결산 후 Base OVR"의 확정값을 나중에 대시보드 StatusStrip과 비교한다(dt 라벨이 없는 인라인
  // 문구라 접근성 이름으로 직접 읽는다).
  const afterOvrValue = await page.getByLabel(/^결산 후 Base OVR /).getAttribute('data-value');
  if (afterOvrValue === null) throw new Error('결산 후 Base OVR data-value를 찾지 못했다');

  // 비교 구역: 첫 시즌은 지난 시즌 비교 대상이 없어 세그먼트(Tabs) 없이 "계약 약속" 행만 보인다.
  // CompareCards는 모바일 스택·데스크톱 그리드 두 레이아웃을 항상 함께 그려(CSS로만 전환) 같은
  // 라벨이 DOM엔 여러 번 나타난다 — .first()로 존재만 확인한다.
  const compareSection = page.getByTestId('season-compare');
  await expect(compareSection.getByText('역할').first()).toBeVisible();
  await expect(compareSection.getByRole('tab')).toHaveCount(0);

  // "차이만 보기"는 같은 값 행을 숨긴다 — 행 수가 늘지는 않는다(무작위 시즌 결과라 정확한 값은 못 고정한다).
  const rowCountBefore = await compareSection.locator('dt').count();
  await compareSection.getByRole('checkbox', { name: '차이만 보기' }).check();
  const rowCountAfterDiffOnly = await compareSection.locator('dt').count();
  expect(rowCountAfterDiffOnly).toBeLessThanOrEqual(rowCountBefore);
  await compareSection.getByRole('checkbox', { name: '차이만 보기' }).uncheck();
  await expect(compareSection.locator('dt')).toHaveCount(rowCountBefore);

  // "다음 시즌" → SCR-005(프리시즌 계획).
  await page.getByRole('link', { name: '다음 시즌' }).click();
  await expect(page).toHaveURL(/\/career\/.+\/preseason$/);
  await expect(page.getByRole('heading', { level: 1, name: '프리시즌 계획' })).toBeVisible();

  // 대시보드로 돌아가 헤더 OVR이 결산 after와 같은지 확인한다(홈 탭에는 StatusStrip OVR이 없다).
  await page.goto(page.url().replace(/\/preseason.*$/, ''));
  const headerOvrText = await page.locator('header').getByText(/^OVR \d+$/).textContent();
  expect(headerOvrText?.replace(/^OVR /, '').trim()).toBe(afterOvrValue);

  // 다이어리: 이번 시즌 연대기에 "시즌 정산" 항목이 SCR-015로 연결된다.
  await page.getByRole('tab', { name: '기록' }).click();
  const settledLink = page.getByRole('link', { name: /시즌 정산$/ });
  await expect(settledLink).toBeVisible();
  await settledLink.click();
  await expect(page).toHaveURL(/\/career\/.+\/season-result\?season=0$/);
  await expect(page.getByTestId('season-result')).toHaveAttribute('data-result-hash', /.+/);
});

test('두 번째 시즌: CompareCards가 "지난 시즌"·"계약 약속" 세그먼트를 전환한다', async ({ page }) => {
  await page.addInitScript((seed) => {
    window.localStorage.setItem('offside:e2e-seed', seed);
  }, E2E_SEASON_RESULT_SEED);
  await completeOnboardingThroughContract(page);
  await settleOneSeason(page);

  // "다음 시즌"을 누르면 이미 SCR-005(프리시즌 계획)에 도착해 있다 — planPreseason은 대시보드의
  // "계획하러 가기" CTA부터 시작하므로 여기서는 그 클릭만 건너뛰고 fillPreseasonPlan으로 나머지를
  // 그대로 따라간다.
  await page.getByRole('link', { name: '다음 시즌' }).click();
  await fillPreseasonPlan(page, '역할 집중');
  await page.getByRole('button', { name: '시즌 시작' }).click();
  await resolveRoleProposal(page);
  await advanceThroughSeasonToSettlement(page);
  await page.getByRole('button', { name: '결산하기' }).click();
  await expect(page).toHaveURL(/\/career\/.+\/season-result$/);

  // T-7-005(#175): 비교 섹션도 <details class="os-season-breakdown">(요약 "시즌 상세 기록 보기") 안이다.
  await page.getByText('시즌 상세 기록 보기').click();

  const compareSection = page.getByTestId('season-compare');
  await expect(compareSection.getByRole('tab', { name: '지난 시즌' })).toBeVisible();
  await expect(compareSection.getByRole('tab', { name: '계약 약속' })).toBeVisible();

  await compareSection.getByRole('tab', { name: '지난 시즌' }).click();
  await expect(compareSection.getByText('Base OVR').first()).toBeVisible();
  await expect(compareSection.getByText('출전 시간(분)').first()).toBeVisible();

  await compareSection.getByRole('tab', { name: '계약 약속' }).click();
  await expect(compareSection.getByText('역할').first()).toBeVisible();
});

test('결산 PUT 응답 유실: 재시도 뒤에도 같은 result.hash로 SCR-015를 보여주고, 새로고침해도 같은 hash다', async ({
  page,
}) => {
  // 기본 e2e 모드(E2E_WITH_API 없음)는 8787에 실제 서버가 없다(playwright.config.ts) — route로
  // 가로채지 않으면 이 커리어의 모든 PUT이 처음부터 실패해 재시도 backoff(attempt)가 결산 전부터
  // 계속 쌓인다. 그 상태에서 결산 PUT만 유실시키면 그 시점의 attempt가 이미 커서(직접 확인,
  // packages/engine-client/src/sync/client.ts scheduleRetry의 2^(attempt-1) 백오프) 재시도가
  // 60초 상한 근처까지 늦어져 테스트가 불안정해진다. resilience.spec.ts (c)처럼 맨 처음부터 모든
  // PUT을 가로채, 결산 이전 명령은 즉시 성공시켜 attempt를 0으로 유지하고(요청 본문의
  // snapshot.revision을 그대로 돌려준다), 결산(SETTLE_SEASON) 명령의 PUT만 첫 시도를 유실시킨다.
  let attempt = 0;
  const idempotencyKeys: string[] = [];
  await page.route('**/v1/careers/*', async (route) => {
    if (route.request().method() !== 'PUT') {
      await route.continue();
      return;
    }
    const body = route.request().postDataJSON() as { snapshot: { revision: number }; commands: { commandType: string }[] };
    const isSettle = body.commands.at(-1)?.commandType === 'SETTLE_SEASON';
    if (!isSettle) {
      await fulfillJson(route, 200, { data: { revision: body.snapshot.revision, syncedAt: '2026-09-03T00:00:00Z' }, meta: META });
      return;
    }
    attempt += 1;
    idempotencyKeys.push(route.request().headers()['idempotency-key'] ?? '');
    if (attempt === 1) {
      await route.abort('failed');
      return;
    }
    await fulfillJson(route, 200, { data: { revision: body.snapshot.revision, syncedAt: '2026-09-03T00:00:00Z' }, meta: META });
  });

  await completeOnboardingThroughContract(page);
  await planPreseason(page, '역할 집중');
  await page.getByRole('button', { name: '시즌 시작' }).click();
  await resolveRoleProposal(page);
  await advanceThroughSeasonToSettlement(page);

  // 이 시나리오는 클릭 직후 로컬 커밋과 유실된 PUT이 같은 틱에 몰린다(route 가로채기) — SPA
  // 전환이 버튼을 클릭 도중 DOM에서 떼어내 Playwright가 클릭 자체를 재시도하며 멈출 수 있다.
  // resilience.spec.ts (b)와 같은 이유로 클릭 액션의 실패는 무시하고 URL 전환으로만 성공을 본다.
  await page
    .getByRole('button', { name: '결산하기' })
    .click({ timeout: 5_000 })
    .catch(() => {});
  await expect(page).toHaveURL(/\/career\/.+\/season-result$/);

  const hash = await page.getByTestId('season-result').getAttribute('data-result-hash');
  expect(hash).toBeTruthy();

  await expect(page.getByText('저장 다시 시도 중')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('저장됨')).toBeVisible({ timeout: 10_000 });
  expect(attempt).toBeGreaterThanOrEqual(2);
  expect(idempotencyKeys[0]).not.toBe('');
  expect(idempotencyKeys[1]).toBe(idempotencyKeys[0]);

  await expect(page.getByTestId('season-result')).toHaveAttribute('data-result-hash', hash ?? '');

  // 새로고침해도 seasonHistory가 이미 늘어난 상태를 읽어 SCR-015가 바로 열리고 같은 hash를 보여준다.
  await page.reload();
  await expect(page).toHaveURL(/\/career\/.+\/season-result$/);
  await expect(page.getByTestId('season-result')).toHaveAttribute('data-result-hash', hash ?? '');
});
