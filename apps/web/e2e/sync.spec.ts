// TEST-E2E(08 문서) T-1-011: 저장 상태 표시·충돌 해소·오프라인·세션 없음.
// (a) 생성 즉시 저장 (b) 다른 기기 진행 가져오기 (c) 이 기기 진행 유지(fork) (d) 오프라인·온라인
// (e) 401 → 로컬 전용.
import { expect, type Page, test } from '@playwright/test';
import { E2E_META, fulfillJson, triggerConflictAndOpenDialog } from './helpers/sync-conflict.js';

async function startNewCareer(page: Page): Promise<void> {
  await page.goto('/onboarding');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: 'KICKOFF' }).click();
  await expect(page).toHaveURL(/\/career\/.+\/create$/);
}

test('(a) 커리어 생성 즉시 저장하고 배지가 "저장됨"으로 바뀐다', async ({ page }) => {
  await page.route('**/v1/careers/*', async (route) => {
    if (route.request().method() === 'PUT') {
      await fulfillJson(route, 200, {
        data: { revision: 1, syncedAt: '2026-09-02T00:00:00Z' },
        meta: E2E_META,
      });
      return;
    }
    await route.continue();
  });

  await startNewCareer(page);

  // 커리어 레이아웃 헤더(브리프 6 배치 중 하나)에서 확인한다.
  await expect(page.getByText('저장됨')).toBeVisible();

  // 새로고침하면 SyncClient 싱글턴(세션 스코프)이 통째로 새로 생겨 이 careerId의 기록이 없다.
  // useSyncState가 LocalCareerRecord(revision·lastSyncedRevision은 DB에 영속된다)로 보정해
  // "아직 저장 안 됨"으로 되돌아가지 않고 "저장됨"을 유지해야 한다.
  await page.reload();
  await expect(page.getByText('저장됨')).toBeVisible();
  await expect(page.getByText('아직 저장 안 됨')).not.toBeVisible();
});

test('(b) "다른 기기 진행 가져오기": 로컬을 서버 상태로 덮고 배지가 저장됨, 서버 단계 화면으로 이동한다', async ({
  page,
}) => {
  // triggerConflictAndOpenDialog의 "지금 동기화" 왕복은 실제 네트워크·React 렌더 타이밍에
  // 걸려 있다 — 병렬 워커로 CPU를 나눠 쓰면 기본 30s 테스트 타임아웃을 넘길 수 있다(관찰됨).
  // season.spec.ts의 advanceThroughSeasonToSettlement와 같은 이유로 test.slow()를 쓴다.
  test.slow();
  const { careerId } = await triggerConflictAndOpenDialog(page);
  await expect(
    page.getByRole('heading', { level: 2, name: '다른 기기에서 이 커리어가 더 진행됐습니다' }),
  ).toBeVisible();

  await page.getByRole('button', { name: '다른 기기 진행 가져오기' }).click();

  await expect(page.getByText('다른 기기의 진행을 가져왔습니다')).toBeVisible();
  // "다른 기기"는 CREATE_CAREER만 저장한 빈 draft라 screenForCareer가 SCR-002로 보낸다.
  await expect(page).toHaveURL(new RegExp(`/career/${careerId}/create$`));
  await expect(page.getByText('저장됨')).toBeVisible();
});

test('(c) "이 기기 진행 유지": 포크된 새 커리어가 생기고 baseRevision 0으로 저장을 시도한다', async ({
  page,
}) => {
  // (b)와 같은 이유로 test.slow() — triggerConflictAndOpenDialog의 네트워크 왕복이 병렬
  // 워커 부하 아래서 기본 30s를 넘길 수 있다(관찰됨).
  test.slow();
  const { careerId } = await triggerConflictAndOpenDialog(page);

  const putBodies: Array<{ baseRevision: number }> = [];
  await page.route('**/v1/careers/**', async (route) => {
    const request = route.request();
    // 원래(충돌 난) careerId로 가는 요청(PUT·GET 모두)은 손대지 않고 그대로
    // stubRevisionConflict로 넘긴다 — PUT만 넘기고 GET을 route.continue()로 흘려보내면
    // 실제 API 서버가 없어 ERR_CONNECTION_REFUSED가 나 RETRYING에 빠지고(겪은 문제),
    // PUT까지 여기서 200으로 가로채면 뒤늦게 도착하는 디바운스 재시도가 CONFLICT를 조용히
    // IDLE로 되돌려 대화상자를 닫아 버린다(마찬가지로 겪은 문제).
    if (request.url().includes(careerId)) {
      await route.fallback();
      return;
    }
    if (request.method() === 'PUT') {
      putBodies.push(request.postDataJSON() as { baseRevision: number });
      await fulfillJson(route, 200, {
        data: { revision: 1, syncedAt: '2026-09-02T00:10:00Z' },
        meta: E2E_META,
      });
      return;
    }
    await route.continue();
  });

  await page.getByRole('button', { name: '이 기기 진행 유지' }).click();

  await expect(
    page.getByText(
      '이 기기의 진행을 새 커리어로 복사했습니다. 원래 커리어는 다른 기기의 진행을 따릅니다',
    ),
  ).toBeVisible();
  await expect(page).not.toHaveURL(new RegExp(`/career/${careerId}/`));

  await page.goto('/');
  // 허브 기본 탭("최근 선수")은 가장 최근에 갱신된 커리어 하나만 "이어하기" 카드로 보여준다
  // (UX-006 개편) — 포크로 생긴 두 커리어(원본·새 커리어) 모두를 보려면 "선수단 관리"
  // 바로가기로 "다른 선수" 탭(?tab=squad)으로 가야 한다.
  await page.getByRole('link', { name: '선수단 관리' }).click();
  await expect(page).toHaveURL(/\?tab=squad$/);
  await expect(page.getByTestId('career-card')).toHaveCount(2);

  await expect.poll(() => putBodies.some((body) => body.baseRevision === 0)).toBe(true);
});

// context.setOffline(true)는 이 dev 서버(Vite HMR 웹소켓이 떠 있는)에서 메인 프레임 자체를
// ERR_INTERNET_DISCONNECTED로 끊어 문서가 통째로 비워진다(확인됨 — PR 본문 범위 밖 발견).
// 대신 sync.ts가 실제로 읽는 신호(`online: () => navigator.onLine`, `window`의 'online'
// 리스너)를 그대로 흉내 낸다 — 실제 네트워크는 막지 않되 코드가 보는 신호만 바꾼다.
async function setE2eOnline(page: Page, online: boolean): Promise<void> {
  await page.evaluate((value) => {
    (window as unknown as { __e2eOnline: boolean }).__e2eOnline = value;
    if (value) window.dispatchEvent(new Event('online'));
  }, online);
}

test('(d) 오프라인이면 배지가 오프라인으로, 온라인 복귀 뒤 저장된다', async ({ page }) => {
  let putCount = 0;
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      get: () => (window as unknown as { __e2eOnline?: boolean }).__e2eOnline ?? true,
    });
  });
  await page.route('**/v1/careers/*', async (route) => {
    if (route.request().method() === 'PUT') {
      putCount += 1;
      await fulfillJson(route, 200, {
        data: { revision: putCount, syncedAt: '2026-09-02T00:00:00Z' },
        meta: E2E_META,
      });
      return;
    }
    await route.continue();
  });

  await page.goto('/onboarding');
  await setE2eOnline(page, false);

  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: 'KICKOFF' }).click();
  await expect(page).toHaveURL(/\/career\/.+\/create$/);

  await expect(page.getByText('오프라인 · 이 기기에만 저장됨')).toBeVisible();
  expect(putCount).toBe(0);

  await setE2eOnline(page, true);

  await expect(page.getByText('저장됨')).toBeVisible();
  expect(putCount).toBeGreaterThan(0);
});

test('(e) PUT 401이면 설정에 "로컬 전용" 안내와 "다시 연결" 버튼이 보인다', async ({ page }) => {
  await page.route('**/v1/careers/*', async (route) => {
    if (route.request().method() === 'PUT') {
      await fulfillJson(route, 401, {
        error: { code: 'PROFILE_REQUIRED', message: '세션이 없습니다.', retryable: false },
        meta: E2E_META,
      });
      return;
    }
    await route.continue();
  });

  await startNewCareer(page);

  await page.goto('/settings');
  await expect(page.getByText('로컬 전용')).toBeVisible();
  await expect(
    page.getByText(
      '이 브라우저에서는 서버 저장을 할 수 없습니다. 쿠키가 차단됐거나 세션이 없습니다. 복구 코드 없이 브라우저 데이터를 지우면 되돌릴 수 없습니다.',
    ),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: '다시 연결' })).toBeVisible();
});
