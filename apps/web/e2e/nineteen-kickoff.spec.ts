import { expect, test } from '@playwright/test';
import type { PutCareerBody, ServiceSeasonCurrent } from '@offside/contracts';
import {
  advanceThroughSeasonToSettlement,
  advanceUntilOffers,
  fulfillJson,
  fillPlayerInfo,
  META,
  planPreseason,
  resolveCurrentEventScreen,
  resolveRoleProposal,
  signFirstOffer,
  startNewCareer,
} from './helpers/player-creation.js';

const NINETEEN_SEASON: ServiceSeasonCurrent = {
  id: 'svc_nineteen_e2e',
  name: '19세 킥오프 검증',
  status: 'PRESEASON',
  isTest: true,
  startsAt: '2026-09-08T00:00:00Z',
  endsAt: null,
  rulesetVersion: '1.2.0',
  contentPackVersion: '0.4.0',
  notice: 'LINE_TEST',
};

const REALISTIC_OPENING_SEASON: ServiceSeasonCurrent = {
  ...NINETEEN_SEASON,
  id: 'svc_realistic_opening_e2e',
  name: '배경별 도입 검증',
  contentPackVersion: '0.4.1',
};

const GAMEPLAY_RECOVERY_SEASON: ServiceSeasonCurrent = {
  ...NINETEEN_SEASON,
  id: 'svc_gameplay_recovery_e2e',
  name: '게임성 회복 검증',
  rulesetVersion: '1.3.0',
  contentPackVersion: '0.5.0',
};

test('1.2/0.4 새 인생: 19세 도입과 첫 진로를 거쳐 첫 시즌 뒤 20세가 된다', async ({ page }) => {
  test.slow();
  await page.addInitScript(() =>
    window.localStorage.setItem('offside:e2e-seed', 'e2e-season-result-01'),
  );
  await page.route('**/v1/service-seasons/current', (route) =>
    fulfillJson(route, 200, { data: NINETEEN_SEASON, meta: META }),
  );
  await page.route('**/v1/careers/**', async (route) => {
    if (route.request().method() !== 'PUT') {
      await route.continue();
      return;
    }
    const body = route.request().postDataJSON() as PutCareerBody;
    await fulfillJson(route, 200, {
      data: { revision: body.snapshot.revision, syncedAt: '2026-09-08T00:00:00Z' },
      meta: META,
    });
  });

  await startNewCareer(page);
  await expect(page.getByText('새 인생 · 19세')).toBeVisible();
  await expect(
    page.getByText(
      /열아홉.*아카데미의 추가 평가.*학교팀에서 만든 기록.*지역 무대에서 온 훈련 초대/,
    ),
  ).toBeVisible();
  await fillPlayerInfo(page);
  await page.getByRole('button', { name: '플레이 스타일 고르기' }).click();
  await page.getByRole('radio', { name: '인사이드 포워드 선택' }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByText('1.2.0 / 0.4.0')).toBeVisible();

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
  await page.getByRole('button', { name: 'KICKOFF' }).click();

  await expect(page).toHaveURL(/\/career\/.+\/path$/);
  await page.getByRole('radio').first().click();
  await page.getByRole('button', { name: '확정' }).click();
  await expect(page).toHaveURL(/\/event\/result\?rev=\d+$/);
  await page.getByRole('button', { name: '다음' }).click();

  await advanceUntilOffers(page);
  await signFirstOffer(page);
  await planPreseason(page, '역할 집중');
  await page.getByRole('button', { name: '시즌 시작' }).click();
  await resolveRoleProposal(page);
  await advanceThroughSeasonToSettlement(page);
  await page.getByRole('button', { name: '결산하기' }).click();
  await expect(page).toHaveURL(/\/career\/.+\/season-result$/);
  await page.getByRole('link', { name: '대시보드' }).click();
  await expect(page.getByText(/^20세 ·/)).toBeVisible();
});

test('1.2/0.4.1 지역 무대 배경: 새로고침 뒤에도 고유 도입과 후속 이야기가 이어진다', async ({
  page,
}) => {
  test.slow();
  await page.addInitScript(() =>
    window.localStorage.setItem('offside:e2e-seed', 'e2e-realistic-opening-street-01'),
  );
  await page.route('**/v1/service-seasons/current', (route) =>
    fulfillJson(route, 200, { data: REALISTIC_OPENING_SEASON, meta: META }),
  );
  await page.route('**/v1/careers/**', async (route) => {
    if (route.request().method() !== 'PUT') {
      await route.continue();
      return;
    }
    const body = route.request().postDataJSON() as PutCareerBody;
    await fulfillJson(route, 200, {
      data: { revision: body.snapshot.revision, syncedAt: '2026-09-08T00:00:00Z' },
      meta: META,
    });
  });

  await startNewCareer(page);
  await fillPlayerInfo(page, '지역출발', /지역 무대에서 온 훈련 초대/);
  await page.reload();
  await expect(
    page.getByRole('heading', { level: 2, name: '내가 가장 뛰고 싶은 위치' }),
  ).toBeVisible();
  await page.getByRole('button', { name: '플레이 스타일 고르기' }).click();
  await page.getByRole('radio', { name: '인사이드 포워드 선택' }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByText('지역 무대에서 온 훈련 초대')).toBeVisible();
  await expect(page.getByText('1.2.0 / 0.4.1')).toBeVisible();

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
  await page.getByRole('button', { name: 'KICKOFF' }).click();

  await expect(page).toHaveURL(/\/career\/.+\/path$/);
  await expect(page.getByText(/지역 경기 영상을 본 지도자/)).toBeVisible();
  await resolveCurrentEventScreen(page);
  await expect(page).toHaveURL(/\/career\/.+\/event$/);
  await expect(
    page.getByText(/준비해 온 관찰전이 끝났다.*아직 계약이나 역할이 확정된 것은 아니다/),
  ).toBeVisible();
  await resolveCurrentEventScreen(page);
  await advanceUntilOffers(page);
  await signFirstOffer(page);
});

test('1.3/0.5 새 인생: 성인 팀과 계약해 첫 시즌 뒤 20세가 된다', async ({ page }) => {
  test.slow();
  await page.addInitScript(() =>
    window.localStorage.setItem('offside:e2e-seed', 'e2e-gameplay-recovery-adult-01'),
  );
  await page.route('**/v1/service-seasons/current', (route) =>
    fulfillJson(route, 200, { data: GAMEPLAY_RECOVERY_SEASON, meta: META }),
  );
  await page.route('**/v1/careers/**', async (route) => {
    if (route.request().method() !== 'PUT') {
      await route.continue();
      return;
    }
    const body = route.request().postDataJSON() as PutCareerBody;
    await fulfillJson(route, 200, {
      data: { revision: body.snapshot.revision, syncedAt: '2026-09-08T00:00:00Z' },
      meta: META,
    });
  });

  await startNewCareer(page);
  await fillPlayerInfo(page, '성인진로', /아카데미의 추가 평가/);
  await page.getByRole('button', { name: '플레이 스타일 고르기' }).click();
  await page.getByRole('radio', { name: '인사이드 포워드 선택' }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByText('1.3.0 / 0.5.0')).toBeVisible();

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
  await page.getByRole('button', { name: 'KICKOFF' }).click();
  await resolveCurrentEventScreen(page);
  await resolveCurrentEventScreen(page);
  await advanceUntilOffers(page);
  await signFirstOffer(page);
  await expect(page.locator('body')).not.toContainText('한강 FC U18과 계약');

  await planPreseason(page, '역할 집중');
  await page.getByRole('button', { name: '시즌 시작' }).click();
  await resolveRoleProposal(page);
  await advanceThroughSeasonToSettlement(page);
  await page.getByRole('button', { name: '결산하기' }).click();
  await page.getByRole('link', { name: '대시보드' }).click();
  await expect(page.getByText(/^20세 ·/)).toBeVisible();
});
