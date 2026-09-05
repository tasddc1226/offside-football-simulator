// TEST-E2E-003(T-3-005): 실제 브라우저 UI로 career-10 계열 완전 이적과 career-11 계열 임대 복귀를
// 끝까지 재생한다. 커리어 상태는 DEV seed로 도달시키고, IndexedDB는 마지막 저장 검증에만 읽는다.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import {
  completeOnboardingAndConfirm,
  fillPreseasonPlan,
  planPreseason,
  resolveCurrentChapterScreen,
  resolveCurrentEventScreen,
  resolveRoleProposal,
  signFirstOffer,
} from './helpers/player-creation.js';

const CAREER_10_SEED = 't10-search-1';
// Domain prefilter with runtime loadRuleset(1.0.0) + UI verification: A+B, first contract 3 seasons,
// INTEREST LOAN, then LOAN_RETURN.
const CAREER_11_SEED = 't11-search-61';

async function expectNoSeriousOrCriticalViolations(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  const seriousOrCritical = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  );
  console.log(`[transfer-e2e][a11y] ${label}: serious/critical ${seriousOrCritical.length}건`);
  expect(seriousOrCritical).toEqual([]);
}

type SavedCareerAudit = {
  recordRevision: number;
  snapshotRevision: number;
  stateHash: string;
  openStints: number;
  baseOvr: number;
};

function expectSavedAuditUnchanged(before: SavedCareerAudit, after: SavedCareerAudit, label: string): void {
  expect(after.recordRevision, `${label}: record revision`).toBe(before.recordRevision);
  expect(after.snapshotRevision, `${label}: snapshot revision`).toBe(before.snapshotRevision);
  expect(after.stateHash, `${label}: state hash`).toBe(before.stateHash);
}

/** LocalCareerRecord와 최신 CareerSnapshot을 실제 IndexedDB에서 읽는 검증 전용 함수. 쓰기·상태
 * 주입은 하지 않는다. */
async function readSavedCareer(page: Page, careerId: string): Promise<SavedCareerAudit> {
  return page.evaluate(
    (cid) =>
      new Promise<SavedCareerAudit>((resolve, reject) => {
        const request = indexedDB.open('offside');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction(['careers', 'snapshots'], 'readonly');
          const careerRequest = tx.objectStore('careers').get(cid);
          const snapshotsRequest = tx.objectStore('snapshots').index('careerId').getAll(IDBKeyRange.only(cid));
          let career: { revision: number } | undefined;
          let snapshots: Array<{ revision: number; state: string; stateHash: string }> = [];
          careerRequest.onsuccess = () => {
            career = careerRequest.result as { revision: number } | undefined;
          };
          snapshotsRequest.onsuccess = () => {
            snapshots = snapshotsRequest.result as Array<{ revision: number; state: string; stateHash: string }>;
          };
          tx.oncomplete = () => {
            const latest = [...snapshots].sort((a, b) => a.revision - b.revision).at(-1);
            if (career === undefined || latest === undefined) {
              reject(new Error(`저장된 career/snapshot을 찾지 못했다: ${cid}`));
              return;
            }
            const state = JSON.parse(latest.state) as {
              player: { profile: { baseOvr: number } | null };
              clubHistory: Array<{ toSeasonIndex: number | null }>;
            };
            resolve({
              recordRevision: career.revision,
              snapshotRevision: latest.revision,
              stateHash: latest.stateHash,
              openStints: state.clubHistory.filter((stint) => stint.toSeasonIndex === null).length,
              baseOvr: state.player.profile?.baseOvr ?? 0,
            });
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    careerId,
  );
}

function careerIdFromUrl(page: Page): string {
  const careerId = new URL(page.url()).pathname.split('/')[2];
  if (careerId === undefined) throw new Error(`URL에서 careerId를 찾지 못했다: ${page.url()}`);
  return careerId;
}

/** EVT-CON-002=A, EVT-CON-003=B를 실제 이벤트 화면에서 고른 뒤 첫 계약 제안에 도달한다. 두
 * 선택을 고정해야 career-10/11 fixture와 같은 3개 시장 제안·임대 제안이 열린다. */
async function reachFirstContractOffers(page: Page): Promise<void> {
  await completeOnboardingAndConfirm(page);
  for (let step = 0; step < 10; step += 1) {
    await page.waitForURL(/\/career\/.+\/(path|tryout|event|offers)$/);
    if (new URL(page.url()).pathname.endsWith('/offers')) return;

    const pathChoice = page.getByRole('radio', { name: /프로 직행, 입단 테스트/ });
    const tryoutChoice = page.getByRole('radio', { name: /감독 지시대로 안정적으로/ });
    const anyChoice = page.getByRole('radio').first();
    await pathChoice.or(tryoutChoice).or(anyChoice).first().waitFor({ state: 'visible', timeout: 60_000 });
    if (await pathChoice.isVisible()) await pathChoice.click();
    else if (await tryoutChoice.isVisible()) await tryoutChoice.click();
    else await anyChoice.click();
    await page.getByRole('button', { name: '확정' }).click();
    await expect(page).toHaveURL(/\/event\/result\?rev=\d+$/);
    await page.getByRole('button', { name: '다음' }).click();
  }
  throw new Error('첫 계약 제안에 도달하지 못했다(최대 10회 시도)');
}

/** 첫 계약 뒤 시즌을 진행하되 step 7 PRE_NEGOTIATION은 전체 거절해 EXPIRED 시장으로 연다. */
async function advanceToSettlementRejectingRenewal(page: Page): Promise<void> {
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
      await expect(page.getByRole('heading', { level: 1, name: '이적시장 제안 비교' })).toBeVisible();
      await page.getByRole('button', { name: '제안 모두 거절하고 잔류' }).click();
      await expect(page).toHaveURL(/\/career\/[^/]+$/);
      continue;
    }
    if (await settleButton.isVisible()) return;
    const before = await stepCaption.textContent();
    await Promise.race([
      page.waitForURL((url) => url.pathname !== pathnameBefore, { timeout: 60_000 }),
      expect(progressButton).toBeEnabled({ timeout: 60_000 }),
      settleButton.waitFor({ state: 'visible', timeout: 60_000 }),
    ]);
    if (new URL(page.url()).pathname !== pathnameBefore) continue;
    if (await settleButton.isVisible()) return;
    await progressButton.click({ timeout: 15_000 }).catch(() => {});
    await Promise.race([
      page.waitForURL((url) => url.pathname !== pathnameBefore, { timeout: 60_000 }),
      expect(stepCaption).not.toHaveText(before ?? '', { timeout: 60_000 }),
    ]);
  }
  throw new Error('시즌 결산에 도달하지 못했다(최대 20회 시도)');
}

async function settleAndOpenOffers(page: Page): Promise<void> {
  await page.getByRole('button', { name: '결산하기' }).click();
  await expect(page).toHaveURL(/\/career\/.+\/season-result$/);
  await page.getByRole('link', { name: '대시보드' }).click();
  await expect(page).toHaveURL(/\/career\/[^/]+$/);
  await page.getByRole('link', { name: '제안 보기' }).click();
  await expect(page).toHaveURL(/\/career\/.+\/offers$/);
}

async function resultBaseOvr(page: Page): Promise<{ before: number; after: number }> {
  const result = page.getByTestId('transfer-result');
  return {
    before: Number(await result.getAttribute('data-base-ovr-before')),
    after: Number(await result.getAttribute('data-base-ovr-after')),
  };
}

test.use({ viewport: { width: 360, height: 780 }, contextOptions: { reducedMotion: 'reduce' } });

test('TEST-E2E-003(a): 3개 이상 제안 비교→협상→FREE_AGENT 확정→SCR-020→새 팀 프리시즌', async ({ page }) => {
  test.slow();
  await page.addInitScript((seed) => {
    window.localStorage.setItem('offside:e2e-seed', seed);
  }, CAREER_10_SEED);

  await reachFirstContractOffers(page);
  await expect(page.getByRole('heading', { level: 1, name: '제안 비교' })).toBeVisible();
  await signFirstOffer(page);
  await planPreseason(page, 'FAST', '빠른 시즌', '역할 집중');
  await page.getByRole('button', { name: '시즌 시작' }).click();
  await resolveRoleProposal(page);
  await expect(page).toHaveURL(/\/career\/[^/]+$/);
  await advanceToSettlementRejectingRenewal(page);
  await settleAndOpenOffers(page);

  await expect(page.getByRole('heading', { level: 1, name: '이적시장 제안 비교' })).toBeVisible();
  const marketCards = page.locator('[data-compare-layout="stacked"] > div');
  await expect(marketCards).toHaveCount(3);
  const careerId = careerIdFromUrl(page);
  const marketBeforeReload = await readSavedCareer(page, careerId);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: '이적시장 제안 비교' })).toBeVisible();
  const marketAfterReload = await readSavedCareer(page, careerId);
  expectSavedAuditUnchanged(marketBeforeReload, marketAfterReload, 'SCR-017 reload');
  await expectNoSeriousOrCriticalViolations(page, 'SCR-017 market comparison');

  const transferCard = marketCards.filter({ hasText: /완전 이적|자유계약/ }).first();
  await expect(transferCard).toBeVisible();
  const detailLink = transferCard.getByRole('link', { name: '제안 상세·결정' });
  await detailLink.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/career\/.+\/contract\?offerId=.+$/);
  await expectNoSeriousOrCriticalViolations(page, 'SCR-017 offer detail');

  const negotiateWage = page.getByRole('button', { name: '주급 협상' });
  await expect(negotiateWage).toBeEnabled();
  const revisionBeforeNegotiation = (await readSavedCareer(page, careerId)).recordRevision;
  await negotiateWage.dblclick({ delay: 0 });
  await expect(page.getByTestId('negotiation-result')).toBeVisible();
  const revisionAfterNegotiation = (await readSavedCareer(page, careerId)).recordRevision;
  expect(revisionAfterNegotiation).toBe(revisionBeforeNegotiation + 1);
  await expect(page.getByTestId('negotiation-result-live')).toContainText('조정되어');

  const accept = page.getByRole('button', { name: '이 조건 수락' });
  await expect(accept).toBeEnabled();
  const beforeAccept = await readSavedCareer(page, careerId);
  await accept.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/career\/.+\/transfer-result\?rev=\d+$/);
  const afterAccept = await readSavedCareer(page, careerId);
  expect(afterAccept.recordRevision).toBe(beforeAccept.recordRevision + 1);
  expect(afterAccept.snapshotRevision).toBe(afterAccept.recordRevision);
  expect(afterAccept.baseOvr).toBe(beforeAccept.baseOvr);
  await expectNoSeriousOrCriticalViolations(page, 'SCR-020 transfer result');
  await expect(page.getByText('전술 적합도', { exact: true })).toBeVisible();
  await expect(page.getByText('경쟁 상태', { exact: true })).toBeVisible();
  await expect(page.getByText('결과 사유', { exact: true })).toBeVisible();
  const ovr = await resultBaseOvr(page);
  expect(ovr.before).toBe(ovr.after);
  expect(ovr.before).toBe(beforeAccept.baseOvr);
  expect(ovr.after).toBe(afterAccept.baseOvr);
  await page.getByRole('link', { name: '새 시즌 준비' }).click();
  await expect(page).toHaveURL(/\/career\/.+\/preseason$/);
  const saved = await readSavedCareer(page, careerId);
  expectSavedAuditUnchanged(afterAccept, saved, 'transfer result to preseason');
  expect(saved.recordRevision).toBe(saved.snapshotRevision);
  expect(saved.stateHash).toMatch(/^[0-9a-f]{64}$/);
  expect(saved.openStints).toBe(1);
  expect(saved.baseOvr).toBe(ovr.before);
});

test('TEST-E2E-003(b): LOAN 수락→임대 시즌→LOAN_RETURN→RETURN→SCR-020', async ({ page }) => {
  test.slow();
  await page.addInitScript((seed) => {
    window.localStorage.setItem('offside:e2e-seed', seed);
  }, CAREER_11_SEED);

  await reachFirstContractOffers(page);
  await signFirstOffer(page, { preferredMinLengthSeasons: 3 });
  const loanCareerId = careerIdFromUrl(page);
  await planPreseason(page, 'FAST', '빠른 시즌', '역할 집중');
  await page.getByRole('button', { name: '시즌 시작' }).click();
  await resolveRoleProposal(page);
  await advanceToSettlementRejectingRenewal(page);
  await settleAndOpenOffers(page);

  await expect(page.getByRole('heading', { level: 1, name: '이적시장 제안 비교' })).toBeVisible();
  const marketCards = page.locator('[data-compare-layout="stacked"] > div');
  // Runtime loadRuleset(1.0.0) produces renewal + loan + transfer for this A+B replay.
  await expect(marketCards).toHaveCount(3);
  await expectNoSeriousOrCriticalViolations(page, 'SCR-017 loan comparison');
  // CompareCards renders kind label/value across adjacent dt/dd nodes; target the semantic card heading.
  const loanCard = marketCards
    .filter({ has: page.getByRole('heading', { level: 3, name: /· 임대$/ }) })
    .first();
  await expect(loanCard).toBeVisible();
  const loanDetail = loanCard.getByRole('link', { name: '제안 상세·결정' });
  await loanDetail.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/career\/.+\/contract\?offerId=.+$/);
  await expect(page.getByText('임대 조건')).toBeVisible();
  await expectNoSeriousOrCriticalViolations(page, 'SCR-017 loan detail');

  const loanAccept = page.getByRole('button', { name: '이 조건 수락' });
  await expect(loanAccept).toBeEnabled();
  const careerId = loanCareerId;
  const beforeLoanAccept = await readSavedCareer(page, careerId);
  await loanAccept.dblclick({ delay: 0 });
  await expect(page).toHaveURL(/\/career\/.+\/transfer-result\?rev=\d+$/);
  const afterLoanAccept = await readSavedCareer(page, careerId);
  expect(afterLoanAccept.recordRevision).toBe(beforeLoanAccept.recordRevision + 1);
  expect(afterLoanAccept.snapshotRevision).toBe(afterLoanAccept.recordRevision);
  expect(afterLoanAccept.baseOvr).toBe(beforeLoanAccept.baseOvr);
  await expectNoSeriousOrCriticalViolations(page, 'SCR-020 loan result');
  const loanOvr = await resultBaseOvr(page);
  expect(loanOvr.before).toBe(loanOvr.after);
  expect(loanOvr.before).toBe(beforeLoanAccept.baseOvr);
  expect(loanOvr.after).toBe(afterLoanAccept.baseOvr);
  const loanResultBeforeReload = await readSavedCareer(page, careerId);
  const loanResultUrl = page.url();
  await page.reload();
  await expect(page).toHaveURL(loanResultUrl);
  await expect(page.getByTestId('transfer-result')).toBeVisible();
  const loanResultAfterReload = await readSavedCareer(page, careerId);
  expectSavedAuditUnchanged(loanResultBeforeReload, loanResultAfterReload, 'loan SCR-020 reload');
  await page.getByRole('link', { name: '새 시즌 준비' }).click();
  await expect(page).toHaveURL(/\/career\/.+\/preseason$/);

  await fillPreseasonPlan(page, 'FAST', '빠른 시즌', '역할 집중');
  await page.getByRole('button', { name: '시즌 시작' }).click();
  await resolveRoleProposal(page);
  await advanceToSettlementRejectingRenewal(page);
  await settleAndOpenLoanReturn(page);

  await expect(page).toHaveURL(/\/career\/.+\/transfer-result$/);
  await expect(page.getByRole('heading', { level: 1, name: '임대 복귀 결정' })).toBeVisible();
  await expectNoSeriousOrCriticalViolations(page, 'SCR-020 loan return decision');
  const permanent = page.getByRole('button', { name: '임대 구단에 남기' });
  // career-11의 저장된 결과는 매입 기준을 충족하지 않으므로 PERMANENT 선택지가 없어야 한다.
  await expect(permanent).toHaveCount(0);
  const returnButton = page.getByRole('button', { name: '원소속으로 복귀' });
  const beforeReturn = await readSavedCareer(page, careerId);
  await returnButton.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/career\/.+\/transfer-result\?rev=\d+$/);
  const afterReturn = await readSavedCareer(page, careerId);
  expect(afterReturn.recordRevision).toBe(beforeReturn.recordRevision + 1);
  expect(afterReturn.snapshotRevision).toBe(afterReturn.recordRevision);
  expect(afterReturn.baseOvr).toBe(beforeReturn.baseOvr);
  await expectNoSeriousOrCriticalViolations(page, 'SCR-020 return result');
  await expect(page.getByText('원소속 복귀', { exact: true })).toBeVisible();
  const returnOvr = await resultBaseOvr(page);
  expect(returnOvr.before).toBe(returnOvr.after);
  expect(returnOvr.before).toBe(beforeReturn.baseOvr);
  expect(returnOvr.after).toBe(afterReturn.baseOvr);
  await page.getByRole('link', { name: '새 시즌 준비' }).click();
  await expect(page).toHaveURL(/\/career\/.+\/preseason$/);
  const saved = await readSavedCareer(page, careerId);
  expectSavedAuditUnchanged(afterReturn, saved, 'return result to preseason');
  expect(saved.recordRevision).toBe(saved.snapshotRevision);
  expect(saved.stateHash).toMatch(/^[0-9a-f]{64}$/);
  expect(saved.openStints).toBe(1);
  expect(saved.baseOvr).toBe(returnOvr.before);
});

async function settleAndOpenLoanReturn(page: Page): Promise<void> {
  await page.getByRole('button', { name: '결산하기' }).click();
  await expect(page).toHaveURL(/\/career\/.+\/season-result$/);
  await page.getByRole('link', { name: '대시보드' }).click();
  await expect(page).toHaveURL(/\/career\/[^/]+$/);
  await page.getByRole('link', { name: '복귀 조건 보기' }).click();
}

// T-4-011: SCR-020 잔류(STAY) 결과 — INTEREST 시장에서 안전 잔류를 수락했을 때 loader가 대시보드로
// 튕겨내지 않고(T-4-010 원인 2) STAY 결과 카드에 머무는지 고정 seed로 회귀를 잡는다. `offside:e2e-seed`
// 후보 20개 이내에서 실제 런타임 룰셋(1.0.0)으로 탐색해 첫 시즌 결산 직후 INTEREST 시장(안전 잔류
// 제안)을 여는 시드를 찾았다 — t4011-interest-1(EXPIRED), -2(간헐적 타임아웃), -3(EXPIRED),
// -4(INTEREST, 채택).
const CAREER_STAY_SEED = 't4011-interest-4';

test('TEST-E2E-003(c): INTEREST 시장 안전 잔류(STAY) 수락 → SCR-020 잔류 결과 카드, loader redirect 없이', async ({ page }) => {
  test.slow();
  await page.addInitScript((seed) => {
    window.localStorage.setItem('offside:e2e-seed', seed);
  }, CAREER_STAY_SEED);

  await reachFirstContractOffers(page);
  await expect(page.getByRole('heading', { level: 1, name: '제안 비교' })).toBeVisible();
  await signFirstOffer(page);
  const careerId = careerIdFromUrl(page);
  await planPreseason(page, 'FAST', '빠른 시즌', '역할 집중');
  await page.getByRole('button', { name: '시즌 시작' }).click();
  await resolveRoleProposal(page);
  await expect(page).toHaveURL(/\/career\/[^/]+$/);
  await advanceToSettlementRejectingRenewal(page);
  await settleAndOpenOffers(page);

  // 이 seed는 시즌 1 결산 직후 INTEREST 시장(안전 잔류 제안, pending.offers[0])을 연다.
  await expect(page.getByRole('heading', { level: 1, name: '이적시장 제안 비교' })).toBeVisible();
  const marketCards = page.locator('[data-compare-layout="stacked"] > div');
  const safeCard = marketCards.first();
  await expect(safeCard).toBeVisible();
  const beforeStay = await readSavedCareer(page, careerId);
  await safeCard.getByRole('link', { name: '제안 상세·결정' }).click();
  await expect(page).toHaveURL(/\/career\/.+\/contract\?offerId=.+$/);
  const stayAccept = page.getByRole('button', { name: '이 조건 수락' });
  await expect(stayAccept).toBeEnabled();
  await stayAccept.click();

  // T-4-010 원인 2: 고치기 전에는 buildStayState(OFFER_REJECTED ALL만 남김) 뒤 transfer-result의
  // loader가 전환 엔트리를 찾지 못해 대시보드로 튕겨냈다. 이 assertion이 그 회귀를 고정한다.
  // "관심을 보인 구단 N곳"을 위해 goToResult가 interested 검색 파라미터를 함께 붙이므로 $ 앵커 없이 확인한다.
  await expect(page).toHaveURL(/\/career\/.+\/transfer-result\?rev=\d+/);
  const stayResult = page.getByTestId('transfer-result');
  await expect(stayResult).toBeVisible();
  await expect(stayResult).toHaveAttribute('data-result-kind', 'STAY');
  await expect(page.getByText('잔류', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/남은 계약 \d+시즌/)).toBeVisible();
  await expect(page.getByText(/시장 사유: 타 구단 관심/)).toBeVisible();
  await expect(page.getByText('관계·평판 변화는 없습니다.')).toBeVisible();
  await expectNoSeriousOrCriticalViolations(page, 'SCR-020 STAY result');

  const afterStay = await readSavedCareer(page, careerId);
  expect(afterStay.recordRevision).toBe(beforeStay.recordRevision + 1);
  expect(afterStay.snapshotRevision).toBe(afterStay.recordRevision);
  expect(afterStay.baseOvr).toBe(beforeStay.baseOvr);
  const stayOvr = await resultBaseOvr(page);
  expect(stayOvr.before).toBe(stayOvr.after);
  expect(stayOvr.before).toBe(beforeStay.baseOvr);

  await page.getByRole('link', { name: /^(대시보드로|새 시즌 준비)$/ }).click();
  await expect(page).toHaveURL(/\/career\/[^/]+(?:\/preseason)?$/);
  const saved = await readSavedCareer(page, careerId);
  expectSavedAuditUnchanged(afterStay, saved, 'STAY result to next screen');
});
