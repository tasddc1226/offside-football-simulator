// T-4-002 브라우저 회귀: production career-12 seed에서 실제 forced INJURY pending을 generic
// event 화면으로 열고, 재활 선택 뒤 시즌 진행이 재개되는지 확인한다. seed는 부상을 억제하기 위한
// 우회가 아니라 packages/domain career-12 fixture와 같은 고정 발생 경로를 재현하기 위한 입력이다.
import { expect, test, type Page } from '@playwright/test';
import {
  advanceThroughSeasonToSettlement,
  completeOnboardingThroughContract,
  resolveCurrentChapterScreen,
  resolveCurrentEventScreen,
  resolveRoleProposal,
  signFirstOffer,
} from './helpers/player-creation.js';

const CAREER_12_FORCED_INJURY_SEED = 'career-12-fixed-search-59';

type StoredCareerSnapshot = {
  revision: number;
  rngState: { draws: number };
  state: {
    currentStep: number;
    pending: {
      kind: string;
      eventId?: string;
      version?: number;
      episodeId?: string;
      step?: number;
    } | null;
    health: { episodes: Array<{ id: string; status: string; occurredAt: { matchId: string }; severity: string }> };
    season: { matches: Array<{ id: string; step: number }> } | null;
  };
};

/** 기존 CHAPTER E2E와 같은 IndexedDB snapshots read-only 패턴으로 최신 domain state를 확인한다. */
async function readLatestCareerSnapshot(page: Page): Promise<StoredCareerSnapshot> {
  const match = /\/career\/([^/]+)/.exec(page.url());
  if (match === null) throw new Error(`readLatestCareerSnapshot: URL에서 careerId를 찾지 못했다(${page.url()})`);
  const careerId = match[1]!;

  return page.evaluate(
    (cid) =>
      new Promise<StoredCareerSnapshot>((resolve, reject) => {
        const openReq = indexedDB.open('offside');
        openReq.onerror = () => reject(openReq.error);
        openReq.onsuccess = () => {
          const db = openReq.result;
          const tx = db.transaction('snapshots', 'readonly');
          const index = tx.objectStore('snapshots').index('careerId');
          const records: Array<{ revision: number; rngState: { draws: number }; state: string }> = [];
          const cursorReq = index.openCursor(IDBKeyRange.only(cid));
          cursorReq.onerror = () => reject(cursorReq.error);
          cursorReq.onsuccess = () => {
            const cursor = cursorReq.result;
            if (cursor !== null) {
              records.push(cursor.value as (typeof records)[number]);
              cursor.continue();
              return;
            }
            if (records.length === 0) {
              reject(new Error(`readLatestCareerSnapshot: careerId ${cid}의 스냅샷이 없다.`));
              return;
            }
            records.sort((a, b) => a.revision - b.revision);
            const latest = records[records.length - 1]!;
            resolve({ revision: latest.revision, rngState: latest.rngState, state: JSON.parse(latest.state) as StoredCareerSnapshot['state'] });
          };
        };
      }),
    careerId,
  );
}

/** 대시보드에서 진행해 generic event 화면에 실제 forced INJURY pending이 열릴 때까지 찾는다. */
async function reachForcedInjury(page: Page): Promise<void> {
  const progressButton = page.getByRole('button', { name: '진행', exact: true });
  const stepCaption = page.getByText(/step \d+\/12/);

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const pathname = new URL(page.url()).pathname;
    if (pathname.endsWith('/chapter')) {
      await resolveCurrentChapterScreen(page);
      await expect(page).toHaveURL(/\/career\/[^/]+$/, { timeout: 60_000 });
      continue;
    }
    if (/\/(event|path|tryout)$/.test(pathname)) {
      if (pathname.endsWith('/event') && (await page.getByText(/경기 중 부상을 당했다/).count()) > 0) {
        await expect(page.getByText(/경기 중 부상을 당했다/)).toBeVisible();
        await expect(page.getByRole('radio', { name: '표준 재활' })).toBeVisible();
        await expect(page.getByRole('radio', { name: '조기 복귀' })).toBeVisible();
        await expect(page.getByRole('radio', { name: '보수 재활' })).toBeVisible();
        return;
      }
      await resolveCurrentEventScreen(page);
      await expect(page).toHaveURL(/\/career\/[^/]+$/, { timeout: 60_000 });
      continue;
    }
    if (pathname.endsWith('/offers')) {
      await signFirstOffer(page);
      continue;
    }

    const before = await stepCaption.textContent({ timeout: 15_000 }).catch(() => null);
    // RESOLVE_ROLE 직후 엔진이 이미 첫 ADVANCE를 처리 중일 수 있다. 그 결과가 챕터로
    // 전환되는 동안 대시보드 locator만 기다리면 정상 화면을 놓치고 60초를 소비하므로,
    // 경로 전환과 진행 버튼 활성화를 함께 기다린다.
    await Promise.race([
      page.waitForURL((url) => url.pathname !== pathname, { timeout: 60_000 }),
      expect(progressButton).toBeEnabled({ timeout: 60_000 }),
    ]);
    if (new URL(page.url()).pathname !== pathname) continue;
    // advance가 먼저 커밋되어 화면을 교체하는 틱과 Playwright click의 actionability 재확인이
    // 겹칠 수 있다. 클릭이 이미 디스패치된 뒤의 detach는 다음 상태 관찰로 판정한다.
    await progressButton.click({ timeout: 15_000 }).catch(() => {});
    await expect
      .poll(
        async () => {
          if (new URL(page.url()).pathname !== pathname) return true;
          return (await stepCaption.textContent({ timeout: 1_000 }).catch(() => null)) !== before;
        },
        { timeout: 60_000 },
      )
      .toBe(true);
  }

  throw new Error('production career-12 seed에서 forced INJURY pending을 찾지 못했다');
}

/**
 * raw career-12 fixture의 박은성·미지정 성별·오른발 GK 입력, A/B 선택, eligibleEvents와 revision 기반
 * OFR-9-0은 domain golden이 정확히 증명한다. 웹 adapter는 현재 팩의 eligible 후보를 계산하고 실제
 * 브라우저 revision으로 offer를 생성하므로, 공통 onboarding helper를 쓰는 이 E2E는 그 raw command
 * log를 재생한다고 과장하지 않고 고정 seed의 실제 forced pending과 generic 화면·재활 재개를 IndexedDB
 * snapshot으로 결합 검증한다.
 */
test('career-12 고정 seed의 실제 forced INJURY pending은 generic event에서 재활 후 재개한다', async ({ page }) => {
  test.slow();
  await page.addInitScript((seed) => {
    window.localStorage.setItem('offside:e2e-seed', seed);
  }, CAREER_12_FORCED_INJURY_SEED);

  await completeOnboardingThroughContract(page);
  await page.getByRole('link', { name: '계획하러 가기' }).click();
  await expect(page).toHaveURL(/\/career\/.+\/preseason$/);
  await page.getByRole('radio', { name: /^빠른 시즌/ }).click();
  await page.getByRole('radio', { name: /^역할 집중/ }).click();
  await page.getByRole('link', { name: '다음' }).click();
  await page.getByRole('button', { name: '시즌 시작' }).click();
  await resolveRoleProposal(page);

  await reachForcedInjury(page);
  await expect(page).toHaveURL(/\/career\/.+\/event$/);
  const forcedSnapshot = await readLatestCareerSnapshot(page);
  const forcedPending = forcedSnapshot.state.pending;
  expect(forcedPending).toMatchObject({ kind: 'INJURY', eventId: 'EVT-INJ-001', version: 1 });
  expect(forcedPending?.episodeId).toEqual(expect.any(String));
  expect(forcedPending?.step).toBe(forcedSnapshot.state.currentStep);
  const forcedEpisode = forcedSnapshot.state.health.episodes.find((episode) => episode.id === forcedPending?.episodeId);
  expect(forcedEpisode).toMatchObject({ status: 'ACTIVE', severity: expect.stringMatching(/^(MODERATE|MAJOR)$/) });
  expect(forcedEpisode?.occurredAt.matchId).toMatch(/^\d+-\d+-\d+$/);
  await page.getByRole('radio', { name: '표준 재활' }).click();
  await page.getByRole('button', { name: '확정' }).click();
  await expect(page).toHaveURL(/\/career\/.+\/event\/result\?rev=\d+$/);
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page).toHaveURL(/\/career\/[^/]+$/);

  // 첫 forced pending을 닫은 뒤 같은 시즌의 일반 진행이 계속되어야 한다.
  await advanceThroughSeasonToSettlement(page);
  await expect(page.getByRole('button', { name: '결산하기' })).toBeVisible();
});
