// TEST-E2E(08 문서): 첫 방문 → 온보딩 → 건너뛰기 → 빈 허브 → KICKOFF → DRAFT → 허브 카드 → 삭제.
import { expect, test } from '@playwright/test';
import { NOTICES_FIXTURE, stubNotices, stubNoticesFailure } from './helpers/notices.js';

test('첫 방문은 게임 소개 페이지가 보이고, 온보딩을 건너뛰면 빈 허브가 보인다', async ({
  page,
}) => {
  // 사용자 결정(2026-09-14): 공지사항은 서버 API(GET /v1/notices)에서 온다 — 랜딩(PublicIntroduction)의
  // HomeCommunity가 이관된 공지 2건을 그대로 보여주는지 함께 확인한다.
  await stubNotices(page);

  // D-70(#117): 커리어가 없고 온보딩도 안 본 첫 방문자는 더 이상 /onboarding으로 자동 리다이렉트되지
  // 않는다 — 허브(/)가 PublicIntroduction 랜딩을 직접 보여주고, "게임 시작" 링크로만 온보딩에 간다.
  await page.goto('/');

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1, name: 'OFFSIDE' })).toBeVisible();

  await expect(page.getByText(`${NOTICES_FIXTURE.length}개`)).toBeVisible();
  for (const notice of NOTICES_FIXTURE) {
    await expect(page.getByRole('button', { name: notice.title })).toBeVisible();
  }

  await page.getByRole('link', { name: '내 선수 만들기' }).click();

  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(
    page.getByRole('heading', { level: 1, name: '한 명의 선수로, 축구 인생 전체를 플레이하세요' }),
  ).toBeVisible();

  await page.getByRole('button', { name: '건너뛰기' }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole('heading', { level: 2, name: '아직 만든 커리어가 없습니다' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: '커리어 시작' })).toBeVisible();
});

test('KICKOFF로 커리어를 만들면 허브 카드가 보이고, 삭제하면 다시 사라진다', async ({ page }) => {
  await page.goto('/onboarding');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: 'KICKOFF' }).click();

  await expect(page).toHaveURL(/\/career\/.+\/create$/);
  await expect(
    page.getByRole('heading', { level: 1, name: '다음 무대를 향해, 킥오프' }),
  ).toBeVisible();

  // SCR-002는(자리표시와 달리) 허브로 돌아가는 링크를 두지 않는다(01 문서 "이탈": 다음으로만
  // 나간다) — 허브 카드 확인을 위해 직접 이동한다.
  await page.goto('/');

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 2, name: '이름 없는 선수' })).toBeVisible();
  await expect(page.getByText('만드는 중')).toBeVisible();

  // IndexedDB(platform LocalStore) 영속성 확인: 새로고침 후에도 카드가 그대로 보인다.
  await page.reload();
  await expect(page.getByRole('heading', { level: 2, name: '이름 없는 선수' })).toBeVisible();

  // "최근 선수"(resume) 탭의 기본 카드는 featured=true라 상세 관리 disclosure를 두지 않는다 —
  // 삭제하려면 "선수단 관리"(squad 탭)로 이동해야 한다.
  await page.getByRole('link', { name: '선수단 관리' }).click();
  await expect(page).toHaveURL(/\?tab=squad$/);
  await page.getByText('상세 관리').click();
  await page.getByRole('button', { name: '커리어 삭제' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByText('되돌릴 수 없습니다. 정말 삭제할까요?')).toBeVisible();
  await page.getByRole('button', { name: '삭제 확정' }).click();

  await expect(page.getByRole('heading', { level: 2, name: '이름 없는 선수' })).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('이름 없는 선수의 커리어를 삭제했습니다');
});

test('공지 API가 실패하면(캐시 없음) 빈 목록 문구로 대체된다', async ({ page }) => {
  await stubNoticesFailure(page);

  await page.goto('/');

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('아직 공지가 없습니다.')).toBeVisible();
  await expect(page.getByText('0개')).toBeVisible();
});
