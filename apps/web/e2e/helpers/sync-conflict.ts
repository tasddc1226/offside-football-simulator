// T-1-011 sync·a11y 스펙이 함께 쓰는 "다른 기기" 충돌 시나리오 준비 도구. 실제
// createEngineClient·inlineSimulator로 진짜 유효한(decodeSnapshot이 통과하는) CareerSnapshot을
// Node 쪽에서 만들어, `/v1/careers/{id}`를 page.route로 스텁한다.
import type { CareerSnapshot } from '@offside/contracts';
import { loadRuleset } from '@offside/content';
import { createEngineClient, inlineSimulator, MemoryLocalStore, encodeSnapshot } from '@offside/engine-client';
import type { Page, Route } from '@playwright/test';
import { fillPlayerInfo, startNewCareer } from './player-creation.js';

// @offside/fixtures의 career-01 JSON import는 import attribute 없이 돼 있어(브라우저·vitest
// 번들러에서는 통과하지만) Playwright의 Node ESM 로더에서는 깨진다 — 그래서 여기서는 대신
// @offside/content의 loadRuleset(JSON import attribute를 올바로 쓴다)을 쓴다.
const rulesetProto = loadRuleset('1.0.0');

export const E2E_META = { requestId: 'e2e-req' };

export async function fulfillJson(route: Route, status: number, body: unknown): Promise<void> {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

/** "다른 기기"가 revision 1(CREATE_CAREER만, draft 비어있음)까지 저장해 둔 상태를 흉내낸다. */
export async function buildForeignDeviceSnapshot(careerId: string): Promise<CareerSnapshot> {
  const engine = createEngineClient({ store: new MemoryLocalStore(), simulator: inlineSimulator, ruleset: rulesetProto });
  const created = await engine.execute({
    careerId,
    command: {
      type: 'CREATE_CAREER',
      commandId: 'e2e-foreign-create',
      expectedRevision: 0,
      payload: {
        careerId,
        seed: 'e2e-foreign-device-seed',
        simulationMode: 'FAST',
        rulesetVersion: '1.0.0',
        contentPackVersion: '0.1.0',
      },
    },
    createdServiceSeasonId: 'svc_kickoff',
  });
  if (!created.ok) {
    throw new Error(`e2e: 다른 기기 스냅샷 시드 실패 ${created.error.code} ${created.error.message}`);
  }
  return encodeSnapshot(created.domainSnapshot, { careerId, createdAt: '2026-01-01T00:00:00Z' });
}

/** `/v1/careers/{careerId}`의 PUT은 항상 409(CAREER_REVISION_CONFLICT), GET은 serverSnapshot을 준다. */
export async function stubRevisionConflict(page: Page, careerId: string, serverSnapshot: CareerSnapshot): Promise<void> {
  await page.route(`**/v1/careers/${careerId}`, async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      // GetCareerResponseSchema(packages/contracts/src/careers.ts)는 strictObject라
      // createdServiceSeasonId가 없으면 파싱이 실패한다 — engine-client의
      // resolveRevisionConflict가 그 실패를 SERVICE_UNAVAILABLE로 삼켜 조용히 재시도만 반복하고
      // CONFLICT 상태로 못 넘어간다(직접 확인: PUT 409→GET 200을 몇 초 간격으로 무한 반복, 대화상자는
      // 끝내 안 뜬다). buildForeignDeviceSnapshot이 CREATE_CAREER에 쓴 것과 같은 값을 넣는다.
      await fulfillJson(route, 200, {
        data: { createdServiceSeasonId: 'svc_kickoff', snapshot: serverSnapshot, commands: [] },
        meta: E2E_META,
      });
      return;
    }
    if (method === 'PUT') {
      await fulfillJson(route, 409, {
        error: {
          code: 'CAREER_REVISION_CONFLICT',
          message: '다른 기기가 먼저 저장했습니다.',
          retryable: false,
          details: { serverRevision: serverSnapshot.revision, serverSnapshotUrl: `/v1/careers/${careerId}` },
        },
        meta: E2E_META,
      });
      return;
    }
    await route.continue();
  });
}

/**
 * 이름·국적·왼발·윙어·클럽 아카데미까지 채운 뒤 "다음"으로 SCR-003(style)에 도착시킨다(revision 2).
 * 설정의 "지금 동기화"로 디바운스를 기다리지 않고 즉시 충돌을 만든 뒤, 다시 그 커리어 화면으로
 * 돌아가 충돌 대화상자가 열린 상태로 돌려준다.
 */
export async function triggerConflictAndOpenDialog(page: Page): Promise<{ careerId: string; serverSnapshot: CareerSnapshot }> {
  // careerId를 알기 전(폼을 채우는 동안)에도 CREATE_CAREER 같은 즉시 체크포인트가 실제
  // localhost:8787로 나가 RETRYING에 빠지지 않도록, 먼저 전부 성공으로 받는 기본 스텁을 건다.
  // 아래에서 특정 careerId로 등록하는 stubRevisionConflict가 나중에 등록돼 그 careerId에는
  // 우선한다.
  await page.route('**/v1/careers/**', async (route) => {
    if (route.request().method() === 'PUT') {
      await fulfillJson(route, 200, { data: { revision: 1, syncedAt: '2026-01-01T00:00:00Z' }, meta: E2E_META });
      return;
    }
    await route.continue();
  });

  await startNewCareer(page);
  await fillPlayerInfo(page);
  await page.getByRole('button', { name: '플레이 스타일 고르기' }).click();
  await page.waitForURL(/\/career\/.+\/style$/);

  const match = page.url().match(/\/career\/([^/]+)\/style/);
  const careerId = match?.[1];
  if (careerId === undefined) throw new Error('e2e: careerId를 URL에서 찾지 못했다');

  const serverSnapshot = await buildForeignDeviceSnapshot(careerId);
  await stubRevisionConflict(page, careerId, serverSnapshot);

  await page.goto('/settings');
  const [getResponse] = await Promise.all([
    page.waitForResponse((response) => response.url().includes(`/v1/careers/${careerId}`) && response.request().method() === 'GET'),
    page.getByRole('button', { name: '지금 동기화' }).click(),
  ]);
  if (getResponse.status() !== 200) throw new Error(`e2e: 충돌 GET 스텁 실패(${getResponse.status()})`);

  await page.goto(`/career/${careerId}/style`);
  // 충돌 감지는 이 페이지의 useSyncState가 진입 시 걸어 두는 GET 왕복(스텁 응답이라도 네트워크
  // 큐·React 렌더 타이밍은 남는다) 뒤에야 대화상자를 띄운다 — 고정 대기 대신 대화상자 자체가 뜨는
  // 것을 상태 기반으로 기다린다. 병렬 워커로 CPU를 나눠 쓰면 늦어질 수 있어 넉넉히 잡는다.
  await page
    .getByRole('heading', { level: 2, name: '다른 기기에서 이 커리어가 더 진행됐습니다' })
    .waitFor({ state: 'visible', timeout: 20_000 });

  return { careerId, serverSnapshot };
}
