// TEST-E2E(08 문서) T-1-013, D-21: Google 연결·병합 왕복.
// (a) 실제 api(GOOGLE_FAKE=1)로 연결 → 콜백 → 행이 "연결됨"으로 바뀐다. 두 번째 컨텍스트가 커리어를
//     만든 뒤 같은 가짜 sub로 연결 → 병합 대화상자 → "옮기기" → 그 커리어가 허브에 남는다. 가짜 sub는
//     고정값(google-oidc.ts D-21)이라 로컬 D1을 반복 실행해도 이전 실행의 연결이 남을 수 있다 —
//     그래도 "두 컨텍스트가 서로 다른 프로필이다"는 항상 성립하므로, 첫 컨텍스트의 결과 문구
//     (linked·switched)는 못박지 않고 "연결됨" 상태만, 두 번째는 병합 뒤 커리어가 남아있는지만 본다.
// (b) 스텁(page.route)으로 ?google=merge_required 진입 → 대화상자 → POST /auth/merge에 mergeChoice가
//     실리는지 확인한다.
import { expect, test } from '@playwright/test';
import { E2E_META, fulfillJson } from './helpers/sync-conflict.js';

const WITH_API = process.env.E2E_WITH_API === '1';

test.describe('Google 연결·병합(실제 api)', () => {
  test.skip(!WITH_API, 'E2E_WITH_API=1일 때만 실제 apps/api로 검사한다');
  test.describe.configure({ mode: 'serial' });

  test('연결 → 병합 대화상자 → 옮기기: 두 번째 기기의 커리어가 연결된 프로필에 남는다', async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    try {
      const pageA = await contextA.newPage();
      await pageA.goto('/settings');
      await pageA.getByRole('button', { name: 'Google로 연결' }).click();
      await expect(pageA).toHaveURL(/\/settings(\?google=.*)?$/, { timeout: 15_000 });
      await expect(pageA.getByRole('button', { name: '연결 해제' })).toBeVisible({ timeout: 15_000 });

      const pageB = await contextB.newPage();
      await pageB.goto('/onboarding');
      await pageB.getByRole('button', { name: '다음' }).click();
      await pageB.getByRole('button', { name: '다음' }).click();
      await pageB.getByRole('button', { name: 'KICKOFF' }).click();
      await pageB.getByLabel('이름').fill('박은비');
      await pageB.getByLabel('국적').selectOption('KR');
      await pageB.getByRole('radio', { name: '오른발' }).click();
      await pageB.getByRole('tab', { name: '공격수' }).click();
      await pageB.getByRole('radio', { name: /윙어/ }).click();
      await pageB.getByRole('radio', { name: /클럽 아카데미/ }).click();
      await pageB.getByRole('button', { name: '다음' }).click();
      await expect(pageB).toHaveURL(/\/career\/.+\/style$/);

      await pageB.goto('/settings');
      await pageB.getByRole('button', { name: 'Google로 연결' }).click();
      await expect(pageB).toHaveURL(/\/settings\?google=merge_required/, { timeout: 15_000 });
      await expect(pageB.getByRole('heading', { level: 2, name: 'Google에 연결된 프로필이 있습니다' })).toBeVisible();

      await pageB.getByRole('button', { name: '이 기기의 커리어 1개를 Google 프로필로 옮기기' }).click();
      await expect(pageB.getByText(/Google 프로필과 합쳤습니다\. 커리어 \d+개/)).toBeVisible({ timeout: 15_000 });

      await pageB.goto('/');
      await expect(pageB.getByRole('heading', { level: 2, name: '박은비' })).toBeVisible({ timeout: 15_000 });
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});

test('Google 병합(스텁): ?google=merge_required 진입 시 대화상자가 뜨고 옮기기가 POST /auth/merge를 호출한다', async ({
  page,
}) => {
  let mergeBody: { mergeChoice?: string } | undefined;
  await page.route('**/v1/profile', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await fulfillJson(route, 200, {
      data: {
        id: 'prf_e2e_stub',
        settings: { reducedMotion: 'SYSTEM', textScale: 100, theme: 'SYSTEM', defaultSimulationMode: 'FAST' },
        linked: { google: false, toss: false },
        recoveryCodeIssuedAt: '2026-09-01T00:00:00Z',
        createdAt: '2026-08-01T00:00:00Z',
        googleEmailMasked: null,
        pendingMerge: { targetCareerCount: 3 },
      },
      meta: E2E_META,
    });
  });
  await page.route('**/v1/careers', async (route) => {
    if (route.request().method() === 'GET') {
      await fulfillJson(route, 200, { data: { items: [], nextCursor: null }, meta: E2E_META });
      return;
    }
    await route.continue();
  });
  await page.route('**/v1/auth/merge', async (route) => {
    mergeBody = route.request().postDataJSON() as { mergeChoice?: string };
    await fulfillJson(route, 200, { data: { profileId: 'prf_target', careerCount: 3 }, meta: E2E_META });
  });

  await page.goto('/settings?google=merge_required&current=0&target=3');

  await expect(page.getByRole('heading', { level: 2, name: 'Google에 연결된 프로필이 있습니다' })).toBeVisible();
  await page.getByRole('button', { name: '이 기기의 커리어 0개를 Google 프로필로 옮기기' }).click();

  await expect.poll(() => mergeBody?.mergeChoice).toBe('MOVE_TO_LINKED');
  await expect(page).toHaveURL(/\/settings$/);
});
