// TEST-E2E(08 문서) T-2-012, D-54·D-55: 서비스 시즌 포인터(허브 배지·배너·버튼 비활성화)와 분석
// 이벤트 파이프라인(funnel_reached·choice_selected, PII 없음)을 검사한다.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import type { AnalyticsEventsBody, PutCareerBody, ServiceSeasonCurrent } from '@offside/contracts';
import { E2E_META, fulfillJson } from './helpers/sync-conflict.js';
import { completeOnboardingAndConfirm } from './helpers/player-creation.js';
import { expectRoute } from './helpers/route.js';

const WITH_API = process.env.E2E_WITH_API === '1';
const API_URL = process.env.E2E_API_URL ?? 'http://localhost:8787';

const TEST_SEASON: ServiceSeasonCurrent = {
  id: 'svc_line_test',
  name: 'LINE TEST',
  status: 'PRESEASON',
  isTest: true,
  startsAt: '2026-09-08T00:00:00Z',
  endsAt: '2026-10-31T00:00:00Z',
  rulesetVersion: '1.0.0',
  contentPackVersion: '0.1.0',
  notice: 'LINE_TEST',
};

const LOCKED_SEASON: ServiceSeasonCurrent = {
  id: 'svc_locked',
  name: 'Locked',
  status: 'LOCKED',
  isTest: false,
  startsAt: '2026-01-01T00:00:00Z',
  endsAt: '2026-02-01T00:00:00Z',
  rulesetVersion: '1.0.0',
  contentPackVersion: '0.1.0',
  notice: null,
};

/** document.visibilityState를 강제로 'hidden'으로 바꿔 analytics.ts의 flush 트리거(visibilitychange)를
 * 즉시 발생시킨다 — 큐 20건·10초 타이머를 기다리지 않는다(packages/platform/src/web/analytics.ts). */
async function forceAnalyticsFlush(page: Page): Promise<void> {
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

test('테스트 시즌이면 허브 배너·카드 배지가 뜨고 커리어 생성 요청에 그 시즌 id가 실린다(axe 위반 없음)', async ({
  page,
}) => {
  await page.route('**/v1/service-seasons/current', (route) =>
    fulfillJson(route, 200, { data: TEST_SEASON, meta: E2E_META }),
  );

  let putBody: PutCareerBody | undefined;
  await page.route('**/v1/careers/**', async (route) => {
    if (route.request().method() !== 'PUT') {
      await route.continue();
      return;
    }
    putBody = route.request().postDataJSON() as PutCareerBody;
    await fulfillJson(route, 200, {
      data: { revision: putBody.snapshot.revision, syncedAt: '2026-01-01T00:00:00Z' },
      meta: E2E_META,
    });
  });

  await page.goto('/onboarding');
  await page.getByLabel('이름').fill('김서준');
  await page.getByRole('button', { name: /다음 · 후보 카드 열기/ }).click();
  await expectRoute(page, /\/career\/.+\/style$/);

  await expect.poll(() => putBody?.createdServiceSeasonId).toBe(TEST_SEASON.id);

  await page.goto('/');
  await expect(page.getByTestId('service-season-banner')).toContainText(
    /테스트 보관함에 남고.*정식 시즌 도전에는 집계되지 않습니다/,
  );
  await expect(page.getByTestId('career-card-test-badge')).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  const seriousOrCritical = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(seriousOrCritical).toEqual([]);
});

test('테스트 시즌이면 온보딩 첫 슬라이드에도 안내 문구가 보인다(axe 위반 없음)', async ({
  page,
}) => {
  await page.route('**/v1/service-seasons/current', (route) =>
    fulfillJson(route, 200, { data: TEST_SEASON, meta: E2E_META }),
  );

  await page.goto('/onboarding');
  await expect(page.getByTestId('onboarding-service-season-notice')).toContainText(
    /테스트 보관함에 남고.*정식 시즌 도전에는 집계되지 않습니다/,
  );

  const results = await new AxeBuilder({ page }).analyze();
  const seriousOrCritical = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(seriousOrCritical).toEqual([]);
});

test('시즌이 LOCKED면 커리어 시작 버튼이 비활성화되고 안내 문구가 보인다', async ({ page }) => {
  await page.route('**/v1/service-seasons/current', (route) =>
    fulfillJson(route, 200, { data: LOCKED_SEASON, meta: E2E_META }),
  );

  await page.goto('/onboarding');
  await page.getByRole('link', { name: '선수 생성 닫기' }).click();
  await expectRoute(page, /\/$/);

  await expect(page.getByRole('button', { name: '커리어 시작' })).toBeDisabled();
  await expect(
    page.getByText('지금은 새 커리어를 시작할 수 없습니다. 잠시 후 다시 시도해 주세요.'),
  ).toBeVisible();
});

test('CONFIRM_PLAYER·선택지 확정이 분석 이벤트로 전송되고 본문 어디에도 선수 이름이 없다', async ({
  page,
}) => {
  const capturedEvents: AnalyticsEventsBody['events'] = [];
  const capturedRawBodies: string[] = [];
  await page.route('**/v1/analytics/events', async (route) => {
    const raw = route.request().postData() ?? '';
    capturedRawBodies.push(raw);
    const body = JSON.parse(raw) as AnalyticsEventsBody;
    capturedEvents.push(...body.events);
    await fulfillJson(route, 202, { data: { accepted: body.events.length }, meta: E2E_META });
  });

  await completeOnboardingAndConfirm(page); // 내부에서 CONFIRM_PLAYER 성공 시 funnel_reached(PLAYER_CONFIRMED)를 큐에 넣는다.

  await page.getByRole('radio').first().click();
  await page.getByRole('button', { name: '확정' }).click(); // choice_selected를 큐에 넣는다(RESOLVE_EVENT 제출 직전).
  await expectRoute(page, /\/event\/result\?rev=\d+$/);

  await forceAnalyticsFlush(page);

  // 큐가 FLUSH_QUEUE_SIZE(20)를 넘겨 이미 자동 flush된 배치가 있었다면 두 이벤트가 서로 다른
  // POST로 나뉠 수 있다 — 각각 독립적으로 도착을 기다린다(둘 다 같은 capturedEvents 배열에 쌓인다).
  await expect
    .poll(() =>
      capturedEvents.some(
        (event) => event.name === 'funnel_reached' && event.props?.stage === 'PLAYER_CONFIRMED',
      ),
    )
    .toBe(true);
  await expect
    .poll(() => capturedEvents.some((event) => event.name === 'choice_selected'))
    .toBe(true);
  expect(capturedRawBodies.every((body) => !body.includes('김서준'))).toBe(true);
});

test.describe('실제 api로 서비스 시즌·분석 이벤트 확인', () => {
  test.skip(!WITH_API, 'E2E_WITH_API=1일 때만 실제 apps/api로 검사한다');

  test('현재 서비스 시즌이 svc_kickoff이고 커리어 생성·분석 이벤트 전송이 성공한다', async ({
    page,
  }) => {
    // page.request는 브라우저 fetch가 아니라 Node 쪽 HTTP 클라이언트라 CORS 대상이 아니다(GET은
    // originGuard 대상도 아니다 — service-seasons.ts 주석 참고).
    const current = await page.request.get(`${API_URL}/v1/service-seasons/current`);
    expect(current.status()).toBe(200);
    const currentBody = (await current.json()) as { data: ServiceSeasonCurrent };
    expect(currentBody.data.id).toBe('svc_kickoff');
    expect(currentBody.data.isTest).toBe(false);
    expect(currentBody.data.rulesetVersion).toBe('3.1.0');
    expect(currentBody.data.contentPackVersion).toBe('0.10.0');

    await page.goto('/onboarding');
    await page.getByLabel('이름').fill('김서준');
    const [putResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes('/v1/careers/') && response.request().method() === 'PUT',
      ),
      page.getByRole('button', { name: /다음 · 후보 카드 열기/ }).click(),
    ]);
    expect(putResponse.status()).toBe(200);

    const [analyticsResponse] = await Promise.all([
      page.waitForResponse((response) => response.url().includes('/v1/analytics/events')),
      forceAnalyticsFlush(page),
    ]);
    expect(analyticsResponse.status()).toBe(202);
  });
});
