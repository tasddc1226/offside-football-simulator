// T-2-016/T-4-027: 실제 Cloudflare QA Worker를 스텁 없이 검증하는 수동 리허설. 기본 profile은
// 일반 staging의 LINE TEST/0.1.0/FAST 한 시즌이고, expanded profile은 PHASE 3+4 QA/0.3.0에서
// FAST와 CHAPTER를 각각 한 시즌 완주한다. 기본 `pnpm e2e`·CI에는 포함되지 않는다.
import { expect, test, type APIRequestContext } from '@playwright/test';
import { createCareerAndIssueRecoveryCode } from './helpers/recovery.js';
import {
  advanceThroughSeasonToSettlement,
  advanceUntilOffers,
  planPreseason,
  resolveRoleProposal,
  signFirstOffer,
} from './helpers/player-creation.js';

type RehearsalProfile = 'line-test' | 'expanded';
type RehearsalMode = {
  mode: 'FAST' | 'CHAPTER';
  label: '빠른 시즌' | '챕터 시즌';
};

const rawProfile = process.env.E2E_STAGING_PROFILE ?? 'line-test';
if (rawProfile !== 'line-test' && rawProfile !== 'expanded') {
  throw new Error(`E2E_STAGING_PROFILE은 line-test 또는 expanded여야 한다: ${rawProfile}`);
}
const profile: RehearsalProfile = rawProfile;
const expanded = profile === 'expanded';
const defaultWebUrl = expanded
  ? 'https://offside-web-expanded.tasddc1569.workers.dev'
  : 'https://offside-web-staging.tasddc1569.workers.dev';
const webUrl = new URL(process.env.E2E_STAGING_URL ?? defaultWebUrl).origin;

function deriveApiUrl(value: string): string {
  const url = new URL(value);
  const apiHostname = url.hostname.replace(/^offside-web(?=-|$)/, 'offside-api');
  if (apiHostname === url.hostname) {
    throw new Error('커스텀 web URL은 E2E_STAGING_API_URL도 명시해야 한다.');
  }
  url.hostname = apiHostname;
  return url.origin;
}

const apiUrl = new URL(process.env.E2E_STAGING_API_URL ?? deriveApiUrl(webUrl)).origin;
const expectedSeasonName =
  process.env.E2E_STAGING_SEASON_NAME?.trim() || (expanded ? 'PHASE 3+4 QA' : 'LINE TEST');
const expectedServiceSeasonId = expanded ? 'svc_phase34_qa' : 'svc_line_test';
const expectedContentPackVersion = expanded ? '0.3.0' : '0.1.0';
const modes: RehearsalMode[] = expanded
  ? [
      { mode: 'FAST', label: '빠른 시즌' },
      { mode: 'CHAPTER', label: '챕터 시즌' },
    ]
  : [{ mode: 'FAST', label: '빠른 시즌' }];

async function expectServiceSeason(request: APIRequestContext): Promise<void> {
  const response = await request.get(`${apiUrl}/v1/service-seasons/current`, {
    headers: { Origin: webUrl },
  });
  expect(response.ok()).toBe(true);
  expect(response.headers()['access-control-allow-origin']).toBe(webUrl);
  const body = (await response.json()) as { data?: Record<string, unknown> };
  expect(body.data).toMatchObject({
    id: expectedServiceSeasonId,
    name: expectedSeasonName,
    status: 'PRESEASON',
    isTest: true,
    rulesetVersion: '1.0.0',
    contentPackVersion: expectedContentPackVersion,
  });
}

test(`staging 리허설: ${expectedSeasonName} 서비스 시즌 manifest와 CORS`, async ({ request }) => {
  await expectServiceSeason(request);
});

for (const rehearsal of modes) {
  test(`staging 리허설: ${profile} 온보딩 → 첫 계약 → ${rehearsal.mode} 시즌 완주 → 결산`, async ({
    page,
  }, testInfo) => {
    test.slow();
    const startedAt = Date.now();
    const eventScreens: string[] = [];
    let deviceId: string | undefined;

    page.on('request', (request) => {
      if (request.method() !== 'POST' || !request.url().includes('/v1/analytics/events')) return;
      try {
        const body = JSON.parse(request.postData() ?? '{}') as { clientId?: unknown };
        if (!deviceId && typeof body.clientId === 'string') deviceId = body.clientId;
      } catch {
        // 분석 배치 본문 파싱 실패는 무시한다 — deviceId는 진단용이라 테스트를 막지 않는다.
      }
    });

    // 새 브라우저 context부터 실제 Worker만 사용한다. 이 파일은 page.route로 API를 대체하지 않는다.
    await page.goto('/');
    await page.waitForURL(/\/(onboarding)?$/);
    const landedPath = new URL(page.url()).pathname;
    console.log(`[rehearsal:${rehearsal.mode}] fresh device landed on ${landedPath}`);

    if (landedPath === '/onboarding') {
      await expect(page.getByTestId('onboarding-service-season-notice')).toContainText(
        '테스트 보관함',
      );
    }

    // 헬퍼가 발급 형식까지 검증한다. 원문 복구 코드는 로그와 attachment에 남기지 않는다.
    await createCareerAndIssueRecoveryCode(page);
    const careerId = new URL(page.url()).pathname.match(/^\/career\/([^/]+)\//)?.[1] ?? 'unknown';
    console.log(`[rehearsal:${rehearsal.mode}] careerId=${careerId} recoveryCode=(redacted)`);

    await advanceUntilOffers(page);
    await signFirstOffer(page);
    console.log(`[rehearsal:${rehearsal.mode}] contract signed at ${Date.now() - startedAt}ms`);

    await planPreseason(page, rehearsal.mode, rehearsal.label, '역할 집중');
    await page.getByRole('button', { name: '시즌 시작' }).click();
    await resolveRoleProposal(page);
    await expect(page).toHaveURL(/\/career\/[^/]+$/);
    await expect(page.getByText(/시즌 1 · .* · step 1\/12/)).toBeVisible();

    // INJURY와 관계 이벤트(LOCKER_ROOM)도 /event 공통 화면이라 같은 헬퍼가 처리한다. 무작위
    // 실플레이에서 실제로 등장한 화면 제목을 남겨, 실행 후 0.3.0 도달 범위를 과장 없이 확인한다.
    await advanceThroughSeasonToSettlement(page, {
      onEventScreen: (title) => eventScreens.push(title),
    });
    await page.getByRole('button', { name: '결산하기' }).click();
    await expect(page).toHaveURL(/\/career\/.+\/season-result$/);
    await expect(page.getByRole('heading', { level: 1, name: '프로 시즌 결과' })).toBeVisible();
    console.log(`[rehearsal:${rehearsal.mode}] season settled at ${Date.now() - startedAt}ms`);

    // 분석 큐(10초 타이머 또는 20건)가 최소 한 번 flush될 시간을 준다. 수집 실패는 gameplay
    // 리허설을 막지 않고 attachment의 null로 남긴다.
    await page.waitForTimeout(12_000);
    console.log(`[rehearsal:${rehearsal.mode}] eventScreens=${JSON.stringify(eventScreens)}`);
    console.log(`[rehearsal:${rehearsal.mode}] deviceId(clientId)=${deviceId ?? '(미확보)'}`);

    await testInfo.attach('rehearsal-ids', {
      body: JSON.stringify(
        {
          profile,
          mode: rehearsal.mode,
          careerId,
          deviceId: deviceId ?? null,
          eventScreens,
        },
        null,
        2,
      ),
      contentType: 'application/json',
    });

    console.log(`[rehearsal:${rehearsal.mode}] total elapsed ${Date.now() - startedAt}ms`);
  });
}
