// T-7-036 D-89: 룰셋 1.7.2/팩 0.6.6의 첫 계약 전 흐름 — KICKOFF → SCR-007 진로 선택 →
// 스카우트 평가 브리지 이벤트 1건(SCR-013, 맥락 라벨) → SCR-009 제안. 계약 없음 구간의 generic
// EVENT는 offerRules.preContract(maxEventsBeforeFirstOffer·bridgeEventIds)로 상한이 걸려, 진로
// 선택 1건 + 브리지 1건을 넘기지 않고 바로 제안이 열린다는 것을 화면에서 확인한다(도메인 단위
// 테스트는 packages/domain/src/simulate.test.ts에 있다 — 이 spec은 그 계약이 실제 화면 순서와
// 문구에 반영됐는지만 본다).
import { expect, test } from '@playwright/test';
import type { PutCareerBody, ServiceSeasonCurrent } from '@offside/contracts';
import {
  fillPlayerInfo,
  fulfillJson,
  META,
  resolveCurrentEventScreen,
  startNewCareer,
} from './helpers/player-creation.js';

const PRECONTRACT_SEASON: ServiceSeasonCurrent = {
  id: 'svc_precontract_e2e',
  name: '스카우트 평가 다리 검증',
  status: 'PRESEASON',
  isTest: true,
  startsAt: '2026-09-08T00:00:00Z',
  endsAt: null,
  rulesetVersion: '1.7.2',
  contentPackVersion: '0.6.6',
  notice: null,
};

test('1.7.2/0.6.6: 진로 선택 뒤 스카우트 평가 1건만 뜨고 곧장 첫 제안이 열린다', async ({
  page,
}) => {
  await page.route('**/v1/service-seasons/current', (route) =>
    fulfillJson(route, 200, { data: PRECONTRACT_SEASON, meta: META }),
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
  // 아카데미 배경의 "남아 추가 평가를 받는다"(A)를 고른다 — EVT-CON-023(스카우트 평가) 브리지로
  // followUp이 확정 연결돼 있어 RNG 없이 결정론적이다(1.7.2/0.6.6 조합 한정, 다른 배경·선택도
  // 각자 브리지 이벤트 1건으로 끝난다).
  await fillPlayerInfo(page);
  await page.getByRole('button', { name: /다음 · 후보 카드 열기/ }).click();
  await page.getByRole('button', { name: '3장 모두 열기' }).click();
  await page.getByRole('button', { name: '인사이드 포워드 후보 선택' }).click();
  await page.getByRole('button', { name: /이 후보로 진행/ }).click();

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

  // 1) SCR-007 진로 선택 — 기존 흐름 그대로(전용 화면·라벨, 사건 상한과 무관).
  await expect(page).toHaveURL(/\/career\/.+\/path$/);
  await expect(
    page.getByRole('heading', { level: 1, name: '어떤 길을 걸어갈까요?' }),
  ).toBeVisible();
  await page.getByRole('radio', { name: /남아 추가 평가/ }).click();
  await page.getByRole('button', { name: '확정' }).click();
  await expect(page).toHaveURL(/\/event\/result\?rev=\d+$/);
  await page.getByRole('button', { name: '다음' }).click();

  // 2) 브리지(스카우트 평가) — SCR-013 라우트를 타지만 계약 전 다리 이벤트 맥락 라벨을 쓴다.
  await expect(page).toHaveURL(/\/career\/.+\/event$/);
  await expect(page.getByRole('dialog', { name: '평가가 이어지고 있습니다' })).toBeVisible();
  await expect(page.getByText('스카우트 평가', { exact: true }).first()).toBeVisible();
  await resolveCurrentEventScreen(page);

  // 3) 곧장 첫 제안 — 상한(2건: 진로 1 + 브리지 1)에 닿아 세 번째 사건 없이 SCR-009로 넘어간다.
  await expect(page).toHaveURL(/\/career\/.+\/offers$/);
  await expect(page.getByText('스카우트 평가 뒤 도착한 제안')).toBeVisible();
  await expect(page.getByText(/자리를 보고 제안했습니다/).first()).toBeVisible();
});
