// TEST-E2E(08 문서): 첫 방문 → 온보딩 → 건너뛰기 → 빈 허브 → KICKOFF → DRAFT → 허브 카드 → 삭제.
import { expect, test } from '@playwright/test';
import { startNewCareer, fillPlayerInfo } from './helpers/player-creation.js';
import { NOTICES_FIXTURE, stubNotices, stubNoticesFailure } from './helpers/notices.js';
import { currentRoute, expectRoute } from './helpers/route.js';

test('첫 방문은 게임 소개 페이지가 보이고, 온보딩을 건너뛰면 빈 허브가 보인다', async ({
  page,
}) => {
  // 사용자 결정(2026-09-14): 공지사항은 서버 API(GET /v1/notices)에서 온다 — 랜딩(PublicIntroduction)의
  // HomeCommunity가 이관된 공지 2건을 그대로 보여주는지 함께 확인한다.
  await stubNotices(page);

  // D-70(#117): 커리어가 없고 온보딩도 안 본 첫 방문자는 더 이상 /onboarding으로 자동 리다이렉트되지
  // 않는다 — 허브(/)가 PublicIntroduction 랜딩을 직접 보여주고, "게임 시작" 링크로만 온보딩에 간다.
  await page.goto('/');

  await expectRoute(page, /\/$/);
  await expect(
    page.getByRole('heading', { level: 1, name: /이번 생은.*프리미어리거/ }),
  ).toBeVisible({ timeout: 15000 });

  await page.getByText('소식 · 게임 안내', { exact: true }).click();
  await expect(page.getByText(`${NOTICES_FIXTURE.length}개`)).toBeVisible();
  for (const notice of NOTICES_FIXTURE) {
    await expect(page.getByRole('button', { name: notice.title })).toBeVisible();
  }

  await page.getByRole('link', { name: '내 선수 만들기' }).click();

  await expectRoute(page, /\/onboarding$/);
  await expect(page.getByRole('heading', { level: 1, name: '선수 생성' })).toBeVisible();

  await page.getByRole('link', { name: '선수 생성 닫기' }).click();

  await expectRoute(page, /\/$/);
  await expect(
    page.getByRole('heading', { level: 2, name: '아직 만든 커리어가 없습니다' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: '커리어 시작' })).toBeVisible();
});

test('KICKOFF로 커리어를 만들면 허브 카드가 보이고, 삭제하면 다시 사라진다', async ({ page }) => {
  await startNewCareer(page);
  await fillPlayerInfo(page);
  await page.getByRole('button', { name: /다음 · 후보 카드 열기/ }).click();
  await expectRoute(page, /\/style$/);

  // SCR-002는(자리표시와 달리) 허브로 돌아가는 링크를 두지 않는다(01 문서 "이탈": 다음으로만
  // 나간다) — 허브 카드 확인을 위해 직접 이동한다.
  await page.goto('/');

  await expectRoute(page, /\/$/);
  await expect(page.getByRole('heading', { level: 2, name: '김서준' })).toBeVisible();
  await expect(page.getByText('만드는 중')).toBeVisible();

  // IndexedDB(platform LocalStore) 영속성 확인: 새로고침 후에도 카드가 그대로 보인다.
  await page.reload();
  await expect(page.getByRole('heading', { level: 2, name: '김서준' })).toBeVisible();

  // "최근 선수"(resume) 탭의 기본 카드는 featured=true라 상세 관리 disclosure를 두지 않는다 —
  // 삭제하려면 "선수단 관리"(squad 탭)로 이동해야 한다.
  await page.getByRole('link', { name: '선수단 관리' }).click();
  await expectRoute(page, /\?tab=squad$/);
  await page.getByText('상세 관리').click();
  await page.getByRole('button', { name: '커리어 삭제' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByText('되돌릴 수 없습니다. 정말 삭제할까요?')).toBeVisible();
  await page.getByRole('button', { name: '삭제 확정' }).click();

  await expect(page.getByRole('heading', { level: 2, name: '김서준' })).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('김서준의 커리어를 삭제했습니다');
});

test('T-7-039: 커리어 화면에서 주소창은 `/`로 고정되고, 새로고침·뒤로 가기는 앱 안에서 화면을 되돌린다', async ({
  page,
}) => {
  await startNewCareer(page);
  await fillPlayerInfo(page);
  await page.getByRole('button', { name: /다음 · 후보 카드 열기/ }).click();
  await expectRoute(page, /\/style$/);

  // 브리프 4번: 커리어 화면(공개 허용 목록 밖)은 실제 주소창을 `/`로 감춘다 — 실제 화면은
  // currentRoute(dataset.route)로만 확인한다.
  expect(page.url()).toBe(new URL('/', page.url()).toString());

  // 브리프 2번: 새로고침(navigation type reload)은 sessionStorage로 같은 화면을 복원한다.
  const beforeReload = await currentRoute(page);
  await page.reload();
  expect(page.url()).toBe(new URL('/', page.url()).toString());
  await expectRoute(page, beforeReload);
  await expect(page.getByRole('button', { name: '3장 모두 열기' })).toBeVisible();

  // 브리프 5번: 물리적 뒤로 가기는 실제 이탈이 아니라 앱 안에서 한 단계만 되돌린다. onboarding→style
  // 전환은 `replace: true`라 메모리 히스토리가 한 엔트리뿐이라(`canGoBack() === false`) 라우터
  // 안에서 더 갈 곳이 없다 — 이 경우 가드는 (b) 규칙대로 허브(`/`)로 보내고, 사이트를 벗어나지
  // 않는다(실제 주소창도 계속 `/`).
  await page.goBack();
  await expectRoute(page, /^\/$/);
  expect(page.url()).toBe(new URL('/', page.url()).toString());
  await expect(
    page
      .getByRole('button', { name: '커리어 시작' })
      .or(page.getByRole('heading', { level: 2, name: '김서준' })),
  ).toBeVisible();

  // T-7-039 regression: once the first guard pop reaches home, a later
  // in-app transition must re-arm the guard so browser Back still returns to
  // home instead of becoming an external/document exit.
  const startCareer = page.getByRole('button', { name: '커리어 시작' });
  if (await startCareer.isVisible()) {
    await startCareer.click();
    await expectRoute(page, /\/onboarding$/);
    await page.goBack();
    await expectRoute(page, /^\/$/);
  }
});

test('공지 API가 실패하면(캐시 없음) 빈 목록 문구로 대체된다', async ({ page }) => {
  await stubNoticesFailure(page);

  await page.goto('/');

  await expectRoute(page, /\/$/);
  await expect(page.getByText('아직 공지가 없습니다.')).toBeVisible();
  await expect(page.getByText('0개')).toBeVisible();
});
