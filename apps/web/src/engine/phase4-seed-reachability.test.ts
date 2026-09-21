// T-4-009 §3 완료 조건: "seed 도구의 명령 재현(도구가 만든 seed를 실제 엔진 경로로 재생하면 같은
// pending이 열림 — vitest에서 도메인 직접 실행으로 확인)". `apps/web/e2e/helpers/find-seed.ts`는
// apps/web/src 밖이라(rootDir 경계, find-seed.ts 헤더 주석 참고) 이 파일이 직접 import할 수 없다 —
// 대신 find-seed.ts와 독립적으로, 이 파일이 이 앱의 실제 화면이 쓰는 그 명령 조립 함수
// (`./career-actions.ts`)로 같은 seed를 처음부터 재생해, `phase4-seeds.ts`가 기록한 season·step에서
// 정말 같은 eventId·presentation이 열리는지 교차 검증한다. find-seed.ts는 `@offside/domain`·
// `@offside/content`·`@offside/engine-client`만으로 명령 payload를 "다시 조립"하므로(같은
// rootDir 경계 때문에 career-actions.ts를 그대로 쓸 수 없다), 이 테스트가 실패하면 find-seed.ts의
// 조립이 실제 앱과 어긋난다는 뜻이다 — phase4-seeds.ts 값을 T-4-005가 신뢰할 수 있는 근거.
//
// TARGETS는 `apps/web/e2e/helpers/phase4-seeds.ts`와 값을 동기화한다(import 불가라 손으로 복사 —
// 어긋나면 이 테스트가 실패해 알려준다).
import { describe, expect, it } from 'vitest';
import {
  advance,
  confirmPlayer,
  execute,
  resolveEvent,
  resolveChapter,
  resolveRole,
  acceptOffer,
  settleSeason,
  updateDraft,
} from './career-actions.js';
import { createAppEngine, type AppEngine } from './engine.js';
import { FALLBACK_SERVICE_SEASON_ID } from './versions.js';
import { loadContentPack, loadRuleset } from '@offside/content';
import { MemoryLocalStore, inlineSimulator, type EngineCommand } from '@offside/engine-client';

const RULESET_VERSION = '1.0.0';

// e2e/helpers/player-creation.ts의 fillPlayerInfo와 같은 기본 선택(find-seed.ts DRAFT_STEP_1/2와 동일).
const DRAFT_STEP_1 = {
  name: '김서준',
  gender: 'MALE' as const,
  nationalityCode: 'KR',
  preferredFoot: 'LEFT' as const,
};
const DRAFT_STEP_2 = {
  position: 'W' as const,
  archetypeId: 'inside-forward',
  backgroundId: 'club-academy',
};

type Target = {
  /** 문서 목적. 실제 검증은 eventId·season·step로 한다. */
  presentation: string;
  packVersion: string;
  seed: string;
  seasonIndex: number;
  step: number;
  eventId: string;
};

// `apps/web/e2e/helpers/phase4-seeds.ts`(§3 도달성 보고, PR 본문 표와 동일)와 동기화한다.
// RUMOUR는 phase4-seeds.ts에 값이 없으므로(0.2.0·0.3.0 둘 다 미도달) 여기에도 없다.
const TARGETS: Target[] = [
  {
    presentation: 'INJURY',
    packVersion: '0.2.0',
    seed: 'offside-seed-search-2',
    seasonIndex: 1,
    step: 6,
    eventId: 'EVT-INJ-001',
  },
  {
    presentation: 'SLUMP',
    packVersion: '0.2.0',
    seed: 'offside-seed-search-17',
    seasonIndex: 1,
    step: 5,
    eventId: 'EVT-SLUMP-010',
  },
  {
    presentation: 'LOCKER_ROOM',
    packVersion: '0.2.0',
    seed: 'offside-seed-search-70',
    seasonIndex: 1,
    step: 8,
    eventId: 'EVT-REL-010',
  },
  {
    presentation: 'ETHICS',
    packVersion: '0.2.0',
    seed: 'offside-seed-search-2',
    seasonIndex: 2,
    step: 9,
    eventId: 'EVT-ETH-010',
  },
  {
    presentation: 'MEDIA',
    packVersion: '0.2.0',
    seed: 'offside-seed-search-0',
    seasonIndex: 1,
    step: 4,
    eventId: 'EVT-MEDIA-010',
  },
  {
    presentation: 'RUMOUR',
    packVersion: '0.2.0',
    seed: 'offside-seed-search-0',
    seasonIndex: 2,
    step: 7,
    eventId: 'EVT-CON-010',
  },
];

// T-4-023: phase4-seeds.ts NATIONAL_TEAM과 동기화(find-seed.ts --pack 0.3.0
// --max-seasons 30 --seed-count 200 --seed-prefix offside-nat-search
// --presentation NATIONAL_TEAM 탐색의 가장 이른 hit).  This path is intentionally
// opt-in: it replays 20 seasons and is a reachability audit, not part of the
// default fast unit-test budget.  It remains independently runnable with
// OFFSIDE_SLOW_TESTS=1. CI keeps this audit explicit so the default suite does
// not spend nearly a minute replaying twenty seasons on every change.
const NATIONAL_TEAM_TARGET: Target = {
  presentation: 'NATIONAL_TEAM',
  packVersion: '0.3.0',
  seed: 'offside-nat-search-0',
  seasonIndex: 20,
  step: 8,
  eventId: 'EVT-NAT-001',
};

function makeIdGenerator(prefix: string): () => string {
  let counter = 0;
  return () => `${prefix}-${counter++}`;
}

async function makeEngine(packVersion: string): Promise<AppEngine> {
  const ruleset = loadRuleset(RULESET_VERSION);
  const pack = loadContentPack(packVersion);
  return createAppEngine({
    store: new MemoryLocalStore(),
    simulator: inlineSimulator,
    ruleset,
    pack,
    newId: makeIdGenerator('phase4'),
  });
}

/** engine.client.execute를 직접 쓴다 — CREATE_CAREER는 아직 커리어가 없어 execute()(loadCareer
 * 선행)로는 못 보낸다(engine.test.ts의 createSignedCareer와 같은 관례). */
async function createCareerWithSeed(
  engine: AppEngine,
  careerId: string,
  seed: string,
): Promise<void> {
  const command: EngineCommand = {
    type: 'CREATE_CAREER',
    commandId: engine.newId(),
    expectedRevision: 0,
    payload: {
      careerId,
      seed,
      simulationMode: 'CHAPTER',
      rulesetVersion: engine.versions.rulesetVersion,
      contentPackVersion: engine.versions.contentPackVersion,
    },
  };
  const created = await engine.client.execute({
    careerId,
    command,
    createdServiceSeasonId: FALLBACK_SERVICE_SEASON_ID,
  });
  if (!created.ok)
    throw new Error(`CREATE_CAREER 실패: ${created.error.code} ${created.error.message}`);
}

/** CONFIRM_PLAYER부터 첫 계약(OFFERS 수락)까지. 모든 EVENT는 정의의 첫 선택지로 닫는다(find-seed.ts
 * onboard()와 같은 정책). */
async function onboardToContract(engine: AppEngine, careerId: string): Promise<void> {
  await updateDraft(engine, careerId, DRAFT_STEP_1);
  await updateDraft(engine, careerId, DRAFT_STEP_2);
  const confirmed = await confirmPlayer(engine, careerId);
  if (!confirmed.ok)
    throw new Error(`CONFIRM_PLAYER 실패: ${confirmed.error.code} ${confirmed.error.message}`);

  for (let guard = 0; guard < 10; guard += 1) {
    const load = await engine.client.loadCareer(careerId);
    if (!load.ok) throw new Error(`loadCareer 실패: ${load.error.code}`);
    const pending = load.snapshot.state.pending;
    if (pending?.kind === 'OFFERS') {
      const offer = pending.offers[0];
      if (offer === undefined) throw new Error('OFFERS pending인데 offers가 비어 있다');
      const accepted = await acceptOffer(engine, careerId, offer.id);
      if (!accepted.ok)
        throw new Error(`ACCEPT_OFFER 실패: ${accepted.error.code} ${accepted.error.message}`);
      return;
    }
    if (pending === null) {
      const result = await advance(engine, careerId);
      if (!result.ok)
        throw new Error(`advance(온보딩) 실패: ${result.error.code} ${result.error.message}`);
      continue;
    }
    if (pending.kind === 'EVENT') {
      const definition = engine.pack.eventsById.get(pending.eventId);
      if (definition === undefined) throw new Error(`팩에 이벤트 정의 없음: ${pending.eventId}`);
      const choice = definition.choices[0];
      if (choice === undefined) throw new Error(`이벤트에 선택지 없음: ${pending.eventId}`);
      const resolved = await resolveEvent(engine, careerId, choice.id);
      if (!resolved.ok)
        throw new Error(
          `RESOLVE_EVENT(온보딩 ${pending.eventId}) 실패: ${resolved.error.code} ${resolved.error.message}`,
        );
      continue;
    }
    throw new Error(`온보딩 중 예상 밖 pending: ${pending.kind}`);
  }
  throw new Error('온보딩이 10회 안에 OFFERS에 도달하지 못했다');
}

type StepResult = { matched: boolean; blocked?: string };

/** pending 하나를 "첫 선택지"로 닫는다. eventId가 target과 일치하는 EVENT/INJURY/NATIONAL_TEAM
 * pending을 만나면 즉시 matched:true로 멈춘다(더 진행하지 않는다 — find-seed.ts의 "가장 이른 사례"
 * 정책과 같다). */
async function stepOnceTowards(
  engine: AppEngine,
  careerId: string,
  targetEventId: string,
  maxSeasons: number,
  startedSeasonsRef: { count: number },
): Promise<StepResult> {
  const load = await engine.client.loadCareer(careerId);
  if (!load.ok) return { matched: false, blocked: `loadCareer: ${load.error.code}` };
  const state = load.snapshot.state;
  if (state.status !== 'ACTIVE') return { matched: false, blocked: `status=${state.status}` };
  const pending = state.pending;

  if (pending === null) {
    if (state.contract !== null && state.season === null) {
      if (startedSeasonsRef.count >= maxSeasons)
        return { matched: false, blocked: 'SEASON_BUDGET_EXCEEDED' };
      startedSeasonsRef.count += 1;
      const result = await execute(engine, careerId, {
        type: 'START_SEASON',
        payload: { simulationMode: 'CHAPTER', serviceSeasonId: FALLBACK_SERVICE_SEASON_ID },
      });
      if (!result.ok)
        return {
          matched: false,
          blocked: `START_SEASON: ${result.error.code} ${result.error.message}`,
        };
      return { matched: false };
    }
    // career-actions.advance는 실제 UI와 동일하게 최신 snapshot에서
    // eligibleEvents/chapterCandidates를 계산해 payload에 넣는다.
    const result = await advance(engine, careerId);
    if (!result.ok)
      return { matched: false, blocked: `ADVANCE: ${result.error.code} ${result.error.message}` };
    return { matched: false };
  }

  if (pending.kind === 'EVENT' || pending.kind === 'INJURY' || pending.kind === 'NATIONAL_TEAM') {
    if (pending.eventId === targetEventId) return { matched: true };
    const definition = engine.pack.eventsById.get(pending.eventId);
    if (definition === undefined)
      return { matched: false, blocked: `팩에 이벤트 정의 없음: ${pending.eventId}` };
    const choice = definition.choices[0];
    if (choice === undefined)
      return { matched: false, blocked: `이벤트에 선택지 없음: ${pending.eventId}` };
    const result = await resolveEvent(engine, careerId, choice.id);
    if (!result.ok)
      return {
        matched: false,
        blocked: `RESOLVE_EVENT(${pending.eventId}): ${result.error.code} ${result.error.message}`,
      };
    return { matched: false };
  }

  if (pending.kind === 'CHAPTER') {
    const definition = engine.pack.chaptersById.get(pending.chapterId);
    if (definition === undefined)
      return { matched: false, blocked: `팩에 챕터 정의 없음: ${pending.chapterId}` };
    const decision = definition.decisions[pending.resolved.length];
    if (decision === undefined) return { matched: false, blocked: '챕터 판단 인덱스 초과' };
    const option = decision.options[0];
    if (option === undefined)
      return { matched: false, blocked: `판단에 선택지 없음: ${decision.id}` };
    const result = await resolveChapter(engine, careerId, decision.id, option.id);
    if (!result.ok)
      return {
        matched: false,
        blocked: `RESOLVE_CHAPTER: ${result.error.code} ${result.error.message}`,
      };
    return { matched: false };
  }

  if (pending.kind === 'OFFERS' || pending.kind === 'CONTRACT') {
    const offer = pending.offers[0];
    if (offer === undefined) {
      const result = await advance(engine, careerId);
      if (!result.ok)
        return {
          matched: false,
          blocked: `ADVANCE(CONTRACT checkpoint): ${result.error.code} ${result.error.message}`,
        };
      return { matched: false };
    }
    const result = await acceptOffer(engine, careerId, offer.id);
    if (!result.ok)
      return {
        matched: false,
        blocked: `ACCEPT_OFFER: ${result.error.code} ${result.error.message}`,
      };
    return { matched: false };
  }

  if (pending.kind === 'ROLE_PROPOSAL') {
    const result = await resolveRole(engine, careerId, 'ACCEPT');
    if (!result.ok)
      return {
        matched: false,
        blocked: `RESOLVE_ROLE: ${result.error.code} ${result.error.message}`,
      };
    return { matched: false };
  }

  if (pending.kind === 'LOAN_RETURN') {
    const decision = pending.options[0] ?? 'RETURN';
    const result = await execute(engine, careerId, { type: 'LOAN_RETURN', payload: { decision } });
    if (!result.ok)
      return {
        matched: false,
        blocked: `LOAN_RETURN: ${result.error.code} ${result.error.message}`,
      };
    return { matched: false };
  }

  // pending.kind === 'SETTLEMENT'
  const result = await settleSeason(engine, careerId);
  if (!result.ok)
    return {
      matched: false,
      blocked: `SETTLE_SEASON: ${result.error.code} ${result.error.message}`,
    };
  return { matched: false };
}

async function assertReachability(target: Target): Promise<void> {
  const engine = await makeEngine(target.packVersion);
  const careerId = `car_phase4_reachability_${target.presentation.toLowerCase()}`;
  await createCareerWithSeed(engine, careerId, target.seed);
  await onboardToContract(engine, careerId);

  const startedSeasonsRef = { count: 0 };
  const stepBudget = (target.seasonIndex + 1) * 40;
  let matched = false;
  let blockedReason: string | null = null;
  for (let i = 0; i < stepBudget && !matched; i += 1) {
    const outcome = await stepOnceTowards(
      engine,
      careerId,
      target.eventId,
      target.seasonIndex,
      startedSeasonsRef,
    );
    matched = outcome.matched;
    if (outcome.blocked !== undefined) {
      blockedReason = outcome.blocked;
      break;
    }
  }

  expect(
    matched,
    `${target.eventId}에 도달하지 못했다(블록 사유: ${blockedReason ?? '스텝 예산 소진'})`,
  ).toBe(true);

  const load = await engine.client.loadCareer(careerId);
  if (!load.ok) throw new Error(`loadCareer 실패: ${load.error.code}`);
  const state = load.snapshot.state;
  const pending = state.pending;
  if (
    pending === null ||
    (pending.kind !== 'EVENT' && pending.kind !== 'INJURY' && pending.kind !== 'NATIONAL_TEAM')
  ) {
    throw new Error(`unreachable: pending이 EVENT 계열이 아니다(${pending?.kind ?? 'null'})`);
  }
  expect(pending.eventId).toBe(target.eventId);

  const definition = engine.pack.eventsById.get(pending.eventId);
  expect(definition?.presentation).toBe(target.presentation);

  const seasonIndex = state.season?.index ?? state.seasonHistory.length;
  expect(seasonIndex).toBe(target.seasonIndex);

  const step = pending.kind === 'EVENT' ? state.currentStep : pending.step;
  expect(step).toBe(target.step);
}

describe('T-4-009 §3: phase4-seeds.ts가 실제 engine 경로(career-actions.ts)에서도 같은 pending을 여는지', () => {
  it.each(TARGETS)(
    '$presentation ($packVersion): seed "$seed" → season $seasonIndex step $step에서 $eventId가 열린다',
    (target) => assertReachability(target),
  );

  const runSlowReachability = process.env.OFFSIDE_SLOW_TESTS === '1';
  it.skipIf(!runSlowReachability)(
    'NATIONAL_TEAM (0.3.0): seed "offside-nat-search-0" → season 20 step 8에서 EVT-NAT-001이 열린다',
    async () => assertReachability(NATIONAL_TEAM_TARGET),
    120_000,
  );
});
