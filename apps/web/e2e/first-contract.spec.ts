// TEST-E2E(08 문서): 온보딩 → SCR-002/003/004 → KICKOFF → SCR-007/008/013(반복) → SCR-014 →
// SCR-009 → SCR-010 → SCR-029 전 구간.
//
// CONFIRM_PLAYER 직후 FAST 모드는 곧장 SETTLEMENT 단계(step 고정)로 진입해, 그 안에서 프로 계약
// 전 서사 이벤트(EVT-CON-002·003 및 상시 조건의 EVT-REL-001 등)가 도메인 가중 랜덤으로 몇 차례
// 뜨고 소진된 뒤에야 제안(OFFERS)이 열린다. 그래서 특정 이벤트·화면을 고정하지 않고, "이벤트 화면
// (SCR-007/008/013)이면 첫 선택지를 확정하고 결과를 다음으로 넘긴다"를 offers 도착까지 반복한다.
import { expect, test, type Page } from '@playwright/test';
import {
  advanceUntilOffers,
  fulfillJson,
  goToConfirm,
  META,
  signFirstOffer,
  readCurrentCareerState,
} from './helpers/player-creation.js';

// SCR-008 입단 테스트의 진행 연출(Stepper)을 건너뛰어 결정론적으로 만든다 — useReducedMotion()이
// OS 미디어쿼리(SYSTEM 기본값)를 구독하므로, 브라우저 컨텍스트 자체를 reduced-motion으로 연다.
// reducedMotion은 PlaywrightTestOptions 최상위가 아니라 BrowserContextOptions에 있다(contextOptions로 감싸야 한다).
test.use({ contextOptions: { reducedMotion: 'reduce' } });

/** The player-life dashboard shows the first unstarted season, not the retired legacy progressbar. */
async function expectFirstPreseasonReady(page: Page): Promise<void> {
  const progress = page.getByRole('region', { name: '선수 인생 진행' });
  await expect(progress).toBeVisible();
  await expect(progress.locator('strong')).toHaveText('1/12 시즌');
  for (const label of ['1. 시즌 초반', '2. 주전 경쟁', '3. 마지막 승부']) {
    await expect(progress.getByText(label, { exact: true })).toHaveAttribute('data-active', 'false');
    await expect(progress.getByText(label, { exact: true })).toHaveAttribute('data-complete', 'false');
  }
  const saved = await readCurrentCareerState(page);
  expect(saved.season).toBeNull();
  expect(saved.seasonHistory).toHaveLength(0);
  expect(saved.pending).toBeNull();
  expect(saved.contract).not.toBeNull();
  await expect(page.getByRole('region', { name: '지금 할 일' }).getByRole('heading', { name: '프리시즌 계획' })).toBeVisible();
}

test('온보딩부터 첫 계약 뒤 복구 안내·프리시즌까지: SCR-002~004 → 이벤트 → SCR-009 → SCR-010 → SCR-029', async ({
  page,
}) => {
  const startedAt = Date.now();
  let profileRequests = 0;
  let recoveryCodeRequests = 0;
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path === '/v1/profile') profileRequests += 1;
    if (path === '/v1/profile/recovery-code') recoveryCodeRequests += 1;
  });

  await goToConfirm(page);
  const profileRequestsBeforeKickoff = profileRequests;
  const recoveryCodeRequestsBeforeKickoff = recoveryCodeRequests;
  await page.getByRole('button', { name: /이 선수로 시작/ }).click();
  await expect(page).toHaveURL(/\/career\/.+\/(path|tryout|event)$/);
  // 앱 부팅 시 프로필 조회가 있을 수 있으므로 KICKOFF 직전 스냅샷과 비교해 SCR-004 구간의
  // 무호출을 검증한다.
  expect(profileRequests).toBe(profileRequestsBeforeKickoff);
  expect(recoveryCodeRequests).toBe(recoveryCodeRequestsBeforeKickoff);

  // helper의 실패 스텁을 상태를 기억하는 성공 응답으로 바꿔 첫 계약 뒤에만 정상 발급되는 시점과,
  // 발급 완료 뒤 새로고침 시 이미 발급된 프로필로 자동 진행하는 실제 서버 의미를 검증한다.
  let recoveryCodeIssued = false;
  await page.route('**/v1/profile', (route) => {
    return fulfillJson(route, 200, {
      data: {
        id: 'prf_first_contract',
        settings: {
          reducedMotion: 'SYSTEM',
          textScale: 100,
          theme: 'SYSTEM',
          defaultSimulationMode: 'FAST',
        },
        linked: { google: false, toss: false },
        recoveryCodeIssuedAt: recoveryCodeIssued ? '2026-09-16T00:00:00Z' : null,
        createdAt: '2026-09-01T00:00:00Z',
        googleEmailMasked: null,
        pendingMerge: null,
      },
      meta: META,
    });
  });
  await page.route('**/v1/profile/recovery-code', (route) => {
    recoveryCodeIssued = true;
    return fulfillJson(route, 200, {
      data: { code: 'OFS-ABCD-2345-EFGH', issuedAt: '2026-09-16T00:00:00Z' },
      meta: META,
    });
  });

  await advanceUntilOffers(page);
  // 룰셋 1.7.2/팩 0.6.6 운영 승격(release-ruleset-1-7-2): 현재 운영 활성 룰셋은 offerRules.preContract가
  // 있어(진로 선택 → 스카우트 평가 브리지 1건 → 첫 제안) 이 커리어는 항상 그 서사를 겪는다 — 첫 제안
  // 화면 eyebrow는 새 문구 "스카우트 평가 뒤 도착한 제안"이어야 하고 옛 "새로운 유니폼"은 보이지
  // 않아야 한다. preContract 없는 옛 룰셋에서의 옛 문구 회귀는 career.$careerId.offers.test.tsx가
  // ACTIVE_RULESET_VERSION과 무관하게 1.0.0/0.1.0을 명시 고정해 계속 검증한다.
  await expect(page.getByText('스카우트 평가 뒤 도착한 제안')).toBeVisible();
  await expect(page.getByText('새로운 유니폼')).not.toBeVisible();
  await signFirstOffer(page, { stopAtRecovery: true });

  const recoveryUrl = new URL(page.url());
  expect(recoveryUrl.pathname).toMatch(/\/career\/.+\/confirm$/);
  expect(recoveryUrl.searchParams.get('step')).toBe('recovery');
  expect(recoveryUrl.searchParams.get('milestone')).toBe('first-contract');
  await expect(page.getByText('OFS-ABCD-2345-EFGH')).toBeVisible();
  const profileRequestsAtRecovery = profileRequests;
  expect(profileRequestsAtRecovery).toBeGreaterThanOrEqual(1);
  expect(recoveryCodeRequests).toBe(1);

  // 정상 발급 뒤 새로고침은 GET /profile의 issuedAt을 보고 코드를 다시 만들지 않고 dashboard로 간다.
  await page.reload();
  await expect(page).toHaveURL(/\/career\/[^/]+$/);
  expect(profileRequests).toBeGreaterThan(profileRequestsAtRecovery);
  expect(recoveryCodeRequests).toBe(1);
  await expect(page.getByText('계약을 맺었습니다')).toBeVisible();
  await expectFirstPreseasonReady(page);
  await expect(page.getByRole('link', { name: '계획하러 가기' })).toBeVisible();
  await expect(page.getByText(/step 12 · 시즌 정산/)).toHaveCount(0);

  // UX-014(2026-09-14): 선수 이름은 이제 대시보드 자체가 아니라 모든 /career/:id/* 화면에 고정된
  // 커리어 상단 헤더(CareerHeaderBar)가 보여준다 — 그 페이지 h1은 화면마다 다른 제목을 쓰므로 여기서는
  // heading이 아니라 헤더 안 텍스트로 확인한다.
  await expect(page.getByText('김서준')).toBeVisible();
  // 계약 후에만 열리는 전술 적합도·감독 신뢰(06 "점진적 공개")가 보이면 계약이 실제로 반영된 것이다.
  await page.getByRole('tab', { name: '선수' }).click();
  await expect(page.getByRole('region', { name: '선수 성장' })).toBeVisible();

  await page.getByRole('tab', { name: '커리어' }).click();
  await expect(page.getByText('팀')).toBeVisible();
  await expect(page.getByText('주급')).toBeVisible();

  const elapsedMs = Date.now() - startedAt;
  console.log(`[first-contract] 온보딩→계약·대시보드 소요 시간: ${elapsedMs}ms`);
  expect(elapsedMs).toBeLessThan(5 * 60 * 1000);
});

test('첫 계약 뒤 첫 복구 코드 발급 실패는 recovery URL 새로고침에서도 복원된다', async ({
  page,
}) => {
  let profileRequests = 0;
  let recoveryCodeRequests = 0;
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path === '/v1/profile') profileRequests += 1;
    if (path === '/v1/profile/recovery-code') recoveryCodeRequests += 1;
  });

  await goToConfirm(page);
  const profileRequestsBeforeKickoff = profileRequests;
  const recoveryCodeRequestsBeforeKickoff = recoveryCodeRequests;
  await page.getByRole('button', { name: /이 선수로 시작/ }).click();
  await expect(page).toHaveURL(/\/career\/.+\/(path|tryout|event)$/);
  expect(profileRequests).toBe(profileRequestsBeforeKickoff);
  expect(recoveryCodeRequests).toBe(recoveryCodeRequestsBeforeKickoff);

  await page.route('**/v1/profile', (route) =>
    fulfillJson(route, 200, {
      data: {
        id: 'prf_first_contract_failure',
        settings: {
          reducedMotion: 'SYSTEM',
          textScale: 100,
          theme: 'SYSTEM',
          defaultSimulationMode: 'FAST',
        },
        linked: { google: false, toss: false },
        recoveryCodeIssuedAt: null,
        createdAt: '2026-09-01T00:00:00Z',
        googleEmailMasked: null,
        pendingMerge: null,
      },
      meta: META,
    }),
  );
  await page.route('**/v1/profile/recovery-code', (route) =>
    fulfillJson(route, 503, {
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: '서비스를 이용할 수 없습니다.',
        retryable: true,
      },
      meta: META,
    }),
  );

  await advanceUntilOffers(page);
  await signFirstOffer(page, { stopAtRecovery: true });
  await expect(page).toHaveURL(/\/career\/.+\/confirm\?step=recovery&milestone=first-contract$/);
  await expect(
    page.getByText('지금은 발급할 수 없습니다. 설정에서 나중에 발급할 수 있습니다.'),
  ).toBeVisible();
  expect(profileRequests).toBeGreaterThanOrEqual(1);
  expect(recoveryCodeRequests).toBe(1);

  await page.reload();
  await expect(page).toHaveURL(/\/career\/.+\/confirm\?step=recovery&milestone=first-contract$/);
  await expect(
    page.getByText('지금은 발급할 수 없습니다. 설정에서 나중에 발급할 수 있습니다.'),
  ).toBeVisible();
  expect(recoveryCodeRequests).toBe(2);

  await page.getByRole('button', { name: '계속' }).click();
  await expect(page).toHaveURL(/\/career\/[^/]+$/);
  await expectFirstPreseasonReady(page);
  await expect(page.getByRole('link', { name: '계획하러 가기' })).toBeVisible();
});
