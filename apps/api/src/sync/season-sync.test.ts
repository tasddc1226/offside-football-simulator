import {
  CareerStateSchema,
  GetCareerResponseSchema,
  IF_MATCH_HEADER,
  ProfileSchema,
  PutCareerResponseSchema,
  successEnvelope,
} from '@offside/contracts';
import { canonicalize, simulate, type DomainSnapshot, type JsonValue } from '@offside/domain';
import {
  career01,
  career01EngineCommands,
  career02Season,
  career02SeasonEngineCommands,
  career10Transfer,
  career10TransferEngineCommands,
  career11Loan,
  career11LoanEngineCommands,
  rulesetProto,
  type EngineCommand,
} from '@offside/fixtures';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { upsertServiceSeason } from '../db/repos/serviceSeasons.js';
import { createTestD1, type TestD1 } from '../test/d1.js';

/**
 * T-2-006 API-CAR-003·API-VER-001: career-02-season(FAST)의 명령 로그를 세 가지 경로로 서버에
 * 동기화한다 — (a) 한 번에 PUT, (b) step 경계 checkpoint마다 나눠서 PUT(baseRevision·If-Match 연쇄),
 * (c) 중간 하나를 같은 Idempotency-Key로 재전송(스냅샷 유실 뒤 클라이언트가 직전 요청 성공 여부를
 * 모른 채 재시도하는 상황)한 뒤 이어서 PUT. 세 경로 모두 서버가 실제로 시뮬레이션·리플레이를 하지
 * 않으므로(ADR-003) `simulate`로 미리 재생한 실제 시즌 상태를 그대로 보낸다.
 */

const ALLOWED_ORIGIN = 'http://localhost:5173';
const SERVICE_SEASON_ID = 'svc_season_sync';
const CAREER_ID = career01.createCareer.careerId;

function extractSessionToken(setCookie: string): string {
  const token = /offside_session=([^;]+)/.exec(setCookie)?.[1];
  if (!token) throw new Error('Set-Cookie에 offside_session이 없습니다.');
  return token;
}

async function issueCookie(ctx: TestD1): Promise<string> {
  const app = createApp();
  const res = await app.request('/v1/profile', {}, ctx.env);
  const token = extractSessionToken(res.headers.get('Set-Cookie') ?? '');
  successEnvelope(ProfileSchema).parse(await res.json());
  return `offside_session=${token}`;
}

async function ensureServiceSeason(ctx: TestD1): Promise<void> {
  await upsertServiceSeason(ctx.db, {
    id: SERVICE_SEASON_ID,
    name: 'Season sync test',
    status: 'ACTIVE',
    startsAt: '2026-01-01T00:00:00Z',
    endsAt: '2026-12-31T23:59:59Z',
    rulesetVersion: career01.rulesetVersion,
    contentPackVersion: career01.contentPackVersion,
    challengeSetId: 'cs_test',
  });
}

function runOrThrow(
  snapshot: DomainSnapshot | null,
  command: EngineCommand,
  versions: { rulesetVersion: string; contentPackVersion: string },
): DomainSnapshot {
  const result = simulate({
    snapshot,
    command,
    ruleset: rulesetProto,
    rulesetVersion: versions.rulesetVersion,
    contentPackVersion: versions.contentPackVersion,
  });
  if (!result.ok) {
    throw new Error(`${command.type} 실패: ${result.error.code} ${result.error.message}`);
  }
  return result.snapshot;
}

type ReplayStep = { snapshot: DomainSnapshot; command: EngineCommand };

type MarketScenario = {
  label: string;
  careerId: string;
  versions: { rulesetVersion: string; contentPackVersion: string };
  engineCommands: (newId: () => string) => EngineCommand[];
  golden: { revision: number; stateHash: string };
  retryCommandType: 'NEGOTIATE' | 'LOAN_RETURN';
};

/** career01(revision 1~10) 뒤에 이어 career-02-season(FAST, revision 11~17)을 재생한다. */
function buildSteps(): ReplayStep[] {
  let counter = 0;
  const newId = () => `season-sync-${counter++}`;
  const steps: ReplayStep[] = [];

  let snapshot: DomainSnapshot | null = null;
  for (const command of career01EngineCommands(newId)) {
    snapshot = runOrThrow(snapshot, command, career01);
    steps.push({ snapshot, command });
  }
  if (snapshot === null) throw new Error('career01 선행 재생이 비어 있다.');

  for (const command of career02SeasonEngineCommands('FAST', newId, snapshot.revision)) {
    snapshot = runOrThrow(snapshot, command, career02Season);
    steps.push({ snapshot, command });
  }
  return steps;
}

const STEPS = buildSteps();
const CAREER01_STEPS = STEPS.filter((step) => step.snapshot.revision <= career01.golden.revision);
const SEASON_STEPS = STEPS.filter((step) => step.snapshot.revision > career01.golden.revision);

function toPutSnapshot(snapshot: DomainSnapshot) {
  return {
    revision: snapshot.revision,
    checkpoint: snapshot.checkpoint,
    state: canonicalize(snapshot.state as unknown as JsonValue),
    stateHash: snapshot.stateHash,
    rulesetVersion: snapshot.rulesetVersion,
    contentPackVersion: snapshot.contentPackVersion,
    rngState: {
      s: [...snapshot.state.rngState.s] as [number, number, number, number],
      draws: snapshot.state.rngState.draws,
    },
  };
}

function toPutCommand(step: ReplayStep) {
  return {
    revision: step.snapshot.revision,
    commandId: step.command.commandId,
    commandType: step.command.type,
    payload: step.command.payload,
    resultHash: step.snapshot.stateHash,
  };
}

function buildPutBody(chunk: readonly ReplayStep[], baseRevision: number): unknown {
  const last = chunk[chunk.length - 1]!.snapshot;
  return {
    baseRevision,
    snapshot: toPutSnapshot(last),
    commands: chunk.map(toPutCommand),
    createdServiceSeasonId: SERVICE_SEASON_ID,
    rulesetVersion: last.rulesetVersion,
    contentPackVersion: last.contentPackVersion,
  };
}

function putInit(input: { body: unknown; baseRevision: number; idempotencyKey: string; cookie: string }): RequestInit {
  const { body, baseRevision, idempotencyKey, cookie } = input;
  return {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Origin: ALLOWED_ORIGIN,
      'Idempotency-Key': idempotencyKey,
      [IF_MATCH_HEADER]: String(baseRevision),
      Cookie: cookie,
    },
    body: JSON.stringify(body),
  };
}

async function putChunk(input: {
  ctx: TestD1;
  cookie: string;
  careerId?: string;
  chunk: readonly ReplayStep[];
  baseRevision: number;
  idempotencyKey: string;
}) {
  const { ctx, cookie, careerId = CAREER_ID, chunk, baseRevision, idempotencyKey } = input;
  const app = createApp();
  const body = buildPutBody(chunk, baseRevision);
  const res = await app.request(`/v1/careers/${careerId}`, putInit({ body, baseRevision, idempotencyKey, cookie }), ctx.env);
  expect(res.status, `PUT baseRevision=${baseRevision} 실패: ${await res.clone().text()}`).toBe(200);
  return successEnvelope(PutCareerResponseSchema).parse(await res.json());
}

async function getFinalCareer(ctx: TestD1, cookie: string, careerId = CAREER_ID) {
  const app = createApp();
  const res = await app.request(`/v1/careers/${careerId}`, { headers: { Cookie: cookie } }, ctx.env);
  expect(res.status).toBe(200);
  return successEnvelope(GetCareerResponseSchema).parse(await res.json());
}

describe('시즌 동기화 3경로 통합(단일 PUT·checkpoint 분할·Idempotency-Key 재시도)', () => {
  // 세 경로 합쳐 D1 라운드트립 20여 회(PUT 다수 + GET 3회). 전체 스위트를 함께 돌릴 때(공유 머신 부하,
  // T-2-002 100회 반복 테스트와 같은 사유) 기본 5초 타임아웃을 넘을 수 있어 넉넉히 잡는다.
  it('세 경로 모두 최종 revision·stateHash·verificationStatus가 golden과 같다', async () => {
    const contexts: TestD1[] = [];
    try {
      // --- (a) 한 번에 PUT: career01(10개) + 시즌(7개) 전체를 각각 하나의 PUT으로 보낸다. ---
      const ctxA = await createTestD1();
      contexts.push(ctxA);
      await ensureServiceSeason(ctxA);
      const cookieA = await issueCookie(ctxA);
      await putChunk({ ctx: ctxA, cookie: cookieA, chunk: CAREER01_STEPS, baseRevision: 0, idempotencyKey: 'idem-a-base' });
      const resultA = await putChunk({
        ctx: ctxA,
        cookie: cookieA,
        chunk: SEASON_STEPS,
        baseRevision: career01.golden.revision,
        idempotencyKey: 'idem-a-season',
      });

      // --- (b) step 경계 checkpoint마다 나눠서 PUT: 시즌 명령 하나마다 baseRevision·If-Match를 이어 붙인다. ---
      const ctxB = await createTestD1();
      contexts.push(ctxB);
      await ensureServiceSeason(ctxB);
      const cookieB = await issueCookie(ctxB);
      await putChunk({ ctx: ctxB, cookie: cookieB, chunk: CAREER01_STEPS, baseRevision: 0, idempotencyKey: 'idem-b-base' });
      let resultB = null as Awaited<ReturnType<typeof putChunk>> | null;
      for (const step of SEASON_STEPS) {
        resultB = await putChunk({
          ctx: ctxB,
          cookie: cookieB,
          chunk: [step],
          baseRevision: step.snapshot.revision - 1,
          idempotencyKey: `idem-b-${step.snapshot.revision}`,
        });
      }
      if (resultB === null) throw new Error('SEASON_STEPS가 비어 있다.');

      // --- (c) (b)와 같은 분할이되, 중간 하나(RESOLVE_ROLE, revision 12)를 같은 Idempotency-Key·같은
      // 본문으로 두 번 보낸다: 클라이언트가 Snapshot을 잃어버려 직전 PUT의 성공 여부를 모른 채
      // 재시도하는 상황을 흉내 낸다. 두 응답이 같아야 하고(Idempotency-Key 재사용은 캐시된 응답을
      // 그대로 돌려준다), 이어지는 나머지 명령도 정상적으로 적용돼야 한다. ---
      const ctxC = await createTestD1();
      contexts.push(ctxC);
      await ensureServiceSeason(ctxC);
      const cookieC = await issueCookie(ctxC);
      await putChunk({ ctx: ctxC, cookie: cookieC, chunk: CAREER01_STEPS, baseRevision: 0, idempotencyKey: 'idem-c-base' });
      let resultC = null as Awaited<ReturnType<typeof putChunk>> | null;
      let retriedResponse: Awaited<ReturnType<typeof putChunk>> | null = null;
      let firstResponseForRetriedStep: Awaited<ReturnType<typeof putChunk>> | null = null;
      for (const step of SEASON_STEPS) {
        const outcome = await putChunk({
          ctx: ctxC,
          cookie: cookieC,
          chunk: [step],
          baseRevision: step.snapshot.revision - 1,
          idempotencyKey: `idem-c-${step.snapshot.revision}`,
        });
        resultC = outcome;

        if (step.command.type === 'RESOLVE_ROLE') {
          firstResponseForRetriedStep = outcome;
          // Snapshot 유실 뒤 재시도: 같은 Idempotency-Key·같은 본문으로 다시 보낸다.
          retriedResponse = await putChunk({
            ctx: ctxC,
            cookie: cookieC,
            chunk: [step],
            baseRevision: step.snapshot.revision - 1,
            idempotencyKey: `idem-c-${step.snapshot.revision}`,
          });
        }
      }
      if (resultC === null || retriedResponse === null || firstResponseForRetriedStep === null) {
        throw new Error('SEASON_STEPS에 RESOLVE_ROLE이 없다.');
      }
      expect(retriedResponse.data).toEqual(firstResponseForRetriedStep.data);

      const finalSnapshotRevision = career02Season.golden.FAST.revision;
      const finalStateHash = career02Season.golden.FAST.stateHash;

      for (const [label, result] of [
        ['a', resultA],
        ['b', resultB],
        ['c', resultC],
      ] as const) {
        expect(result.data.revision, label).toBe(finalSnapshotRevision);
      }

      const [finalA, finalB, finalC] = await Promise.all([
        getFinalCareer(ctxA, cookieA),
        getFinalCareer(ctxB, cookieB),
        getFinalCareer(ctxC, cookieC),
      ]);

      for (const [label, final] of [
        ['a', finalA],
        ['b', finalB],
        ['c', finalC],
      ] as const) {
        expect(final.data.snapshot.revision, label).toBe(finalSnapshotRevision);
        expect(final.data.snapshot.stateHash, label).toBe(finalStateHash);
      }

      // 세 경로의 최종 verificationStatus가 같다(서버는 리플레이하지 않으므로 이 필드는 ADR-003이
      // 정한 대로 PENDING에 머문다 — apps/api/src/sync/apply-sync.ts 참고).
      expect(resultA.data.verificationStatus).toBe(resultB.data.verificationStatus);
      expect(resultB.data.verificationStatus).toBe(resultC.data.verificationStatus);
    } finally {
      await Promise.all(contexts.map((ctx) => ctx.dispose()));
    }
  }, 30000);
});

const MARKET_COMMAND_TYPES = new Set(['NEGOTIATE', 'ACCEPT_OFFER', 'REJECT_OFFER', 'LOAN_RETURN']);

const MARKET_SCENARIOS: readonly MarketScenario[] = [
  {
    label: 'career-10-transfer',
    careerId: career10Transfer.createCareer.careerId,
    versions: career10Transfer,
    engineCommands: career10TransferEngineCommands,
    golden: career10Transfer.golden,
    retryCommandType: 'NEGOTIATE',
  },
  {
    label: 'career-11-loan',
    careerId: career11Loan.createCareer.careerId,
    versions: career11Loan,
    engineCommands: career11LoanEngineCommands,
    golden: career11Loan.golden,
    retryCommandType: 'LOAN_RETURN',
  },
];

function buildMarketSteps(scenario: MarketScenario): ReplayStep[] {
  let counter = 0;
  let snapshot: DomainSnapshot | null = null;
  const steps: ReplayStep[] = [];
  for (const command of scenario.engineCommands(() => `${scenario.label}-sync-${counter++}`)) {
    snapshot = runOrThrow(snapshot, command, scenario.versions);
    steps.push({ snapshot, command });
  }
  if (snapshot === null) throw new Error(`${scenario.label} 명령 목록이 비어 있다.`);
  return steps;
}

/** checkpoint가 바뀌거나 시장 결정 명령이 끝날 때마다 chunk를 닫아 baseRevision 연쇄를 검증한다. */
function splitMarketSteps(steps: readonly ReplayStep[]): ReplayStep[][] {
  const chunks: ReplayStep[][] = [];
  let current: ReplayStep[] = [];
  for (let index = 0; index < steps.length; index++) {
    const step = steps[index]!;
    const next = steps[index + 1];
    current.push(step);
    const closesAtMarket = MARKET_COMMAND_TYPES.has(step.command.type);
    const changesCheckpoint = next !== undefined && next.snapshot.checkpoint !== step.snapshot.checkpoint;
    if (closesAtMarket || next === undefined || changesCheckpoint || (next !== undefined && MARKET_COMMAND_TYPES.has(next.command.type))) {
      chunks.push(current);
      current = [];
    }
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

async function syncMarketScenario(
  ctx: TestD1,
  cookie: string,
  scenario: MarketScenario,
  steps: readonly ReplayStep[],
  route: 'full' | 'split' | 'retry',
): Promise<Awaited<ReturnType<typeof putChunk>>> {
  if (route === 'full') {
    return putChunk({
      ctx,
      cookie,
      careerId: scenario.careerId,
      chunk: steps,
      baseRevision: 0,
      idempotencyKey: `${scenario.label}-full`,
    });
  }

  let last: Awaited<ReturnType<typeof putChunk>> | null = null;
  let retried = false;
  for (const chunk of splitMarketSteps(steps)) {
    const first = chunk[0]!;
    const baseRevision = first.snapshot.revision - 1;
    const idempotencyKey = `${scenario.label}-${route}-${first.snapshot.revision}`;
    last = await putChunk({
      ctx,
      cookie,
      careerId: scenario.careerId,
      chunk,
      baseRevision,
      idempotencyKey,
    });

    if (route === 'retry' && !retried && chunk.some((step) => step.command.type === scenario.retryCommandType)) {
      const retry = await putChunk({
        ctx,
        cookie,
        careerId: scenario.careerId,
        chunk,
        baseRevision,
        idempotencyKey,
      });
      expect(retry.data).toEqual(last.data);
      retried = true;
    }
  }
  if (last === null) throw new Error(`${scenario.label} 분할 chunk가 비어 있다.`);
  if (route === 'retry') expect(retried, `${scenario.label} ${scenario.retryCommandType} retry`).toBe(true);
  return last;
}

function openPermanentStintCount(state: string): number {
  const parsed = CareerStateSchema.parse(JSON.parse(state));
  return parsed.clubHistory.filter((stint) => stint.kind === 'PERMANENT' && stint.toSeasonIndex === null).length;
}

describe('T-3-004 transfer·loan 동기화 3경로', () => {
  it.each(MARKET_SCENARIOS)('$label: 전체·경계 분할·멱등 재시도의 최종 상태가 같다', async (scenario) => {
    const steps = buildMarketSteps(scenario);
    const contexts: TestD1[] = [];
    try {
      const routes = ['full', 'split', 'retry'] as const;
      const results: Array<Awaited<ReturnType<typeof putChunk>>> = [];
      const finals: Array<Awaited<ReturnType<typeof getFinalCareer>>> = [];

      for (const route of routes) {
        const ctx = await createTestD1();
        contexts.push(ctx);
        await ensureServiceSeason(ctx);
        const cookie = await issueCookie(ctx);
        results.push(await syncMarketScenario(ctx, cookie, scenario, steps, route));
        finals.push(await getFinalCareer(ctx, cookie, scenario.careerId));
      }

      for (const [index, result] of results.entries()) {
        expect(result.data.revision, `${scenario.label} ${routes[index]} revision`).toBe(scenario.golden.revision);
        expect(finals[index]!.data.snapshot.stateHash, `${scenario.label} ${routes[index]} hash`).toBe(scenario.golden.stateHash);
        expect(finals[index]!.data.snapshot.revision, `${scenario.label} ${routes[index]} final revision`).toBe(scenario.golden.revision);
        expect(openPermanentStintCount(finals[index]!.data.snapshot.state), `${scenario.label} ${routes[index]} open permanent`).toBe(1);
      }
      expect(results.map((result) => result.data.verificationStatus), `${scenario.label} verificationStatus`).toEqual([
        results[0]!.data.verificationStatus,
        results[0]!.data.verificationStatus,
        results[0]!.data.verificationStatus,
      ]);
      expect(finals.map((final) => final.data.snapshot.stateHash), `${scenario.label} final hashes`).toEqual(
        Array(3).fill(scenario.golden.stateHash),
      );
    } finally {
      await Promise.all(contexts.map((ctx) => ctx.dispose()));
    }
  }, 60000);
});
