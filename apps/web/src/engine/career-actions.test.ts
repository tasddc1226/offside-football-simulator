import { EFFECT_DEFAULTS, loadContentPack, loadRuleset } from '@offside/content';
import type { ServiceSeasonCurrent } from '@offside/contracts';
import { hashState, needsDevelopment } from '@offside/domain';
import {
  career01,
  career01EngineCommands,
  career05Chapter,
  career05ChapterEngineCommands,
  rulesetProto,
} from '@offside/fixtures';
import {
  encodeSnapshot,
  MemoryLocalStore,
  inlineSimulator,
  type EngineCommand,
  type ExecuteResult,
} from '@offside/engine-client';
import { describe, expect, it, vi } from 'vitest';
import {
  acceptOffer,
  advance,
  advanceToDecision,
  confirmPlayer,
  createCareer,
  deleteCareer,
  develop,
  execute,
  rejectOffer,
  resolveChapter,
  resolveEvent,
  resolveLoanReturn,
  resolveRole,
  settleSeason,
  shouldAutoAcceptUnchangedRole,
  startSeason,
  toResolveChapterOutcomes,
  toResolveEventOutcomes,
  toStartSeasonPayload,
  updateDraft,
} from './career-actions.js';
import { createAppEngine, type AppEngine } from './engine.js';
import { buildRoleDecisionPreview } from '../shared/role-decision-preview.js';
import { FALLBACK_SERVICE_SEASON, FALLBACK_SERVICE_SEASON_ID } from './versions.js';

const syncHolder = vi.hoisted(() => ({ notifyCommitted: vi.fn() }));
vi.mock('./sync.js', () => ({
  getSyncClient: () =>
    Promise.resolve({
      notifyCommitted: syncHolder.notifyCommitted,
      flush: vi.fn(),
      getState: vi.fn(),
      subscribe: vi.fn(),
      resolveConflict: vi.fn(),
      dispose: vi.fn(),
    }),
}));

// service-season.ts는 네트워크(TanStack Query)를 거친다 — 이 테스트는 시즌 id 주입 자체가 아니라
// createCareer·startSeason의 명령 조립·재생을 본다(폴백 순서는 service-season.test.ts가 본다).
const serviceSeasonHolder = vi.hoisted(() => ({
  current: undefined as undefined | ServiceSeasonCurrent,
}));
vi.mock('./service-season.js', () => ({
  resolveServiceSeason: () =>
    Promise.resolve(serviceSeasonHolder.current ?? FALLBACK_SERVICE_SEASON),
  resolveServiceSeasonId: () =>
    Promise.resolve(serviceSeasonHolder.current?.id ?? FALLBACK_SERVICE_SEASON_ID),
}));

function makeIdGenerator(prefix: string): () => string {
  let counter = 0;
  return () => `${prefix}-${counter++}`;
}

/** rulesetProto(fixtures)는 career01 fixture가 재생을 검증받은 룰셋이다. selectEligibleEvents는
 * 실제 콘텐츠 팩(EVT-CON-002 등)에서 계산해야 하므로 pack은 loadContentPack('0.1.0')을 쓴다. */
function makeTestEngine(newId = makeIdGenerator('id')): AppEngine {
  return createAppEngine({
    store: new MemoryLocalStore(),
    simulator: inlineSimulator,
    ruleset: rulesetProto,
    pack: loadContentPack('0.1.0'),
    newId,
  });
}

describe('createCareer', () => {
  it('DRAFT 상태·revision 1의 새 커리어를 만든다', async () => {
    const engine = makeTestEngine();

    const result = await createCareer(engine, { simulationMode: 'FAST' });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.domainSnapshot.revision).toBe(1);
    expect(result.domainSnapshot.state.status).toBe('DRAFT');
    expect(result.domainSnapshot.state.simulationMode).toBe('FAST');

    const listed = await engine.client.listCareers();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(result.snapshot.careerId);
    expect(listed[0]?.status).toBe('DRAFT');
  });

  it('매번 서로 다른 careerId·seed를 만든다', async () => {
    const engine = makeTestEngine();

    const first = await createCareer(engine, { simulationMode: 'FAST' });
    const second = await createCareer(engine, { simulationMode: 'FAST' });

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) throw new Error('unreachable');
    expect(first.snapshot.careerId).not.toBe(second.snapshot.careerId);
  });

  it('현재 서비스 시즌의 id·룰셋·팩을 한 묶음으로 새 커리어에 고정한다', async () => {
    serviceSeasonHolder.current = {
      ...FALLBACK_SERVICE_SEASON,
      id: 'svc_phase5_qa',
      name: 'PHASE 5 QA',
      status: 'PRESEASON',
      isTest: true,
      rulesetVersion: '1.1.0',
      contentPackVersion: '0.3.0',
      notice: 'LINE_TEST',
    };
    try {
      const engine = makeTestEngine();
      const result = await createCareer(engine, { simulationMode: 'FAST' });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('unreachable');
      expect(result.domainSnapshot.state.rulesetVersion).toBe('1.1.0');
      expect(result.domainSnapshot.state.contentPackVersion).toBe('0.3.0');
      const [record] = await engine.client.listCareers();
      expect(record?.createdServiceSeasonId).toBe('svc_phase5_qa');
    } finally {
      serviceSeasonHolder.current = undefined;
    }
  });

  it.each([
    ['지원하지 않는 버전', '9.9.9', '0.3.0'],
    ['호환되지 않는 룰셋·팩', '1.1.0', '0.1.0'],
  ])(
    '%s이면 CREATE_CAREER를 실행하기 전에 실패한다',
    async (_label, rulesetVersion, contentPackVersion) => {
      serviceSeasonHolder.current = {
        ...FALLBACK_SERVICE_SEASON,
        id: 'svc_invalid',
        rulesetVersion,
        contentPackVersion,
      };
      const engine = makeTestEngine();
      const executeSpy = vi.spyOn(engine.client, 'execute');
      try {
        await expect(createCareer(engine, { simulationMode: 'FAST' })).rejects.toThrow();
        expect(executeSpy).not.toHaveBeenCalled();
        expect(await engine.client.listCareers()).toEqual([]);
      } finally {
        serviceSeasonHolder.current = undefined;
      }
    },
  );
});

describe('updateDraft·confirmPlayer', () => {
  it('CONFIRM_PLAYER 뒤 ACTIVE로 전환되고 player.profile이 채워진다', async () => {
    const engine = makeTestEngine();
    const created = await createCareer(engine, { simulationMode: 'CHAPTER' });
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error('unreachable');
    const careerId = created.snapshot.careerId;

    await updateDraft(engine, careerId, {
      name: '김서준',
      gender: 'UNSPECIFIED',
      nationalityCode: 'KR',
      preferredFoot: 'LEFT',
    });
    const secondDraft = await updateDraft(engine, careerId, {
      position: 'W',
      archetypeId: 'inside-forward',
      backgroundId: 'club-academy',
    });
    expect(secondDraft.ok).toBe(true);

    const confirmed = await confirmPlayer(engine, careerId);
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) throw new Error('unreachable');
    expect(confirmed.domainSnapshot.state.status).toBe('ACTIVE');
    expect(confirmed.domainSnapshot.state.player.profile?.name).toBe('김서준');
  });
});

describe('advance: selectEligibleEvents 배선', () => {
  it('새 커리어용 팩이 달라도 기존 커리어의 진행·선택은 저장된 팩을 사용한다', async () => {
    const engine = makeTestEngine();
    const careerId = await replayToConfirmed(engine);
    const otherPack = loadContentPack('0.3.0');
    const switched = { ...engine, pack: { ...otherPack, events: [], eventsById: new Map() } };
    const advanced = await advance(switched, careerId);
    expect(advanced.ok).toBe(true);
    if (!advanced.ok) throw new Error('진행 실패');
    expect(advanced.domainSnapshot.state.pending?.kind).toBe('EVENT');
    const resolved = await resolveEvent(switched, careerId, 'A');
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) throw new Error('선택 실패');
    expect(resolved.domainSnapshot.state.contentPackVersion).toBe('0.1.0');
  });
  it('career01 픽스처를 CONFIRM_PLAYER까지 재생한 뒤 advance가 selectEligibleEvents 결과(EVT-CON-002 포함)를 ADVANCE payload로 보낸다', async () => {
    const engine = makeTestEngine();
    const careerId = career01.createCareer.careerId;
    const commands = career01EngineCommands(makeIdGenerator('replay'));
    const upToConfirm = commands.slice(0, 4); // CREATE_CAREER, UPDATE_PLAYER_DRAFT×2, CONFIRM_PLAYER

    for (const command of upToConfirm) {
      const result = await engine.client.execute({
        careerId,
        command,
        ...(command.type === 'CREATE_CAREER' ? { createdServiceSeasonId: 'svc_kickoff' } : {}),
      });
      if (!result.ok) {
        throw new Error(`재생 실패: ${command.type} ${result.error.code} ${result.error.message}`);
      }
    }

    // engine.client.execute를 감싸 advance()가 실제로 보내는 ADVANCE 명령의 payload를 가로챈다.
    // (도메인의 최종 가중 랜덤 선택 결과가 아니라, career-actions.advance()가 selectEligibleEvents로
    // 계산해 "보낸" 후보 목록 자체를 검증하는 것이 브리프 요구사항이다.)
    const capturedPayloads: Array<{ eligibleEvents: Array<{ eventId: string }> }> = [];
    const wrappedEngine: AppEngine = {
      ...engine,
      client: {
        ...engine.client,
        execute: (request) => {
          if (request.command.type === 'ADVANCE') {
            capturedPayloads.push(
              request.command.payload as { eligibleEvents: Array<{ eventId: string }> },
            );
          }
          return engine.client.execute(request);
        },
      },
    };

    const result = await advance(wrappedEngine, careerId);

    expect(result.ok).toBe(true);
    expect(capturedPayloads).toHaveLength(1);
    expect(
      capturedPayloads[0]?.eligibleEvents.some((event) => event.eventId === 'EVT-CON-002'),
    ).toBe(true);
  });
});

// fix-precontract-whitelist: 룰셋 1.7.2 offerRules.preContract.bridgeEventIds가 EVT-CON-020~028만
// 허용해, 진로 선택에서 "입단 테스트/하부리그"(태그 진로_입단테스트·진로_하부리그)를 고른 선수의
// EVT-CON-003(SCR-008 전용 입단 테스트 화면, career-route.ts EVENT_SCREEN_OVERRIDES)이 계약 전
// 구간에서 구조적으로 뜨지 않았다. 화이트리스트에 EVT-CON-003을 추가하는 것만으로는 부족했다 —
// 0.4.1부터 바이트 동일하게 재사용돼 온 EVT-CON-024~028(스카우트 평가 브리지)이 진로 태그
// (진로_입단테스트·진로_하부리그)와 EVT-CON-003의 exclusionTags(입단테스트_완료)를 같은 outcome에서
// 함께 addTags해, 브리지가 해소되는 즉시 EVT-CON-003이 영구히 제외됐다(0.6.5 이하·origin/main에도
// 같은 구조가 있어 재현됨 — 다만 그 버전은 바이트 불변이라 고치지 않는다). 0.6.6에서만 다섯 파일을
// 새로 갈라 입단테스트_완료 선주입을 제거했고(load-content-pack.ts가 0.6.6 전용 import로 교체),
// maxEventsBeforeFirstOffer도 2(진로 1 + 브리지 1)에서 3(진로 1 + 브리지 1 + 입단 테스트 1)으로
// 올렸다 — 2로는 브리지가 이미 상한을 채워 EVT-CON-003이 후보에 들기 전에 FIRST_CONTRACT로
// 건너뛴다(도메인 가드 자체는 코드 변경 없음, packages/domain/src/simulate.test.ts의 기존
// preContract 스위트가 그 일반 로직을 계속 지킨다).
describe('T-7-036 fix-precontract-whitelist: 1.7.2/0.6.6 입단 테스트 경로', () => {
  it('진로_입단테스트·진로_하부리그 경로(school 배경)에서 EVT-CON-003이 뜨고 해소된 뒤 첫 제안(OFFERS)이 열린다', async () => {
    serviceSeasonHolder.current = {
      ...FALLBACK_SERVICE_SEASON,
      rulesetVersion: '1.7.2',
      contentPackVersion: '0.6.6',
    };
    try {
      const engine = createAppEngine({
        store: new MemoryLocalStore(),
        simulator: inlineSimulator,
        ruleset: loadRuleset('1.7.2'),
        pack: loadContentPack('0.6.6'),
        newId: makeIdGenerator('t7036'),
      });

      const created = await createCareer(engine, { simulationMode: 'CHAPTER' });
      expect(created.ok).toBe(true);
      if (!created.ok) throw new Error('unreachable');
      const careerId = created.snapshot.careerId;

      await updateDraft(engine, careerId, {
        name: '김서준',
        gender: 'MALE',
        nationalityCode: 'KR',
        preferredFoot: 'LEFT',
      });
      const draft2 = await updateDraft(engine, careerId, {
        position: 'W',
        archetypeId: 'inside-forward',
        backgroundId: 'school',
      });
      expect(draft2.ok).toBe(true);
      const confirmed = await confirmPlayer(engine, careerId);
      expect(confirmed.ok).toBe(true);

      let sawTryout = false;
      let current = confirmed as ExecuteResult;
      for (let step = 0; step < 10; step += 1) {
        if (!current.ok)
          throw new Error(`재생 실패: ${current.error.code} ${current.error.message}`);
        const pending = current.domainSnapshot.state.pending;
        if (pending?.kind === 'OFFERS') break;
        if (pending === null) {
          current = await advance(engine, careerId);
          continue;
        }
        if (pending.kind === 'EVENT') {
          if (pending.eventId === 'EVT-CON-003') sawTryout = true;
          current = await resolveEvent(engine, careerId, 'A');
          continue;
        }
        throw new Error(`예상 밖 pending: ${pending.kind}`);
      }

      expect(sawTryout).toBe(true);
      if (!current.ok) throw new Error('unreachable');
      expect(current.domainSnapshot.state.pending?.kind).toBe('OFFERS');
      expect(current.domainSnapshot.state.tags).toContain('입단테스트_완료');
      if (current.domainSnapshot.state.pending?.kind === 'OFFERS') {
        expect(current.domainSnapshot.state.pending.offers.length).toBeGreaterThanOrEqual(1);
      }
    } finally {
      serviceSeasonHolder.current = undefined;
    }
  });
});

/** career01 픽스처를 CONFIRM_PLAYER까지 raw engine.client.execute로 재생하고 careerId를 돌려준다. */
async function replayToConfirmed(engine: AppEngine): Promise<string> {
  const careerId = career01.createCareer.careerId;
  const commands = career01EngineCommands(makeIdGenerator('replay'));
  for (const command of commands.slice(0, 4)) {
    const result = await engine.client.execute({
      careerId,
      command,
      ...(command.type === 'CREATE_CAREER' ? { createdServiceSeasonId: 'svc_kickoff' } : {}),
    });
    if (!result.ok)
      throw new Error(`재생 실패: ${command.type} ${result.error.code} ${result.error.message}`);
  }
  return careerId;
}

/** career01 픽스처를 계약 체결까지(pending null, season null) 재생한다. */
async function replayToSigned(engine: AppEngine): Promise<string> {
  const careerId = await replayToConfirmed(engine);
  await advance(engine, careerId);
  await resolveEvent(engine, careerId, 'A');
  await advance(engine, careerId);
  await resolveEvent(engine, careerId, 'B');
  const offered = await advance(engine, careerId);
  if (!offered.ok || offered.domainSnapshot.state.pending?.kind !== 'OFFERS') {
    throw new Error('제안 단계에 도달하지 못했다');
  }
  const offerId = offered.domainSnapshot.state.pending.offers[0]!.id;
  const accepted = await acceptOffer(engine, careerId, offerId);
  if (!accepted.ok || accepted.domainSnapshot.state.pending !== null) {
    throw new Error('계약 뒤 pending이 null이어야 한다');
  }
  return careerId;
}

describe('toStartSeasonPayload', () => {
  it('simulationMode·주어진 serviceSeasonId를 담은 START_SEASON 명령을 만든다', () => {
    const command = toStartSeasonPayload({ simulationMode: 'FAST' }, FALLBACK_SERVICE_SEASON_ID);
    expect(command).toEqual({
      type: 'START_SEASON',
      payload: {
        simulationMode: 'FAST',
        serviceSeasonId: FALLBACK_SERVICE_SEASON_ID,
        legacyLedger: true,
      },
    });
  });

  it('trainingFocus를 고르면 payload에 함께 싣는다(T-2-005 접점, PR #40 머지 확인)', () => {
    const command = toStartSeasonPayload(
      { simulationMode: 'CHAPTER', trainingFocus: 'TECHNICAL' },
      FALLBACK_SERVICE_SEASON_ID,
    );
    expect(command).toEqual({
      type: 'START_SEASON',
      payload: {
        simulationMode: 'CHAPTER',
        serviceSeasonId: FALLBACK_SERVICE_SEASON_ID,
        trainingFocus: 'TECHNICAL',
        legacyLedger: true,
      },
    });
  });
});

describe('startSeason', () => {
  it('SEASON_STARTED 타임라인 항목을 남기고 step 1 ROLE_PROPOSAL pending을 연다(RULE-TIME-002)', async () => {
    const engine = makeTestEngine();
    const careerId = await replayToSigned(engine);

    const result = await startSeason(engine, careerId, { simulationMode: 'FAST' });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.domainSnapshot.state.season?.index).toBe(1);
    expect(result.domainSnapshot.state.season?.simulationMode).toBe('FAST');
    expect(result.domainSnapshot.state.pending?.kind).toBe('ROLE_PROPOSAL');
    expect(result.domainSnapshot.state.timeline.at(-1)).toMatchObject({ kind: 'SEASON_STARTED' });
  });

  it('기존 1.0/0.1 커리어는 현재 시즌 참여 id만 기록하고 커리어 버전은 바꾸지 않는다', async () => {
    const engine = makeTestEngine();
    const careerId = await replayToSigned(engine);
    serviceSeasonHolder.current = {
      ...FALLBACK_SERVICE_SEASON,
      id: 'svc_phase5_qa',
      rulesetVersion: '1.1.0',
      contentPackVersion: '0.3.0',
    };
    try {
      const result = await startSeason(engine, careerId, { simulationMode: 'FAST' });
      if (!result.ok) throw new Error('startSeason 실패');
      expect(result.domainSnapshot.state).toMatchObject({
        rulesetVersion: '1.0.0',
        contentPackVersion: '0.1.0',
        season: { serviceSeasonId: 'svc_phase5_qa' },
      });
      expect(result.domainSnapshot.state.seasonHistory).toEqual([]);
      const [record] = await engine.client.listCareers();
      expect(record).toMatchObject({
        createdServiceSeasonId: 'svc_kickoff',
        rulesetVersion: '1.0.0',
        contentPackVersion: '0.1.0',
      });
    } finally {
      serviceSeasonHolder.current = undefined;
    }
  });

  it('실제 포지션·역할과 같은 KEEP만 자동 확인 대상으로 본다', async () => {
    const engine = makeTestEngine();
    const careerId = await replayToSigned(engine);
    const result = await startSeason(engine, careerId, { simulationMode: 'FAST' });
    if (!result.ok) throw new Error('startSeason 실패');

    const profile = result.domainSnapshot.state.player.profile;
    const season = result.domainSnapshot.state.season;
    if (profile === null || season === null) throw new Error('시즌 상태 필요');
    const unchanged = {
      ...result.domainSnapshot.state,
      pending: {
        kind: 'ROLE_PROPOSAL' as const,
        step: 1,
        proposal: {
          type: 'KEEP' as const,
          position: profile.primaryPosition,
          squadRole: season.squadRole,
        },
      },
    };
    expect(shouldAutoAcceptUnchangedRole(unchanged)).toBe(true);
    expect(
      shouldAutoAcceptUnchangedRole({
        ...unchanged,
        pending: {
          ...unchanged.pending,
          proposal: {
            ...unchanged.pending.proposal,
            position: profile.primaryPosition === 'GK' ? 'ST' : 'GK',
          },
        },
      }),
    ).toBe(false);
  });
});

describe('resolveRole', () => {
  it('ACCEPT는 ROLE_RESOLVED 타임라인 항목을 남기고 pending을 닫는다', async () => {
    const engine = makeTestEngine();
    const careerId = await replayToSigned(engine);
    const started = await startSeason(engine, careerId, { simulationMode: 'FAST' });
    if (!started.ok) throw new Error('startSeason 실패');

    const result = await resolveRole(engine, careerId, 'ACCEPT');

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.domainSnapshot.state.pending).toBeNull();
    expect(result.domainSnapshot.state.season).not.toBeNull();
    expect(result.domainSnapshot.state.timeline.at(-1)).toMatchObject({ kind: 'ROLE_RESOLVED' });
  });
});

describe('settleSeason', () => {
  it('SETTLEMENT pending을 닫고 season을 null로 되돌린다(다음 시즌 시작 준비)', async () => {
    const engine = makeTestEngine();
    const careerId = await replayToSigned(engine);
    const started = await startSeason(engine, careerId, { simulationMode: 'FAST' });
    if (!started.ok) throw new Error('startSeason 실패');
    const roleResolved = await resolveRole(engine, careerId, 'ACCEPT');
    if (!roleResolved.ok) throw new Error('resolveRole 실패');

    // FAST 모드는 CONTRACT 같은 자동 통과 슬롯만 advance로 흘려보내면 SETTLEMENT까지 곧장
    // 도달한다. CHAPTER는 자동 통과 대상이 아니라서(T-2-004 D-38) advance에 chapterCandidates가
    // 실리면(T-2-008) FAST 모드에서도 MAJOR 챕터(예: 데뷔전)가 실제로 열린다 — 첫 옵션으로 확정해
    // 넘긴다. 안전 상한 20회.
    let current = roleResolved;
    for (
      let step = 0;
      step < 20 && current.domainSnapshot.state.pending?.kind !== 'SETTLEMENT';
      step += 1
    ) {
      const pending = current.domainSnapshot.state.pending;
      if (pending?.kind === 'CHAPTER') {
        const definition = engine.pack.chaptersById.get(pending.chapterId);
        if (!definition) throw new Error(`팩에 챕터 정의가 없다: ${pending.chapterId}`);
        const decision = definition.decisions[pending.resolved.length];
        if (!decision) throw new Error('이미 모든 판단이 끝났다');
        const resolved = await resolveChapter(
          engine,
          careerId,
          decision.id,
          decision.options[0]!.id,
        );
        if (!resolved.ok) throw new Error(`resolveChapter 실패: ${resolved.error.message}`);
        current = resolved;
        continue;
      }
      const advanced = await advance(engine, careerId);
      if (!advanced.ok) throw new Error(`advance 실패: ${advanced.error.message}`);
      current = advanced;
    }
    expect(current.domainSnapshot.state.pending?.kind).toBe('SETTLEMENT');

    const result = await settleSeason(engine, careerId);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.domainSnapshot.state.season).toBeNull();
    expect(result.domainSnapshot.state.pending).toBeNull();
    expect(result.domainSnapshot.state.seasonHistory).toHaveLength(1);
    expect(result.domainSnapshot.state.timeline).toContainEqual(
      expect.objectContaining({ kind: 'SEASON_SETTLED' }),
    );
  });
});

describe('toResolveEventOutcomes', () => {
  it('EVT-CON-002 B의 DEFERRED effect가 EFFECT_DEFAULTS로 채워진 완전한 Effect 필드를 갖는다', () => {
    const pack = loadContentPack('0.1.0');
    const definition = pack.eventsById.get('EVT-CON-002')!;
    const choiceB = definition.choices.find((choice) => choice.id === 'B')!;

    const outcomes = toResolveEventOutcomes(choiceB.outcomes);
    const effect = outcomes[0]!.effects[0]!;

    expect(effect).toMatchObject({
      kind: 'DEFERRED',
      target: 'tacticalFit',
      delta: 6,
      clamp: EFFECT_DEFAULTS.DEFERRED.clamp,
      appliesAt: { kind: 'NEXT_SEASON_STEP', step: 1 },
      expiresAt: EFFECT_DEFAULTS.DEFERRED.expiresAt,
      stackingRule: EFFECT_DEFAULTS.DEFERRED.stackingRule,
    });
  });

  it('addTags·removeTags가 없는 outcome은 그 필드를 payload에 넣지 않는다', () => {
    const pack = loadContentPack('0.1.0');
    const definition = pack.eventsById.get('EVT-CON-003')!;
    const choiceA = definition.choices.find((choice) => choice.id === 'A')!;
    const neutralOutcome = choiceA.outcomes.find((outcome) => outcome.id === 'A2')!;
    expect(neutralOutcome.removeTags).toBeUndefined();

    const [outcome] = toResolveEventOutcomes([neutralOutcome]);

    expect(outcome).not.toHaveProperty('removeTags');
    expect(outcome?.addTags).toEqual(['입단테스트_완료', '테스트_보통']);
  });
});

describe('resolveEvent', () => {
  it('정의에 없는 choiceId는 커밋 없이 VALIDATION_FAILED다', async () => {
    const engine = makeTestEngine();
    const careerId = await replayToConfirmed(engine);
    await advance(engine, careerId);

    const result = await resolveEvent(engine, careerId, 'Z');

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.error.code).toBe('VALIDATION_FAILED');
  });

  it('INJURY pending은 generic event action에서 rehabPlan을 함께 보내고 커밋한다', async () => {
    const engine = makeTestEngine();
    const careerId = await replayToConfirmed(engine);
    const loaded = await engine.client.loadCareer(careerId);
    if (!loaded.ok) throw new Error('loadCareer 실패');

    const episode = {
      id: 'INJ-web-action',
      severity: 'MODERATE' as const,
      bodyPart: 'KNEE' as const,
      occurredAt: { seasonIndex: 0, step: 1, matchId: 'm-injury' },
      diagnosisRange: { minMatches: 3, maxMatches: 6 },
      rehab: null,
      recurrenceRiskBp: 3000,
      recurrenceChecksRemaining: 0,
      status: 'ACTIVE' as const,
      permanentDelta: null,
      remainingMatches: 3,
    };
    const state = {
      ...loaded.snapshot.state,
      health: { episodes: [episode] },
      pending: {
        kind: 'INJURY' as const,
        step: 1,
        episodeId: episode.id,
        eventId: 'EVT-INJ-001',
        version: 1,
      },
    };
    const pendingSnapshot = { ...loaded.snapshot, state, stateHash: hashState(state) };
    let capturedCommand: Parameters<AppEngine['client']['execute']>[0]['command'] | null = null;
    const wrappedEngine: AppEngine = {
      ...engine,
      client: {
        ...engine.client,
        loadCareer: async () => ({ ...loaded, snapshot: pendingSnapshot }),
        execute: async (request) => {
          capturedCommand = request.command;
          return {
            ok: true,
            snapshot: encodeSnapshot(pendingSnapshot, {
              careerId,
              createdAt: '2026-09-05T00:00:00.000Z',
            }),
            domainSnapshot: pendingSnapshot,
            nextAction: 'ADVANCE',
            appliedEffects: [],
            replayed: false,
          };
        },
      },
    };

    const result = await resolveEvent(wrappedEngine, careerId, 'A');

    expect(result.ok).toBe(true);
    expect(capturedCommand).toMatchObject({
      type: 'RESOLVE_EVENT',
      payload: {
        eventId: 'EVT-INJ-001',
        definitionVersion: 1,
        choiceId: 'A',
        rehabPlan: 'STANDARD',
      },
    });
  });

  it('일반 EVENT pending으로 INJURY presentation 이벤트를 우회 해소할 수 없다', async () => {
    const engine = makeTestEngine();
    const careerId = await replayToConfirmed(engine);
    const loaded = await engine.client.loadCareer(careerId);
    if (!loaded.ok) throw new Error('loadCareer 실패');
    const state = {
      ...loaded.snapshot.state,
      pending: { kind: 'EVENT' as const, eventId: 'EVT-INJ-001', version: 1 },
    };
    const pendingSnapshot = { ...loaded.snapshot, state, stateHash: hashState(state) };
    const execute = vi.fn();
    const wrappedEngine: AppEngine = {
      ...engine,
      client: {
        ...engine.client,
        loadCareer: async () => ({ ...loaded, snapshot: pendingSnapshot }),
        execute,
      },
    };

    const result = await resolveEvent(wrappedEngine, careerId, 'A');

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.error.code).toBe('VALIDATION_FAILED');
    expect(execute).not.toHaveBeenCalled();
  });
});

describe('acceptOffer', () => {
  it('제안 수락 후 checkpoint가 CONTRACT_CONFIRMED고 contract가 채워진다', async () => {
    const engine = makeTestEngine();
    const careerId = await replayToConfirmed(engine);
    await advance(engine, careerId);
    await resolveEvent(engine, careerId, 'A');
    await advance(engine, careerId);
    await resolveEvent(engine, careerId, 'B');
    const offered = await advance(engine, careerId);
    if (!offered.ok || offered.domainSnapshot.state.pending?.kind !== 'OFFERS') {
      throw new Error('제안 단계에 도달하지 못했다');
    }
    const offerId = offered.domainSnapshot.state.pending.offers[0]!.id;

    const result = await acceptOffer(engine, careerId, offerId);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.domainSnapshot.checkpoint).toBe('CONTRACT_CONFIRMED');
    expect(result.domainSnapshot.state.contract?.offerId).toBe(offerId);
    expect(result.domainSnapshot.state.pending).toBeNull();
  });
});

describe('결정론: 픽스처 재생 vs 액션 경로', () => {
  it('career01 명령을 raw로 재생한 stateHash와 resolveEvent·acceptOffer로 같은 선택을 밟은 stateHash가 같다', async () => {
    // advance()는 selectEligibleEvents(pack, state)로 "지금 제시 가능한" 이벤트를 실시간 계산해
    // 보낸다(career-actions.ts). career01.json의 ADVANCE payload는 골든 경로를 고정하려고 미리
    // 박아둔 후보 목록이라 실제 계산 결과와 다를 수 있다(예: FAST 모드 CONFIRM_PLAYER 직후
    // currentStep이 이미 12라 EVT-REL-001도 같이 eligible해진다 — advance()는 정상 동작이고,
    // 픽스처가 그 시점 후보군을 그대로 반영하진 않는다는 뜻이다. PR 본문에 범위 밖 발견으로 남긴다).
    // 그래서 ADVANCE 단계는 픽스처의 raw 명령(고정 eligibleEvents)을 그대로 재생하고, 이 브리프가
    // 새로 만드는 resolveEvent·acceptOffer만 액션 경로로 검증한다.
    const fixtureEngine = makeTestEngine();
    const careerId = career01.createCareer.careerId;
    const fixtureCommands = career01EngineCommands(makeIdGenerator('fixture'));
    let fixtureFinalHash: string | null = null;
    for (const command of fixtureCommands) {
      const result = await fixtureEngine.client.execute({
        careerId,
        command,
        ...(command.type === 'CREATE_CAREER' ? { createdServiceSeasonId: 'svc_kickoff' } : {}),
      });
      if (!result.ok)
        throw new Error(
          `fixture 재생 실패: ${command.type} ${result.error.code} ${result.error.message}`,
        );
      fixtureFinalHash = result.domainSnapshot.stateHash;
    }
    expect(fixtureFinalHash).toBe(career01.golden.stateHash);

    const actionEngine = makeTestEngine();
    const actionCommands = career01EngineCommands(makeIdGenerator('action'));
    const [firstAdvance, secondAdvance, thirdAdvance] = [
      actionCommands[4]!,
      actionCommands[6]!,
      actionCommands[8]!,
    ];

    await replayToConfirmed(actionEngine);
    const advanced1 = await actionEngine.client.execute({ careerId, command: firstAdvance });
    if (!advanced1.ok)
      throw new Error(`ADVANCE#1 실패: ${advanced1.error.code} ${advanced1.error.message}`);
    await resolveEvent(actionEngine, careerId, 'A');
    const advanced2 = await actionEngine.client.execute({ careerId, command: secondAdvance });
    if (!advanced2.ok)
      throw new Error(`ADVANCE#2 실패: ${advanced2.error.code} ${advanced2.error.message}`);
    await resolveEvent(actionEngine, careerId, 'B');
    const offered = await actionEngine.client.execute({ careerId, command: thirdAdvance });
    if (!offered.ok || offered.domainSnapshot.state.pending?.kind !== 'OFFERS') {
      throw new Error('제안 단계에 도달하지 못했다');
    }
    const offerId = offered.domainSnapshot.state.pending.offers[0]!.id;
    expect(offerId).toBe('OFR-9-0');
    const finalResult = await acceptOffer(actionEngine, careerId, offerId);

    expect(finalResult.ok).toBe(true);
    if (!finalResult.ok) throw new Error('unreachable');
    expect(finalResult.domainSnapshot.stateHash).toBe(fixtureFinalHash);
  });
});

describe('toResolveChapterOutcomes', () => {
  it('CHP-MATCH-001 D1.ROLE의 outcome을 ratingDeltaTenths·effects·addTags를 실은 payload로 좁힌다', () => {
    const pack = loadContentPack('0.1.0');
    const definition = pack.chaptersById.get('CHP-MATCH-001')!;
    const roleOption = definition.decisions[0]!.options.find((option) => option.id === 'ROLE')!;

    const outcomes = toResolveChapterOutcomes(roleOption.outcomes);

    expect(outcomes).toEqual([
      {
        id: 'ROLE-SUCCESS',
        kind: 'SUCCESS',
        weight: 50,
        effects: roleOption.outcomes[0]!.effects,
        ratingDeltaTenths: 6,
        addTags: ['프로_데뷔'],
      },
      {
        id: 'ROLE-FAIL',
        kind: 'FAIL',
        weight: 50,
        effects: roleOption.outcomes[1]!.effects,
        ratingDeltaTenths: -4,
        addTags: ['프로_데뷔'],
      },
    ]);
  });

  it('removeTags가 없는 outcome은 그 필드를 payload에 넣지 않는다', () => {
    const pack = loadContentPack('0.1.0');
    const definition = pack.chaptersById.get('CHP-MATCH-001')!;
    const safeOption = definition.decisions[0]!.options.find((option) => option.id === 'SAFE')!;
    expect(safeOption.outcomes[0]!.removeTags).toBeUndefined();

    const [outcome] = toResolveChapterOutcomes([safeOption.outcomes[0]!]);

    expect(outcome).not.toHaveProperty('removeTags');
  });
});

describe('resolveChapter', () => {
  it('pending CHAPTER가 없으면 커밋 없이 VALIDATION_FAILED다', async () => {
    const engine = makeTestEngine();
    const careerId = await replayToSigned(engine);

    const result = await resolveChapter(engine, careerId, 'D1', 'SAFE');

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.error.code).toBe('VALIDATION_FAILED');
  });

  /** replayToSigned 뒤 CHAPTER 모드로 시즌을 시작해 역할을 수락하고, EVENT는 첫 선택지로 흘려보내며
   * pending이 CHAPTER(CHP-MATCH-001 데뷔전)가 될 때까지 advance를 반복한다(안전 상한 15회). */
  async function reachDebutChapter(engine: AppEngine): Promise<string> {
    const careerId = await replayToSigned(engine);
    const started = await startSeason(engine, careerId, { simulationMode: 'CHAPTER' });
    if (!started.ok) throw new Error(`startSeason 실패: ${started.error.message}`);
    const roleResolved = await resolveRole(engine, careerId, 'ACCEPT');
    if (!roleResolved.ok) throw new Error(`resolveRole 실패: ${roleResolved.error.message}`);

    let current = roleResolved;
    for (let step = 0; step < 15; step += 1) {
      const pending = current.domainSnapshot.state.pending;
      if (pending?.kind === 'CHAPTER') return careerId;
      if (pending?.kind === 'EVENT') {
        const definition = engine.pack.eventsById.get(pending.eventId);
        const choiceId = definition?.choices[0]?.id;
        if (!choiceId) throw new Error(`이벤트에 선택지가 없다: ${pending.eventId}`);
        const resolved = await resolveEvent(engine, careerId, choiceId);
        if (!resolved.ok) throw new Error(`resolveEvent 실패: ${resolved.error.message}`);
        current = resolved;
        continue;
      }
      const advanced = await advance(engine, careerId);
      if (!advanced.ok) throw new Error(`advance 실패: ${advanced.error.message}`);
      current = advanced;
    }
    throw new Error('데뷔전 챕터에 도달하지 못했다(최대 15회 시도)');
  }

  it('정의에 없는 decisionId·optionId는 커밋 없이 VALIDATION_FAILED다', async () => {
    const engine = makeTestEngine();
    const careerId = await reachDebutChapter(engine);

    const badDecision = await resolveChapter(engine, careerId, 'NOT-A-DECISION', 'SAFE');
    expect(badDecision.ok).toBe(false);
    if (badDecision.ok) throw new Error('unreachable');
    expect(badDecision.error.code).toBe('VALIDATION_FAILED');

    const badOption = await resolveChapter(engine, careerId, 'D1', 'NOT-AN-OPTION');
    expect(badOption.ok).toBe(false);
    if (badOption.ok) throw new Error('unreachable');
    expect(badOption.error.code).toBe('VALIDATION_FAILED');
  });

  it('CHP-MATCH-001의 유일한 판단(D1)을 확정하면 pending이 닫히고(nextAction ADVANCE) CHAPTER_RESOLVED가 남는다', async () => {
    const engine = makeTestEngine();
    const careerId = await reachDebutChapter(engine);

    const result = await resolveChapter(engine, careerId, 'D1', 'SAFE');

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.nextAction).toBe('ADVANCE');
    expect(result.domainSnapshot.state.pending).toBeNull();
    expect(result.domainSnapshot.state.timeline.at(-1)).toMatchObject({ kind: 'CHAPTER_RESOLVED' });
    expect(result.domainSnapshot.state.season?.chapters.at(-1)?.chapterId).toBe('CHP-MATCH-001');
  });

  it(
    '결정론(실제 팩 자기 일관성): raw execute로 만든 RESOLVE_CHAPTER 명령과 resolveChapter() 액션이 같은 stateHash를 만든다. ' +
      'career-05-chapter 골든 픽스처는 이 팩의 실제 형태(D1 판단 1개, 옵션 SAFE/ROLE/BOLD)와 다른 합성 시나리오(판단 D1·D2, 옵션 OPT-CONFIDENT/OPT-SIMPLE)라 ' +
      '이 액션 경로로는 그 골든을 재현할 수 없다(PR 본문 "범위 밖 발견 사항" 참고) — 대신 실제 팩으로 raw 경로와 액션 경로가 서로 일치하는지만 본다.',
    async () => {
      const rawEngine = makeTestEngine();
      const rawCareerId = await reachDebutChapter(rawEngine);
      const rawLoad = await rawEngine.client.loadCareer(rawCareerId);
      if (!rawLoad.ok) throw new Error('loadCareer 실패');
      const rawPending = rawLoad.snapshot.state.pending;
      if (rawPending === null || rawPending.kind !== 'CHAPTER')
        throw new Error('CHAPTER pending이 아니다');
      expect(rawPending.chapterId).toBe('CHP-MATCH-001');

      const definition = rawEngine.pack.chaptersById.get('CHP-MATCH-001')!;
      const decision = definition.decisions[0]!;
      const option = decision.options.find((candidate) => candidate.id === 'SAFE')!;

      const rawResult = await rawEngine.client.execute({
        careerId: rawCareerId,
        command: {
          type: 'RESOLVE_CHAPTER',
          commandId: 'raw-resolve-chapter',
          expectedRevision: rawLoad.snapshot.revision,
          payload: {
            chapterId: definition.id,
            definitionVersion: definition.version,
            decisionId: decision.id,
            optionId: option.id,
            outcomes: toResolveChapterOutcomes(option.outcomes),
          },
        },
      });
      if (!rawResult.ok) throw new Error(`raw RESOLVE_CHAPTER 실패: ${rawResult.error.message}`);

      const actionEngine = makeTestEngine();
      const actionCareerId = await reachDebutChapter(actionEngine);
      const actionResult = await resolveChapter(
        actionEngine,
        actionCareerId,
        decision.id,
        option.id,
      );
      if (!actionResult.ok) throw new Error(`resolveChapter 실패: ${actionResult.error.message}`);

      expect(actionResult.domainSnapshot.stateHash).toBe(rawResult.domainSnapshot.stateHash);
    },
  );
});

describe('결정론: career-05-chapter 픽스처 raw 재생(합성 시나리오, 액션 경로와는 무관)', () => {
  it('career01 뒤에 이어 붙인 career-05-chapter 명령을 raw로 재생하면 pending 골든(D1 확정 직후)과 최종 골든(SETTLE_SEASON 이후) stateHash를 모두 맞춘다', async () => {
    const engine = makeTestEngine();
    const newId = makeIdGenerator('chapter-fixture');
    const careerId = career01.createCareer.careerId;

    for (const command of career01EngineCommands(newId)) {
      const result = await engine.client.execute({
        careerId,
        command,
        ...(command.type === 'CREATE_CAREER' ? { createdServiceSeasonId: 'svc_kickoff' } : {}),
      });
      if (!result.ok)
        throw new Error(
          `career01 재생 실패: ${command.type} ${result.error.code} ${result.error.message}`,
        );
    }

    const chapterCommands = career05ChapterEngineCommands(newId, career01.golden.revision);
    // START_SEASON · RESOLVE_ROLE · ADVANCE · RESOLVE_CHAPTER(D1) — D1 확정 직후 pending 골든과 대조한다.
    const pendingCommands = chapterCommands.slice(0, 4);
    let lastResult: ExecuteResult | null = null;
    for (const command of pendingCommands) {
      const result = await engine.client.execute({ careerId, command });
      if (!result.ok)
        throw new Error(
          `career-05-chapter 재생 실패: ${command.type} ${result.error.code} ${result.error.message}`,
        );
      lastResult = result;
    }
    if (lastResult === null || !lastResult.ok) throw new Error('unreachable');
    expect(lastResult.domainSnapshot.stateHash).toBe(career05Chapter.pendingGolden.stateHash);
    expect(lastResult.domainSnapshot.state.pending).toEqual(career05Chapter.pendingGolden.pending);

    const remainingCommands = chapterCommands.slice(pendingCommands.length);
    let finalResult: ExecuteResult | null = null;
    for (const command of remainingCommands) {
      const result = await engine.client.execute({ careerId, command });
      if (!result.ok)
        throw new Error(
          `career-05-chapter 재생 실패: ${command.type} ${result.error.code} ${result.error.message}`,
        );
      finalResult = result;
    }
    if (finalResult === null || !finalResult.ok) throw new Error('unreachable');

    expect(finalResult.domainSnapshot.stateHash).toBe(career05Chapter.golden.stateHash);
  });
});

type Issue242VersionPair = { rulesetVersion: string; contentPackVersion: string };
type Issue242SeasonRecord = {
  season: number;
  matchesWithMinutes: number;
  minutes: number;
  ratedMatches: number;
  rolePromise: string | null;
  primaryPosition: string | null;
  marketReason: string | null;
};
type Issue242DecisionRecord = {
  decision: 'ACCEPT' | 'DECLINE';
  preview: {
    primaryPosition: string;
    contractRole: string;
    appearancePromiseMinutesShareBp: number;
    managerTrustDelta: number;
    managerTrustAfter: number;
  };
  actual: {
    primaryPosition: string | null;
    contractRole: string | null;
    appearancePromiseMinutesShareBp: number | null;
    managerTrustDelta: number;
    managerTrustAfter: number;
  };
};

const ISSUE_242_LEGACY_PAIR: Issue242VersionPair = {
  rulesetVersion: '1.7.2',
  contentPackVersion: '0.6.6',
};
const ISSUE_242_BALANCED_PAIR: Issue242VersionPair = {
  rulesetVersion: '1.7.3',
  contentPackVersion: '0.6.7',
};
const ISSUE_242_SEED = 'issue-242-mf-1';

function makeIssue242Engine(seedIndex: number, versions: Issue242VersionPair): AppEngine {
  return createAppEngine({
    store: new MemoryLocalStore(),
    simulator: inlineSimulator,
    ruleset: loadRuleset(versions.rulesetVersion),
    pack: loadContentPack(versions.contentPackVersion),
    newId: makeIdGenerator(`issue-242-${seedIndex}`),
  });
}

async function createIssue242Career(
  engine: AppEngine,
  careerId: string,
  versions: Issue242VersionPair,
): Promise<void> {
  const command: EngineCommand = {
    type: 'CREATE_CAREER',
    commandId: engine.newId(),
    expectedRevision: 0,
    payload: {
      careerId,
      seed: ISSUE_242_SEED,
      simulationMode: 'FAST',
      rulesetVersion: versions.rulesetVersion,
      contentPackVersion: versions.contentPackVersion,
    },
  };
  const result = await engine.client.execute({
    careerId,
    command,
    createdServiceSeasonId: FALLBACK_SERVICE_SEASON_ID,
  });
  if (!result.ok) throw new Error(`CREATE_CAREER: ${result.error.code} ${result.error.message}`);
}

async function reachIssue242FirstOffer(
  engine: AppEngine,
  careerId: string,
  trace: string[],
): Promise<void> {
  await updateDraft(engine, careerId, {
    name: '김민준',
    gender: 'MALE',
    nationalityCode: 'KR',
    preferredFoot: 'RIGHT',
  });
  await updateDraft(engine, careerId, {
    position: 'CM',
    archetypeId: 'cm-playmaker',
    backgroundId: 'club-academy',
  });
  const confirmed = await confirmPlayer(engine, careerId);
  if (!confirmed.ok) throw new Error(`CONFIRM_PLAYER: ${confirmed.error.code}`);

  for (let guard = 0; guard < 10; guard += 1) {
    const loaded = await engine.client.loadCareer(careerId);
    if (!loaded.ok) throw new Error(`loadCareer: ${loaded.error.code}`);
    const pending = loaded.snapshot.state.pending;
    if (pending?.kind === 'OFFERS') return;
    if (pending === null) {
      const progressed = await advance(engine, careerId);
      if (!progressed.ok) throw new Error(`ADVANCE: ${progressed.error.code}`);
      continue;
    }
    if (pending.kind === 'EVENT') {
      const choice = engine.pack.eventsById.get(pending.eventId)?.choices[0];
      if (choice === undefined) throw new Error(`EVENT choice missing: ${pending.eventId}`);
      trace.push(`EVENT:${pending.eventId}:${choice.id}`);
      const resolved = await resolveEvent(engine, careerId, choice.id);
      if (!resolved.ok) throw new Error(`RESOLVE_EVENT: ${resolved.error.code}`);
      continue;
    }
    throw new Error(`Unexpected onboarding pending: ${pending.kind}`);
  }
  throw new Error('First offer was not reached');
}

async function prepareIssue242Scenario(
  suffix: string,
  trace: string[],
  versions: Issue242VersionPair,
): Promise<{ engine: AppEngine; careerId: string }> {
  const engine = makeIssue242Engine(suffix.includes('accept') ? 1 : 2, versions);
  const careerId = `car-issue-242-${versions.rulesetVersion}-${suffix}`;
  await createIssue242Career(engine, careerId, versions);
  trace.push('DRAFT:CM:cm-playmaker:club-academy');
  await reachIssue242FirstOffer(engine, careerId, trace);
  const loaded = await engine.client.loadCareer(careerId);
  if (!loaded.ok) throw new Error(`load offers: ${loaded.error.code}`);
  const pending = loaded.snapshot.state.pending;
  if (pending?.kind !== 'OFFERS') throw new Error('OFFERS missing');
  const rotationOffer = pending.offers.find((offer) => offer.rolePromise === 'ROTATION');
  if (rotationOffer === undefined) throw new Error('ROTATION offer missing');
  trace.push(`ACCEPT_OFFER:${rotationOffer.id}:${rotationOffer.teamId}:ROTATION`);
  const accepted = await acceptOffer(engine, careerId, rotationOffer.id);
  if (!accepted.ok) throw new Error(`ACCEPT_OFFER: ${accepted.error.code}`);
  return { engine, careerId };
}

async function startIssue242Season(
  engine: AppEngine,
  careerId: string,
  trace: string[],
): Promise<void> {
  const loaded = await engine.client.loadCareer(careerId);
  if (!loaded.ok) throw new Error(`load before START_SEASON: ${loaded.error.code}`);
  const pending = loaded.snapshot.state.pending;
  if (pending?.kind === 'OFFERS') {
    const safeOffer = pending.offers.find((offer) => offer.id === pending.market.safeOfferId);
    if (safeOffer === undefined) throw new Error('safe stay offer missing');
    trace.push(`SAFE_STAY:${safeOffer.id}:${safeOffer.rolePromise}`);
    const stayed = await acceptOffer(engine, careerId, safeOffer.id);
    if (!stayed.ok) throw new Error(`safe stay: ${stayed.error.code}`);
  } else if (pending !== null) {
    throw new Error(`unexpected preseason pending: ${pending.kind}`);
  }
  trace.push('START_SEASON:FAST:ROLE');
  const started = await execute(engine, careerId, {
    type: 'START_SEASON',
    payload: {
      simulationMode: 'FAST',
      serviceSeasonId: FALLBACK_SERVICE_SEASON_ID,
      trainingFocus: 'ROLE',
    },
  });
  if (!started.ok) throw new Error(`START_SEASON: ${started.error.code}`);
}

async function playIssue242Season(
  engine: AppEngine,
  careerId: string,
  proposalDecision: 'ACCEPT' | 'DECLINE',
  trace: string[],
  decisions: Issue242DecisionRecord[],
): Promise<Issue242SeasonRecord> {
  for (let guard = 0; guard < 80; guard += 1) {
    const loaded = await engine.client.loadCareer(careerId);
    if (!loaded.ok) throw new Error(`load season: ${loaded.error.code}`);
    const pending = loaded.snapshot.state.pending;
    if (pending === null) {
      const progressed = await advance(engine, careerId);
      if (!progressed.ok) throw new Error(`ADVANCE season: ${progressed.error.code}`);
      continue;
    }
    if (pending.kind === 'ROLE_PROPOSAL') {
      const proposal = pending.proposal;
      const decision = proposal.type === 'KEEP' ? 'ACCEPT' : proposalDecision;
      const detail =
        proposal.type === 'ROLE_CHANGE'
          ? `${proposal.from}->${proposal.to}`
          : proposal.type === 'POSITION_CHANGE'
            ? `${proposal.from}->${proposal.to}:${proposal.squadRoleAfter}`
            : 'KEEP';
      trace.push(`ROLE:${proposal.type}:${detail}:${decision}`);
      const preview = buildRoleDecisionPreview(loaded.snapshot.state, engine.ruleset, proposal);
      const selectedPreview = decision === 'ACCEPT' ? preview.accept : preview.decline;
      const trustBefore = loaded.snapshot.state.relationships.managerTrust;
      const resolved = await resolveRole(engine, careerId, decision);
      if (!resolved.ok) throw new Error(`RESOLVE_ROLE: ${resolved.error.code}`);
      const resolvedState = resolved.domainSnapshot.state;
      decisions.push({
        decision,
        preview: {
          primaryPosition: selectedPreview.primaryPosition,
          contractRole: selectedPreview.contractRole,
          appearancePromiseMinutesShareBp: selectedPreview.appearancePromiseMinutesShareBp,
          managerTrustDelta: selectedPreview.managerTrustDelta,
          managerTrustAfter: selectedPreview.managerTrustAfter,
        },
        actual: {
          primaryPosition: resolvedState.player.profile?.primaryPosition ?? null,
          contractRole: resolvedState.contract?.rolePromise ?? null,
          appearancePromiseMinutesShareBp:
            resolvedState.contract?.appearancePromise.minutesShareBp ?? null,
          managerTrustDelta: resolvedState.relationships.managerTrust - trustBefore,
          managerTrustAfter: resolvedState.relationships.managerTrust,
        },
      });
      continue;
    }
    if (pending.kind === 'EVENT' || pending.kind === 'INJURY' || pending.kind === 'NATIONAL_TEAM') {
      const choice = engine.pack.eventsById.get(pending.eventId)?.choices[0];
      if (choice === undefined) throw new Error(`event choice missing: ${pending.eventId}`);
      trace.push(`EVENT:${pending.eventId}:${choice.id}`);
      const resolved = await resolveEvent(engine, careerId, choice.id);
      if (!resolved.ok) throw new Error(`RESOLVE_EVENT: ${resolved.error.code}`);
      continue;
    }
    if (pending.kind === 'CHAPTER') {
      const chapter = engine.pack.chaptersById.get(pending.chapterId);
      const decision = chapter?.decisions[pending.resolved.length];
      const option = decision?.options[0];
      if (decision === undefined || option === undefined) {
        throw new Error(`chapter option missing: ${pending.chapterId}`);
      }
      trace.push(`CHAPTER:${pending.chapterId}:${decision.id}:${option.id}`);
      const resolved = await resolveChapter(engine, careerId, decision.id, option.id);
      if (!resolved.ok) throw new Error(`RESOLVE_CHAPTER: ${resolved.error.code}`);
      continue;
    }
    if (pending.kind === 'CONTRACT') {
      const offer = pending.offers[0];
      if (offer === undefined) {
        const progressed = await advance(engine, careerId);
        if (!progressed.ok) throw new Error(`ADVANCE contract: ${progressed.error.code}`);
      } else {
        trace.push(`REJECT_RENEWAL:${offer.id}`);
        const rejected = await rejectOffer(engine, careerId, offer.id);
        if (!rejected.ok) throw new Error(`REJECT_OFFER: ${rejected.error.code}`);
      }
      continue;
    }
    if (pending.kind === 'LOAN_RETURN') {
      const decision = pending.options[0] ?? 'RETURN';
      trace.push(`LOAN_RETURN:${decision}`);
      const resolved = await resolveLoanReturn(engine, careerId, decision);
      if (!resolved.ok) throw new Error(`LOAN_RETURN: ${resolved.error.code}`);
      continue;
    }
    if (pending.kind === 'OFFERS') throw new Error('market opened before settlement');
    const settled = await settleSeason(engine, careerId);
    if (!settled.ok) throw new Error(`SETTLE_SEASON: ${settled.error.code}`);
    const settledState = settled.domainSnapshot.state;
    const summary = settledState.seasonHistory.at(-1);
    if (summary === undefined) throw new Error('settled season missing');
    const stats = summary.result.playerStats;
    return {
      season: summary.index,
      matchesWithMinutes: stats.appearances.total - stats.appearances.zeroMinute,
      minutes: stats.minutes,
      ratedMatches: stats.ratedMatches,
      rolePromise: settledState.contract?.rolePromise ?? null,
      primaryPosition: settledState.player.profile?.primaryPosition ?? null,
      marketReason:
        settledState.pending?.kind === 'OFFERS' ? settledState.pending.market.reason : null,
    };
  }
  throw new Error('season guard exceeded');
}

async function runIssue242TwoSeasons(
  versions: Issue242VersionPair,
  decision: 'ACCEPT' | 'DECLINE',
) {
  const trace: string[] = [];
  const { engine, careerId } = await prepareIssue242Scenario(
    decision.toLowerCase(),
    trace,
    versions,
  );
  await startIssue242Season(engine, careerId, trace);
  const beforeRole = await engine.client.loadCareer(careerId);
  if (!beforeRole.ok) throw new Error(`load proposal: ${beforeRole.error.code}`);
  const firstProposal = beforeRole.snapshot.state.pending;
  const proposalStateHash = beforeRole.snapshot.stateHash;
  const decisions: Issue242DecisionRecord[] = [];
  const records = [await playIssue242Season(engine, careerId, decision, trace, decisions)];
  await startIssue242Season(engine, careerId, trace);
  records.push(await playIssue242Season(engine, careerId, decision, trace, decisions));
  const final = await engine.client.loadCareer(careerId);
  if (!final.ok) throw new Error(`load final: ${final.error.code}`);
  return {
    records,
    trace,
    decisions,
    firstProposal,
    proposalStateHash,
    finalStateHash: final.snapshot.stateHash,
  };
}

function expectIssue242PreviewToMatchResolution(decisions: Issue242DecisionRecord[]): void {
  for (const { preview, actual } of decisions) expect(preview).toEqual(actual);
}

// Issue #242: 이 스위트는 임시 seed 탐색 파일이 아니라 기존 career-actions 경로로 실제
// CREATE_CAREER → 드래프트 → 이벤트 선택 → 제안 수락 → 2시즌을 고정한다. 원 제보 seed는 없어
// 동일 조건을 재현하는 최신 deterministic 입력열이며, 운영 재생으로 표현하지 않는다.
describe('career actions: issue #242 two-season zero-slot role balance', () => {
  it('1.7.2/0.6.6의 CM 하향 제안 수락·거절이 모두 2시즌 0분인 경로와 해시를 보존한다', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const accepted = await runIssue242TwoSeasons(ISSUE_242_LEGACY_PAIR, 'ACCEPT');
      const refused = await runIssue242TwoSeasons(ISSUE_242_LEGACY_PAIR, 'DECLINE');
      expect(accepted.firstProposal).toMatchObject({
        kind: 'ROLE_PROPOSAL',
        proposal: { type: 'ROLE_CHANGE', from: 'ROTATION', to: 'RESERVE' },
      });
      expect(accepted.records).toEqual([
        {
          season: 1,
          matchesWithMinutes: 0,
          minutes: 0,
          ratedMatches: 0,
          rolePromise: 'RESERVE',
          primaryPosition: 'CM',
          marketReason: 'INTEREST',
        },
        {
          season: 2,
          matchesWithMinutes: 0,
          minutes: 0,
          ratedMatches: 0,
          rolePromise: 'RESERVE',
          primaryPosition: 'CM',
          marketReason: 'INTEREST',
        },
      ]);
      expect(refused.records).toEqual([
        {
          season: 1,
          matchesWithMinutes: 0,
          minutes: 0,
          ratedMatches: 0,
          rolePromise: 'ROTATION',
          primaryPosition: 'CM',
          marketReason: 'INTEREST',
        },
        {
          season: 2,
          matchesWithMinutes: 0,
          minutes: 0,
          ratedMatches: 0,
          rolePromise: 'ROTATION',
          primaryPosition: 'CM',
          marketReason: 'INTEREST',
        },
      ]);
      expectIssue242PreviewToMatchResolution(accepted.decisions);
      expectIssue242PreviewToMatchResolution(refused.decisions);
      expect(accepted.decisions[0]?.actual).toMatchObject({
        primaryPosition: 'CM',
        contractRole: 'RESERVE',
        appearancePromiseMinutesShareBp: 0,
        managerTrustDelta: 5,
      });
      expect(refused.decisions[0]?.actual).toMatchObject({
        primaryPosition: 'CM',
        contractRole: 'ROTATION',
        appearancePromiseMinutesShareBp: 4000,
        managerTrustDelta: 0,
      });
      expect(accepted.proposalStateHash).toBe(
        '9e9fc7e201f541510c9c27df69286a6a23b76e056df0a2f244550b814bf790c8',
      );
      expect(accepted.finalStateHash).toBe(
        '21af0dd2c7594ee2f479f93b3c7111bed63bffec1502de9719626b39edd665e6',
      );
      expect(refused.proposalStateHash).toBe(
        'aa53adde0cad77aa091f7e4b4aa83526afd98e1251750dabe5fa54bb387f78e5',
      );
      expect(refused.finalStateHash).toBe(
        '2915fa827b6670130dd50709ad07d87e4d3bd52ad69c9b002e9a8b42f013dc3b',
      );
      expect(accepted.trace.slice(0, 6)).toEqual([
        'DRAFT:CM:cm-playmaker:club-academy',
        'EVENT:EVT-CON-020:A',
        'EVENT:EVT-CON-023:A',
        'ACCEPT_OFFER:OFR-9-0:yeongwol-donggang-fc:ROTATION',
        'START_SEASON:FAST:ROLE',
        'ROLE:ROLE_CHANGE:ROTATION->RESERVE:ACCEPT',
      ]);
      expect(refused.trace.filter((step) => step.startsWith('ROLE:'))).toEqual([
        'ROLE:ROLE_CHANGE:ROTATION->RESERVE:DECLINE',
        'ROLE:ROLE_CHANGE:ROTATION->RESERVE:DECLINE',
      ]);
    } finally {
      logSpy.mockRestore();
      errorSpy.mockRestore();
    }
  }, 120_000);

  it('1.7.3/0.6.7은 DM 기회 제안을 열고 수락·거절 2시즌을 결정론적으로 재생한다', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const accepted = await runIssue242TwoSeasons(ISSUE_242_BALANCED_PAIR, 'ACCEPT');
      const acceptedReplay = await runIssue242TwoSeasons(ISSUE_242_BALANCED_PAIR, 'ACCEPT');
      const refused = await runIssue242TwoSeasons(ISSUE_242_BALANCED_PAIR, 'DECLINE');
      expect(acceptedReplay).toEqual(accepted);
      expect(accepted.firstProposal).toMatchObject({
        kind: 'ROLE_PROPOSAL',
        proposal: { type: 'POSITION_CHANGE', from: 'CM', to: 'DM', squadRoleAfter: 'STARTER' },
      });
      expect(accepted.records).toEqual([
        {
          season: 1,
          matchesWithMinutes: 32,
          minutes: 2640,
          ratedMatches: 32,
          rolePromise: 'ROTATION',
          primaryPosition: 'DM',
          marketReason: 'INTEREST',
        },
        {
          season: 2,
          matchesWithMinutes: 15,
          minutes: 345,
          ratedMatches: 15,
          rolePromise: 'ROTATION',
          primaryPosition: 'DM',
          marketReason: 'INTEREST',
        },
      ]);
      expect(refused.records).toEqual([
        {
          season: 1,
          matchesWithMinutes: 0,
          minutes: 0,
          ratedMatches: 0,
          rolePromise: 'ROTATION',
          primaryPosition: 'CM',
          marketReason: 'INTEREST',
        },
        {
          season: 2,
          matchesWithMinutes: 0,
          minutes: 0,
          ratedMatches: 0,
          rolePromise: 'ROTATION',
          primaryPosition: 'CM',
          marketReason: 'INTEREST',
        },
      ]);
      expectIssue242PreviewToMatchResolution(accepted.decisions);
      expectIssue242PreviewToMatchResolution(refused.decisions);
      expect(accepted.decisions[0]?.actual).toMatchObject({
        primaryPosition: 'DM',
        contractRole: 'ROTATION',
        appearancePromiseMinutesShareBp: 4000,
        managerTrustDelta: 5,
      });
      expect(refused.decisions[0]?.actual).toMatchObject({
        primaryPosition: 'CM',
        contractRole: 'ROTATION',
        appearancePromiseMinutesShareBp: 4000,
        managerTrustDelta: 0,
      });
      expect(accepted.proposalStateHash).toBe(
        '63b3b94a9fadde5da22c19c1c2e8b6d296bd6c238743058348dcfdecbcbc1789',
      );
      expect(accepted.finalStateHash).toBe(
        'c8d184c89ed38b79e1decc164f6a417113823d906621b55ced056ab5d7575681',
      );
      expect(refused.proposalStateHash).toBe(
        '630d8b2d8edf8f90f0b2f67d5be09adb59e9406e5a51426db8f30b8c81e8c9d7',
      );
      expect(refused.finalStateHash).toBe(
        'dd72e09e6ca5182f0d5980d8a3b151811d295c3c2e17a108d35c642ed0a1a267',
      );
      expect(accepted.trace.filter((step) => step.startsWith('ROLE:'))).toEqual([
        'ROLE:POSITION_CHANGE:CM->DM:STARTER:ACCEPT',
        'ROLE:KEEP:KEEP:ACCEPT',
      ]);
      expect(refused.trace.filter((step) => step.startsWith('ROLE:'))).toEqual([
        'ROLE:POSITION_CHANGE:CM->DM:STARTER:DECLINE',
        'ROLE:POSITION_CHANGE:CM->AM:ROTATION:DECLINE',
      ]);
    } finally {
      logSpy.mockRestore();
      errorSpy.mockRestore();
    }
  }, 120_000);
});

describe('deleteCareer', () => {
  it('삭제 후 목록에서 빠진다', async () => {
    const engine = makeTestEngine();
    const first = await createCareer(engine, { simulationMode: 'FAST' });
    const second = await createCareer(engine, { simulationMode: 'FAST' });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) throw new Error('unreachable');

    await deleteCareer(engine, first.snapshot.careerId);

    const listed = await engine.client.listCareers();
    expect(listed.map((record) => record.id)).toEqual([second.snapshot.careerId]);
  });
});

describe('notifySync 게이팅: ok:true·replayed:false일 때만 notifyCommitted', () => {
  it('ok:true·replayed:false면 notifyCommitted를 부른다', async () => {
    syncHolder.notifyCommitted.mockClear();
    const engine = makeTestEngine();

    const result = await createCareer(engine, { simulationMode: 'FAST' });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');

    await vi.waitFor(() => expect(syncHolder.notifyCommitted).toHaveBeenCalledTimes(1));
    expect(syncHolder.notifyCommitted).toHaveBeenCalledWith(
      result.snapshot.careerId,
      result.domainSnapshot,
    );
  });

  it('ok:true·replayed:true(재생)면 notifyCommitted를 부르지 않는다', async () => {
    syncHolder.notifyCommitted.mockClear();
    const seedEngine = makeTestEngine();
    const created = await createCareer(seedEngine, { simulationMode: 'FAST' });
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error('unreachable');
    // 시드 생성 자체도 notifyCommitted를 부른다(fire-and-forget) — 그게 가라앉을 때까지
    // 기다린 뒤 지우고, 이제부터가 진짜 검증 구간이다.
    await vi.waitFor(() => expect(syncHolder.notifyCommitted).toHaveBeenCalledTimes(1));
    syncHolder.notifyCommitted.mockClear();

    // 같은 결과를 재생(replayed:true)으로 바꿔치기해, loadCareer는 실제로 성공시키되
    // execute만 스크립트한다(존재하지 않는 careerId면 execute() 래퍼가 loadCareer에서
    // CAREER_NOT_FOUND로 먼저 끝나 execute를 아예 안 부른다).
    const replayedResult: ExecuteResult = { ...created, replayed: true };
    const scriptedEngine: AppEngine = {
      ...seedEngine,
      client: { ...seedEngine.client, execute: async () => replayedResult },
    };

    await execute(scriptedEngine, created.snapshot.careerId, {
      type: 'ADVANCE',
      payload: { eligibleEvents: [] },
    });

    // 마이크로태스크가 도는 동안 실제로 안 불렸는지 확인하려고 짧게 양보한다.
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(syncHolder.notifyCommitted).not.toHaveBeenCalled();
  });

  it('ok:false면 notifyCommitted를 부르지 않는다', async () => {
    syncHolder.notifyCommitted.mockClear();
    const seedEngine = makeTestEngine();
    const created = await createCareer(seedEngine, { simulationMode: 'FAST' });
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error('unreachable');
    await vi.waitFor(() => expect(syncHolder.notifyCommitted).toHaveBeenCalledTimes(1));
    syncHolder.notifyCommitted.mockClear();

    const failedResult: ExecuteResult = {
      ok: false,
      error: { code: 'VALIDATION_FAILED', message: '실패' },
    };
    const scriptedEngine: AppEngine = {
      ...seedEngine,
      client: { ...seedEngine.client, execute: async () => failedResult },
    };

    await execute(scriptedEngine, created.snapshot.careerId, {
      type: 'ADVANCE',
      payload: { eligibleEvents: [] },
    });

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(syncHolder.notifyCommitted).not.toHaveBeenCalled();
  });
});

it('routine advance reaches a saved decision without choosing it for the player', async () => {
  const engine = createAppEngine({
    store: new MemoryLocalStore(),
    simulator: inlineSimulator,
    ruleset: loadRuleset('2.1.0'),
    pack: loadContentPack('0.8.0'),
    newId: makeIdGenerator('journey'),
  });
  serviceSeasonHolder.current = {...FALLBACK_SERVICE_SEASON,rulesetVersion:'2.1.0',contentPackVersion:'0.8.0'};
  const created = await createCareer(engine, { simulationMode: 'FAST' });
  serviceSeasonHolder.current = undefined;
  if (!created.ok) throw new Error(created.error.message);
  const careerId = created.snapshot.careerId;
  await reachIssue242FirstOffer(engine, careerId, []);
  const offered = await engine.client.loadCareer(careerId);
  if (!offered.ok || offered.snapshot.state.pending?.kind !== 'OFFERS')
    throw new Error('Missing first offers');
  await acceptOffer(engine, careerId, offered.snapshot.state.pending.offers[0]!.id);
  await startSeason(engine, careerId, { simulationMode: 'FAST' });
  const started = await engine.client.loadCareer(careerId);
  if (!started.ok) throw new Error('Missing started season');
  if (started.snapshot.state.pending?.kind === 'ROLE_PROPOSAL')
    await resolveRole(engine, careerId, 'ACCEPT');
  const before = await engine.client.loadCareer(careerId);
  if (!before.ok) throw new Error('Missing boundary');
  const result = await advanceToDecision(engine, careerId);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  expect(result.domainSnapshot.revision).toBeGreaterThan(before.snapshot.revision);
  expect(result.domainSnapshot.state.pending).not.toBeNull();
  expect(result.domainSnapshot.state.seasonHistory).toHaveLength(0);
  const saved = await engine.client.loadCareer(careerId);
  if (!saved.ok) throw new Error('Missing saved decision');
  expect(saved.snapshot.stateHash).toBe(result.domainSnapshot.stateHash);
});


it('player-life season persists all three camps, stops auto-advance, and preserves every fixture', async () => {
  const engine = createAppEngine({store:new MemoryLocalStore(),simulator:inlineSimulator,ruleset:loadRuleset('3.0.0'),pack:loadContentPack('0.9.0'),newId:makeIdGenerator('life')});
  const created=await createCareer(engine,{simulationMode:'FAST'});
  if (!created.ok) throw new Error(created.error.message);
  const id=created.snapshot.careerId;
  await reachIssue242FirstOffer(engine,id,[]);
  let loaded=await engine.client.loadCareer(id);
  if (!loaded.ok || loaded.snapshot.state.pending?.kind !== 'OFFERS') throw new Error('missing offers');
  await acceptOffer(engine,id,loaded.snapshot.state.pending.offers[0]!.id);
  await startSeason(engine,id,{simulationMode:'FAST'});
  for(let turn=0;turn<60;turn++) {
    loaded=await engine.client.loadCareer(id);
    if(!loaded.ok) throw new Error('missing state');
    const state=loaded.snapshot.state; const pending=state.pending;
    if(pending?.kind==='SETTLEMENT') break;
    let result: ExecuteResult;
    if(needsDevelopment(state,engine.ruleset)) {
      const blocked=await advance(engine,id); expect(blocked.ok).toBe(false);
      result=await develop(engine,id,{drill:'VISION',load:'RECOVERY',partner:'CAPTAIN'});
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.domainSnapshot.state.tags).toContain('육성_판단');
      const duplicate=await develop(engine,id,{drill:'VISION',load:'RECOVERY',partner:'CAPTAIN'});
      expect(duplicate.ok).toBe(false);
    } else if(pending?.kind==='ROLE_PROPOSAL') result=await resolveRole(engine,id,'ACCEPT');
    else if(pending?.kind==='EVENT'||pending?.kind==='INJURY'||pending?.kind==='NATIONAL_TEAM') {
      expect(pending.eventId).not.toBe('EVT-DEV-301');
      const choice=engine.pack.eventsById.get(pending.eventId)!.choices[0]!;
      result=await resolveEvent(engine,id,choice.id);
    } else if(pending?.kind==='CHAPTER') {
      const decision=engine.pack.chaptersById.get(pending.chapterId)!.decisions[pending.resolved.length]!;
      result=await resolveChapter(engine,id,decision.id,decision.options[0]!.id);
    } else if ((pending?.kind==='CONTRACT'||pending?.kind==='OFFERS') && pending.offers.length>0) result=await rejectOffer(engine,id,pending.offers[0]!.id);
    else result=await advanceToDecision(engine,id);
    if(!result.ok) throw new Error(result.error.message);
    const saved=await engine.client.loadCareer(id);
    if(!saved.ok) throw new Error('missing saved state');
    expect(saved.snapshot.stateHash).toBe(result.domainSnapshot.stateHash);
  }
  loaded=await engine.client.loadCareer(id);
  if(!loaded.ok) throw new Error('missing season');
  expect(loaded.snapshot.state.pending?.kind).toBe('SETTLEMENT');
  expect(loaded.snapshot.state.development!.sessions.map(s=>s.block)).toEqual([1,2,3]);
  const season=loaded.snapshot.state.season!;
  expect(new Set(season.matches.map(m=>m.id)).size).toBe(season.matches.length);
  expect(season.matches.filter(m=>m.kind==='LEAGUE').length).toBeGreaterThanOrEqual(14);
  expect((await settleSeason(engine,id)).ok).toBe(true);
},30000);
