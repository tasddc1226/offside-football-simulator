import { describe, expect, it } from 'vitest';
import type { Command, DomainSnapshot, Effect, FootballSeason, InjuryEpisode, SimulationResult } from '@offside/domain';
import { hashState, seedRng, simulate } from '@offside/domain';
import { selectChapterCandidates } from './select-chapter-candidates.ts';
import { selectEligibleEvents } from './select-eligible-events.ts';
import { ChapterDefinitionSchema, type ChapterDefinition } from '../schema/chapter.ts';
import type { EventDefinition } from '../schema/event.ts';
import { loadContentPack, type ContentPack } from '../packs/load-content-pack.ts';
import { loadRuleset } from '../rulesets/load-ruleset.ts';
import { buildTestState } from './build-test-state.ts';

function makeChapter(overrides: Partial<ChapterDefinition> & Pick<ChapterDefinition, 'id'>): ChapterDefinition {
  return ChapterDefinitionSchema.parse({
    version: 1,
    importance: 'MAJOR',
    trigger: { kind: 'DEBUT' },
    weight: 100,
    decisions: [
      {
        id: 'D1',
        prompt: '판단',
        options: [
          {
            id: 'A',
            label: '선택 A',
            riskLabel: 'LOW',
            priorProbability: null,
            previewEffects: [{ label: '효과' }],
            outcomes: [{ id: 'A1', kind: 'FIXED', weight: 100, title: '결과', ratingDeltaTenths: 0, effects: [], narrative: { situation: '상황' } }],
          },
          {
            id: 'B',
            label: '선택 B',
            riskLabel: 'LOW',
            priorProbability: null,
            previewEffects: [{ label: '효과' }],
            outcomes: [{ id: 'B1', kind: 'FIXED', weight: 100, title: '결과', ratingDeltaTenths: 0, effects: [], narrative: { situation: '상황' } }],
          },
        ],
      },
    ],
    ...overrides,
  });
}

function makeContentPack(chapters: ChapterDefinition[]): ContentPack {
  return {
    manifest: {
      contentPackVersion: '0.0.0-test',
      compatibleRulesetVersions: ['1.0.0'],
      clientMinVersion: '0.0.0-test',
      playtested: false,
      checksum: '0'.repeat(64),
      files: [],
    },
    events: [],
    eventsById: new Map(),
    chapters,
    chaptersById: new Map(chapters.map((chapter) => [chapter.id, chapter])),
    narrativeTokens: { name: ['x'], club: ['x'], manager: ['x'], rival: ['x'], captain: ['x'], team: ['x'], agent: ['x'], delta: [] },
  };
}

function makeInjuryEpisode(overrides: Partial<InjuryEpisode> = {}): InjuryEpisode {
  return {
    id: 'INJ-1-3-1',
    severity: 'MODERATE',
    bodyPart: 'HAMSTRING',
    occurredAt: { seasonIndex: 1, step: 3, matchId: 'm-injury' },
    diagnosisRange: { minMatches: 3, maxMatches: 6 },
    rehab: 'STANDARD',
    recurrenceRiskBp: 3000,
    recurrenceChecksRemaining: 0,
    status: 'RECOVERED',
    permanentDelta: null,
    remainingMatches: 0,
    ...overrides,
  };
}

describe('selectChapterCandidates: 필터·정렬', () => {
  it('status가 ACTIVE가 아니면 빈 배열이다', () => {
    const pack = makeContentPack([makeChapter({ id: 'CHP-MATCH-001' })]);
    expect(selectChapterCandidates(pack, buildTestState({ status: 'DRAFT' }))).toEqual([]);
  });

  it('pending이 있으면 빈 배열이다', () => {
    const pack = makeContentPack([makeChapter({ id: 'CHP-MATCH-001' })]);
    expect(selectChapterCandidates(pack, buildTestState({ pending: { kind: 'EVENT', eventId: 'EVT-CON-002', version: 1 } }))).toEqual([]);
  });

  it('positionGroups가 없으면 포지션과 무관하게 포함된다', () => {
    const pack = makeContentPack([makeChapter({ id: 'CHP-MATCH-001' })]);
    expect(selectChapterCandidates(pack, buildTestState())).toEqual([
      { chapterId: 'CHP-MATCH-001', version: 1, importance: 'MAJOR', trigger: { kind: 'DEBUT' }, weight: 100, decisionsTotal: 1 },
    ]);
  });

  it('positionGroups가 있으면 선수 포지션군(FW)과 겹칠 때만 포함된다', () => {
    // TEST_PROFILE.primaryPosition은 'W' → statGroup 'FW'.
    const matching = makeChapter({ id: 'CHP-MATCH-001', positionGroups: ['FW'] });
    const nonMatching = makeChapter({ id: 'CHP-MATCH-002', positionGroups: ['GK'], trigger: { kind: 'DERBY' } });
    const pack = makeContentPack([matching, nonMatching]);
    expect(selectChapterCandidates(pack, buildTestState())).toEqual([
      { chapterId: 'CHP-MATCH-001', version: 1, importance: 'MAJOR', trigger: { kind: 'DEBUT' }, weight: 100, decisionsTotal: 1 },
    ]);
  });

  it('player.profile이 null이면 positionGroups가 있는 챕터는 제외된다', () => {
    const pack = makeContentPack([makeChapter({ id: 'CHP-MATCH-001', positionGroups: ['FW'] })]);
    const state = buildTestState({ player: { draft: buildTestState().player.draft, profile: null } });
    expect(selectChapterCandidates(pack, state)).toEqual([]);
  });

  it('이번 시즌에 이미 resolvedChapterIds에 있으면 제외된다', () => {
    const pack = makeContentPack([makeChapter({ id: 'CHP-MATCH-001' })]);
    const state = buildTestState({ resolvedChapterIds: ['CHP-MATCH-001@1'], season: { ...buildSeasonStub(), index: 1 } });
    expect(selectChapterCandidates(pack, state)).toEqual([]);
  });

  it('다른 시즌 인덱스로 resolvedChapterIds에 있으면 제외되지 않는다', () => {
    const pack = makeContentPack([makeChapter({ id: 'CHP-MATCH-001' })]);
    const state = buildTestState({ resolvedChapterIds: ['CHP-MATCH-001@1'], season: { ...buildSeasonStub(), index: 2 } });
    expect(selectChapterCandidates(pack, state)).toHaveLength(1);
  });

  it('결과는 chapterId 오름차순이다', () => {
    const pack = makeContentPack([makeChapter({ id: 'CHP-MATCH-004' }), makeChapter({ id: 'CHP-MATCH-001' })]);
    expect(selectChapterCandidates(pack, buildTestState()).map((c) => c.chapterId)).toEqual(['CHP-MATCH-001', 'CHP-MATCH-004']);
  });

  it('INJURY_RETURN 후보 readiness는 domain에 위임해 REHAB·RECOVERED·window 만료 상태 모두 전달한다', () => {
    const pack = makeContentPack([
      makeChapter({ id: 'CHP-MATCH-012', importance: 'MINOR', trigger: { kind: 'INJURY_RETURN' } }),
    ]);
    const recovered = buildTestState({ health: { episodes: [makeInjuryEpisode({ recurrenceChecksRemaining: 1 })] } });
    expect(selectChapterCandidates(pack, recovered)).toHaveLength(1);

    const expired = buildTestState({ health: { episodes: [makeInjuryEpisode({ recurrenceChecksRemaining: 0 })] } });
    expect(selectChapterCandidates(pack, expired)).toHaveLength(1);

    const recurred = buildTestState({ health: { episodes: [makeInjuryEpisode({ status: 'RECURRED', recurrenceChecksRemaining: 6 })] } });
    expect(selectChapterCandidates(pack, recurred)).toHaveLength(1);

    const rehab = buildTestState({ health: { episodes: [makeInjuryEpisode({ status: 'REHAB', recurrenceChecksRemaining: 0 })] } });
    expect(selectChapterCandidates(pack, rehab)).toHaveLength(1);
  });

  it.each(['RECOVERED', 'RECURRED'] as const)('같은 시즌 forced 신규 injury 뒤에도 첫 복귀 후보를 복원한다(%s prior episode)', (priorStatus) => {
    const prior = makeInjuryEpisode({ id: 'INJ-1-2-1', status: priorStatus, occurredAt: { seasonIndex: 1, step: 2, matchId: 'old-match' } });
    const pending = makeInjuryEpisode({
      id: 'INJ-1-3-2',
      status: 'REHAB',
      occurredAt: { seasonIndex: 1, step: 3, matchId: 'return-match' },
      remainingMatches: 4,
    });
    const state = buildTestState({
      season: { ...buildSeasonStub(), currentStep: 3, matches: [
        { id: 'old-match', minutes: 45, outReason: null } as never,
        { id: 'absence-1', minutes: 0, outReason: 'INJURY' } as never,
        { id: 'return-match', minutes: 45, outReason: null } as never,
      ] },
      health: { episodes: [prior, pending] },
      timeline: [{ revision: 20, kind: 'REHAB_CHOSEN', refId: pending.id, age: 18, step: 3 }],
    });
    const pack = makeContentPack([makeChapter({ id: 'CHP-MATCH-012', importance: 'MINOR', trigger: { kind: 'INJURY_RETURN' } })]);
    expect(selectChapterCandidates(pack, state)).toHaveLength(1);
  });

  it('cross-season carry는 선두 INJURY 결장이 있을 때만 첫 복귀 후보를 복원한다', () => {
    const prior = makeInjuryEpisode({ occurredAt: { seasonIndex: 1, step: 11, matchId: 'season-1-match' } });
    const pending = makeInjuryEpisode({
      id: 'INJ-2-2-1',
      status: 'REHAB',
      occurredAt: { seasonIndex: 2, step: 2, matchId: 'season-2-return' },
      remainingMatches: 4,
    });
    const pack = makeContentPack([makeChapter({ id: 'CHP-MATCH-012', importance: 'MINOR', trigger: { kind: 'INJURY_RETURN' } })]);
    const carried = buildTestState({
      season: { ...buildSeasonStub(), index: 2, currentStep: 2, matches: [
        { id: 'season-2-1-0', minutes: 0, outReason: 'INJURY' } as never,
        { id: 'season-2-1-1', minutes: 0, outReason: 'INJURY' } as never,
        { id: 'season-2-return', minutes: 45, outReason: null } as never,
      ] },
      health: { episodes: [prior, pending] },
      timeline: [{ revision: 20, kind: 'REHAB_CHOSEN', refId: pending.id, age: 18, step: 2 }],
    });
    expect(selectChapterCandidates(pack, carried)).toHaveLength(1);

    const unrelated = buildTestState({
      season: { ...carried.season!, matches: [{ id: 'season-2-first', minutes: 45, outReason: null } as never], currentStep: 1 },
      health: { episodes: [prior, { ...pending, id: 'INJ-2-1-1', occurredAt: { ...pending.occurredAt, step: 1, matchId: 'season-2-first' } }] },
      timeline: [{ revision: 20, kind: 'REHAB_CHOSEN', refId: 'INJ-2-1-1', age: 18, step: 1 }],
    });
    // 후보 payload는 readiness를 선제 제거하지 않는다. 실제 첫 복귀 여부는 domain
    // selectChapter의 marker가 판정하므로, marker가 없는 경기에서 열리지 않는 회귀는 domain에 둔다.
    expect(selectChapterCandidates(pack, unrelated)).toHaveLength(1);
  });
});

// resolvedChapterIds 시즌 분기 테스트 전용 최소 season 스텁. selectChapterCandidates는 season.index만 읽는다.
function buildSeasonStub(): FootballSeason {
  return {
    index: 1,
    serviceSeasonId: 'svc-test',
    simulationMode: 'CHAPTER' as const,
    calendarId: 'default',
    currentStep: 3,
    phase: 'LEAGUE' as const,
    steps: [],
    teamId: 'team-1',
    styleId: 'style-1',
    squadRole: 'STARTER' as const,
    squadRoleAtStart: 'STARTER' as const,
    trainingFocus: 'ROLE' as const,
    competitions: [],
    schedule: [],
    matches: [],
    ageReferenceStep: 1,
    squad: { competitors: [] },
    selection: { position: 'ST' as const, slots: 1, benchSlots: 0, candidates: [], playerReason: null },
    playerStats: {
      group: 'FW' as const,
      appearances: { total: 0, started: 0, sub: 0, zeroMinute: 0, out: 0 },
      minutes: 0,
      ratingSumTenths: 0,
      ratedMatches: 0,
      yellow: 0,
      red: 0,
      injuries: 0,
      totals: { group: 'FW' as const, goals: 0, assists: 0, xgCenti: 0, shots: 0, offsides: 0 },
    },
    availability: null,
    lastRatingTenths: null,
    yellowSuspensionCount: 0,
    matchRngState: { s: [1, 2, 3, 4] as [number, number, number, number], draws: 0 },
    scheduledEffects: [],
    chapters: [],
    manager: null,
    injuryCount: 0,
  };
}

// --- 실제 1.0.0 룰셋·0.1.0 팩 통합 테스트(브리프 "실제 룰셋·실제 팩" 인수 조건) ---
// domain은 content를 import할 수 없어(ADR-005) 이 조합 테스트는 content 쪽에 둔다.

let commandCounter = 0;

function buildCommand(type: Command['type'], expectedRevision: number, payload: unknown): Command & { commandId: string; expectedRevision: number } {
  commandCounter += 1;
  return { type, commandId: `chapter-candidates-it-${commandCounter}`, expectedRevision, payload } as Command & {
    commandId: string;
    expectedRevision: number;
  };
}

function runOrThrow(
  snapshot: DomainSnapshot | null,
  command: Command & { commandId: string; expectedRevision: number },
  ruleset: ReturnType<typeof loadRuleset>,
): DomainSnapshot {
  const result: SimulationResult = simulate({
    snapshot,
    command,
    ruleset,
    rulesetVersion: '1.0.0',
    contentPackVersion: '0.1.0',
  });
  if (!result.ok) {
    throw new Error(`${command.type} 실패: ${result.error.code} ${result.error.message}`);
  }
  return result.snapshot;
}

type ResolveEventOutcomePayload = {
  id: string;
  kind: EventDefinition['choices'][number]['outcomes'][number]['kind'];
  weight: number;
  effects: Effect[];
  addTags?: string[];
  removeTags?: string[];
};

/** apps/web career-actions.ts의 toResolveEventOutcomes와 같은 매핑(팩 outcome → RESOLVE_EVENT payload). */
function toResolveEventOutcomes(outcomes: EventDefinition['choices'][number]['outcomes']): ResolveEventOutcomePayload[] {
  return outcomes.map((outcome) => {
    const payload: ResolveEventOutcomePayload = {
      id: outcome.id,
      kind: outcome.kind,
      weight: outcome.weight,
      effects: outcome.effects,
    };
    if (outcome.addTags !== undefined) payload.addTags = outcome.addTags;
    if (outcome.removeTags !== undefined) payload.removeTags = outcome.removeTags;
    return payload;
  });
}

function toResolveChapterOutcomes(
  outcomes: ChapterDefinition['decisions'][number]['options'][number]['outcomes'],
) {
  return outcomes.map((outcome) => ({
    id: outcome.id,
    kind: outcome.kind,
    weight: outcome.weight,
    effects: outcome.effects,
    ratingDeltaTenths: outcome.ratingDeltaTenths,
    ...(outcome.addTags === undefined ? {} : { addTags: outcome.addTags }),
    ...(outcome.removeTags === undefined ? {} : { removeTags: outcome.removeTags }),
  }));
}

describe('selectChapterCandidates: 실제 1.0.0 룰셋·0.1.0 팩', () => {
  it('CHAPTER 모드로 유스 첫 시즌을 재생하면 step 3에서 데뷔전 챕터(CHP-MATCH-001)가 열린다', () => {
    const ruleset = loadRuleset('1.0.0');
    const pack = loadContentPack('0.1.0');

    let snapshot = runOrThrow(
      null,
      buildCommand('CREATE_CAREER', 0, {
        careerId: 'car_select-chapter-candidates-it',
        seed: 'select-chapter-candidates-it-seed',
        simulationMode: 'CHAPTER',
        rulesetVersion: '1.0.0',
        contentPackVersion: '0.1.0',
      }),
      ruleset,
    );
    snapshot = runOrThrow(
      snapshot,
      buildCommand('UPDATE_PLAYER_DRAFT', snapshot.revision, {
        draft: { name: '테스트 선수', gender: 'UNSPECIFIED', nationalityCode: 'KR', preferredFoot: 'RIGHT' },
      }),
      ruleset,
    );
    snapshot = runOrThrow(
      snapshot,
      buildCommand('UPDATE_PLAYER_DRAFT', snapshot.revision, {
        draft: { position: 'W', archetypeId: 'inside-forward', backgroundId: 'club-academy' },
      }),
      ruleset,
    );
    snapshot = runOrThrow(snapshot, buildCommand('CONFIRM_PLAYER', snapshot.revision, {}), ruleset);

    // 계약 전(season null) 진행: ADVANCE → (EVENT면 첫 선택지로 RESOLVE_EVENT) → ... → OFFERS.
    for (let guard = 0; guard < 20 && snapshot.state.contract === null; guard += 1) {
      const pending = snapshot.state.pending;
      if (pending === null) {
        const eligibleEvents = selectEligibleEvents(pack, snapshot.state);
        snapshot = runOrThrow(snapshot, buildCommand('ADVANCE', snapshot.revision, { eligibleEvents }), ruleset);
        continue;
      }
      if (pending.kind === 'EVENT') {
        const definition = pack.eventsById.get(pending.eventId);
        if (definition === undefined) throw new Error(`팩에 이벤트 정의가 없다: ${pending.eventId}`);
        const choice = definition.choices[0]!;
        snapshot = runOrThrow(
          snapshot,
          buildCommand('RESOLVE_EVENT', snapshot.revision, {
            eventId: definition.id,
            definitionVersion: definition.version,
            choiceId: choice.id,
            outcomes: toResolveEventOutcomes(choice.outcomes),
          }),
          ruleset,
        );
        continue;
      }
      if (pending.kind === 'OFFERS') {
        const offer = pending.offers[0];
        if (offer === undefined) throw new Error('OFFERS pending인데 offers가 비어 있다.');
        snapshot = runOrThrow(snapshot, buildCommand('ACCEPT_OFFER', snapshot.revision, { offerId: offer.id }), ruleset);
        continue;
      }
      throw new Error(`계약 전 단계에서 예상하지 못한 pending: ${pending.kind}`);
    }
    expect(snapshot.state.contract).not.toBeNull();

    snapshot = runOrThrow(
      snapshot,
      buildCommand('START_SEASON', snapshot.revision, { simulationMode: 'CHAPTER', serviceSeasonId: 'svc-select-chapter-candidates-it' }),
      ruleset,
    );
    expect(snapshot.state.pending).toMatchObject({ kind: 'ROLE_PROPOSAL' });
    snapshot = runOrThrow(snapshot, buildCommand('RESOLVE_ROLE', snapshot.revision, { decision: 'ACCEPT' }), ruleset);
    expect(snapshot.state.pending).toBeNull();

    // 시즌 진행: EVENT가 열리면 첫 선택지로 해소하며 CHAPTER pending까지 반복 ADVANCE.
    for (let guard = 0; guard < 10; guard += 1) {
      const pending = snapshot.state.pending;
      if (pending !== null && pending.kind === 'CHAPTER') break;
      if (pending === null) {
        const eligibleEvents = selectEligibleEvents(pack, snapshot.state);
        const chapterCandidates = selectChapterCandidates(pack, snapshot.state);
        snapshot = runOrThrow(snapshot, buildCommand('ADVANCE', snapshot.revision, { eligibleEvents, chapterCandidates }), ruleset);
        continue;
      }
      if (pending.kind === 'EVENT') {
        const definition = pack.eventsById.get(pending.eventId);
        if (definition === undefined) throw new Error(`팩에 이벤트 정의가 없다: ${pending.eventId}`);
        const choice = definition.choices[0]!;
        snapshot = runOrThrow(
          snapshot,
          buildCommand('RESOLVE_EVENT', snapshot.revision, {
            eventId: definition.id,
            definitionVersion: definition.version,
            choiceId: choice.id,
            outcomes: toResolveEventOutcomes(choice.outcomes),
          }),
          ruleset,
        );
        continue;
      }
      throw new Error(`시즌 진행 중 예상하지 못한 pending: ${pending.kind}`);
    }

    expect(snapshot.state.season?.currentStep).toBe(3);
    expect(snapshot.state.pending).toMatchObject({
      kind: 'CHAPTER',
      chapterId: 'CHP-MATCH-001',
      step: 3,
      decisionsTotal: 1,
    });
  });

  it('1.7.0/0.6.4 실제 ADVANCE는 seed별 가중 경로를 재현하고 선택 의도의 후속 사건까지 연다', () => {
    const ruleset = loadRuleset('1.7.0');
    const pack = loadContentPack('0.6.4');

    const offerForSeed = (seed: string): DomainSnapshot => {
      const state = buildTestState({
        stage: 'PRO',
        age: 22,
        currentStep: 4,
        seasonPhase: 'LEAGUE',
        rulesetVersion: '1.7.0',
        contentPackVersion: '0.6.4',
        rngState: seedRng(seed),
        state: { form: 45, fitness: 80, morale: 60 },
        relationships: { managerTrust: 60, captain: 60, rival: 55, fans: 55, agent: 50 },
      });
      const snapshot: DomainSnapshot = {
        revision: 10,
        checkpoint: 'STEP_BOUNDARY',
        state,
        stateHash: hashState(state),
        rulesetVersion: '1.7.0',
        contentPackVersion: '0.6.4',
      };
      const result = simulate({
        snapshot,
        command: buildCommand('ADVANCE', snapshot.revision, {
          eligibleEvents: selectEligibleEvents(pack, state),
        }),
        ruleset,
        rulesetVersion: '1.7.0',
        contentPackVersion: '0.6.4',
      });
      if (!result.ok) throw new Error(`0.6.4 ADVANCE 실패: ${result.error.code}`);
      return result.snapshot;
    };

    const first = offerForSeed('t7034-repeat');
    const repeated = offerForSeed('t7034-repeat');
    expect(repeated.stateHash).toBe(first.stateHash);
    expect(repeated.state.pending).toEqual(first.state.pending);

    const offeredIds = new Set<string>();
    let reciprocity: DomainSnapshot | undefined;
    for (let index = 0; index < 200; index += 1) {
      const offered = offerForSeed(`t7034-variety-${index}`);
      if (offered.state.pending?.kind !== 'EVENT') throw new Error('실제 ADVANCE가 EVENT를 열지 않았다.');
      offeredIds.add(offered.state.pending.eventId);
      if (offered.state.pending.eventId === 'EVT-REL-120') reciprocity = offered;
    }
    expect(offeredIds.size).toBeGreaterThan(1);
    expect([...offeredIds].some((eventId) => /-12[0-2]$/.test(eventId))).toBe(true);
    expect(reciprocity).toBeDefined();

    const root = pack.eventsById.get('EVT-REL-120');
    if (reciprocity === undefined || root === undefined) throw new Error('대표 연속 사건을 찾지 못했다.');
    const cooperativeChoice = root.choices.find((choice) => choice.id === 'A');
    if (cooperativeChoice === undefined) throw new Error('협력 선택지가 없다.');
    const resolved = simulate({
      snapshot: reciprocity,
      command: buildCommand('RESOLVE_EVENT', reciprocity.revision, {
        eventId: root.id,
        definitionVersion: root.version,
        choiceId: cooperativeChoice.id,
        outcomes: toResolveEventOutcomes(cooperativeChoice.outcomes),
      }),
      ruleset,
      rulesetVersion: '1.7.0',
      contentPackVersion: '0.6.4',
    });
    if (!resolved.ok) throw new Error(`대표 사건 해소 실패: ${resolved.error.code}`);

    const followUps = selectEligibleEvents(pack, resolved.snapshot.state);
    expect(followUps).toEqual([{ eventId: 'EVT-REL-121', version: 1, weight: 100 }]);
    const continued = simulate({
      snapshot: resolved.snapshot,
      command: buildCommand('ADVANCE', resolved.snapshot.revision, { eligibleEvents: followUps }),
      ruleset,
      rulesetVersion: '1.7.0',
      contentPackVersion: '0.6.4',
    });
    expect(continued.ok).toBe(true);
    if (continued.ok) {
      expect(continued.snapshot.state.pending).toEqual({ kind: 'EVENT', eventId: 'EVT-REL-121', version: 1 });
    }
  });

  it('1.7.1/0.6.5 FAST 신규 커리어 24개는 자연 진행으로 root와 후속 사건을 열고 포지션 조건을 지킨다', () => {
    const rulesetVersion = '1.7.1';
    const contentPackVersion = '0.6.5';
    const ruleset = loadRuleset(rulesetVersion);
    const pack = loadContentPack(contentPackVersion);
    type PairRuntime = {
      rulesetVersion: string;
      contentPackVersion: string;
      ruleset: ReturnType<typeof loadRuleset>;
      pack: ContentPack;
    };
    const currentRuntime: PairRuntime = { rulesetVersion, contentPackVersion, ruleset, pack };

    const execute = (
      runtime: PairRuntime,
      snapshot: DomainSnapshot | null,
      type: Command['type'],
      payload: unknown,
    ): DomainSnapshot => {
      const result = simulate({
        snapshot,
        command: buildCommand(type, snapshot?.revision ?? 0, payload),
        ruleset: runtime.ruleset,
        rulesetVersion: runtime.rulesetVersion,
        contentPackVersion: runtime.contentPackVersion,
      });
      if (!result.ok) throw new Error(`${type} 실패: ${result.error.code} ${result.error.message}`);
      return result.snapshot;
    };

    const resolvePendingEvent = (
      runtime: PairRuntime,
      snapshot: DomainSnapshot,
    ): DomainSnapshot => {
      const pending = snapshot.state.pending;
      if (pending?.kind !== 'EVENT' && pending?.kind !== 'INJURY') {
        throw new Error(`해소할 이벤트가 아니다: ${pending?.kind ?? 'none'}`);
      }
      const definition = runtime.pack.eventsById.get(pending.eventId);
      if (definition === undefined) throw new Error(`팩에 이벤트 정의가 없다: ${pending.eventId}`);
      const choice = definition.choices[0]!;
      return execute(runtime, snapshot, 'RESOLVE_EVENT', {
        eventId: definition.id,
        definitionVersion: definition.version,
        choiceId: choice.id,
        outcomes: toResolveEventOutcomes(choice.outcomes),
        ...(pending.kind === 'INJURY' ? { rehabPlan: choice.rehabPlan } : {}),
      });
    };

    const resolvePendingChapter = (
      runtime: PairRuntime,
      snapshot: DomainSnapshot,
    ): DomainSnapshot => {
      const pending = snapshot.state.pending;
      if (pending?.kind !== 'CHAPTER') throw new Error('해소할 CHAPTER pending이 없다.');
      const definition = runtime.pack.chaptersById.get(pending.chapterId);
      if (definition === undefined) throw new Error(`팩에 챕터 정의가 없다: ${pending.chapterId}`);
      const resolvedIds = new Set(pending.resolved.map((entry) => entry.decisionId));
      const decision = definition.decisions.find((candidate) => !resolvedIds.has(candidate.id));
      const option = decision?.options[0];
      if (decision === undefined || option === undefined)
        throw new Error('해소할 챕터 판단/선택지가 없다.');
      return execute(runtime, snapshot, 'RESOLVE_CHAPTER', {
        chapterId: definition.id,
        definitionVersion: definition.version,
        decisionId: decision.id,
        optionId: option.id,
        outcomes: toResolveChapterOutcomes(option.outcomes),
      });
    };

    const startFastCareer = (
      seed: string,
      position: 'W' | 'GK',
      runtime: PairRuntime = currentRuntime,
    ): DomainSnapshot | null => {
      let snapshot = execute(runtime, null, 'CREATE_CAREER', {
        careerId: `car_fast-event-${position.toLowerCase()}-${seed}`,
        seed,
        simulationMode: 'FAST',
        rulesetVersion: runtime.rulesetVersion,
        contentPackVersion: runtime.contentPackVersion,
      });
      snapshot = execute(runtime, snapshot, 'UPDATE_PLAYER_DRAFT', {
        draft: {
          name: '테스트 선수',
          gender: 'UNSPECIFIED',
          nationalityCode: 'KR',
          preferredFoot: 'RIGHT',
        },
      });
      snapshot = execute(runtime, snapshot, 'UPDATE_PLAYER_DRAFT', {
        draft: {
          position,
          archetypeId: position === 'GK' ? 'gk-shot-stopper' : 'inside-forward',
          backgroundId: 'club-academy',
        },
      });
      snapshot = execute(runtime, snapshot, 'CONFIRM_PLAYER', {});

      for (let guard = 0; guard < 30 && snapshot.state.contract === null; guard += 1) {
        const pending = snapshot.state.pending;
        if (pending === null) {
          snapshot = execute(runtime, snapshot, 'ADVANCE', {
            eligibleEvents: selectEligibleEvents(runtime.pack, snapshot.state),
            chapterCandidates: selectChapterCandidates(runtime.pack, snapshot.state),
          });
        } else if (pending.kind === 'EVENT' || pending.kind === 'INJURY') {
          snapshot = resolvePendingEvent(runtime, snapshot);
        } else if (pending.kind === 'OFFERS') {
          const offer = pending.offers[0];
          if (offer === undefined) throw new Error('OFFERS pending인데 offers가 비어 있다.');
          snapshot = execute(runtime, snapshot, 'ACCEPT_OFFER', { offerId: offer.id });
        } else {
          throw new Error(`계약 전 예상하지 못한 pending: ${pending.kind}`);
        }
      }
      if (snapshot.state.contract === null) throw new Error('계약까지 자연 진행하지 못했다.');

      snapshot = execute(runtime, snapshot, 'START_SEASON', {
        simulationMode: 'FAST',
        serviceSeasonId: 'svc-fast-event-integration',
      });
      if (snapshot.state.pending?.kind === 'ROLE_PROPOSAL') {
        snapshot = execute(runtime, snapshot, 'RESOLVE_ROLE', { decision: 'ACCEPT' });
      }

      for (let guard = 0; guard < 12; guard += 1) {
        const pending = snapshot.state.pending;
        if (pending?.kind === 'EVENT' && /-120$/.test(pending.eventId)) return snapshot;
        if ((snapshot.state.season?.currentStep ?? 0) > 5 || pending?.kind === 'CONTRACT')
          return null;
        if (pending === null) {
          snapshot = execute(runtime, snapshot, 'ADVANCE', {
            eligibleEvents: selectEligibleEvents(runtime.pack, snapshot.state),
            chapterCandidates: selectChapterCandidates(runtime.pack, snapshot.state),
          });
        } else if (pending.kind === 'INJURY' || pending.kind === 'EVENT') {
          snapshot = resolvePendingEvent(runtime, snapshot);
        } else if (pending.kind === 'CHAPTER') {
          snapshot = resolvePendingChapter(runtime, snapshot);
        } else {
          throw new Error(`root 전 예상하지 못한 pending: ${pending.kind}`);
        }
      }
      return null;
    };

    const fieldRootCounts = new Map<string, number>();
    const goalkeeperRootCounts = new Map<string, number>();
    let linkedFollowUps = 0;
    let injuryInterruptions = 0;
    let lateRootWithoutFollowUpSlot = 0;
    let noRoot = 0;
    let representative: { root: string; followUp: string } | null = null;
    let repeatSeed: { seed: string; position: 'W' | 'GK'; stateHash: string } | null = null;
    const exposedSeeds: Array<{ seed: string; position: 'W' | 'GK' }> = [];
    for (const [position, samples, counts] of [
      ['W', 16, fieldRootCounts],
      ['GK', 8, goalkeeperRootCounts],
    ] as const) {
      for (let index = 0; index < samples; index += 1) {
        const seed = `fast-event-${position}-${index}`;
        let snapshot = startFastCareer(seed, position);
        if (snapshot === null) {
          noRoot += 1;
          continue;
        }
        repeatSeed ??= { seed, position, stateHash: snapshot.stateHash };
        exposedSeeds.push({ seed, position });
        const pending = snapshot.state.pending;
        if (pending?.kind !== 'EVENT') throw new Error('root pending이 EVENT가 아니다.');
        counts.set(pending.eventId, (counts.get(pending.eventId) ?? 0) + 1);
        const definition = pack.eventsById.get(pending.eventId)!;
        const choice = definition.choices[0]!;
        const resolved = simulate({
          snapshot,
          command: buildCommand('RESOLVE_EVENT', snapshot.revision, {
            eventId: definition.id,
            definitionVersion: definition.version,
            choiceId: choice.id,
            outcomes: toResolveEventOutcomes(choice.outcomes),
          }),
          ruleset,
          rulesetVersion,
          contentPackVersion,
        });
        if (!resolved.ok) throw new Error(`root 해소 실패: ${resolved.error.code}`);
        snapshot = resolved.snapshot;
        const followUps = selectEligibleEvents(pack, snapshot.state);
        expect(followUps).toHaveLength(1);
        expect(followUps[0]?.eventId).toMatch(/-12[12]$/);
        if (snapshot.state.currentStep === 5) {
          lateRootWithoutFollowUpSlot += 1;
          continue;
        }
        snapshot = execute(currentRuntime, snapshot, 'ADVANCE', {
          eligibleEvents: followUps,
          chapterCandidates: selectChapterCandidates(pack, snapshot.state),
        });
        if (snapshot.state.pending?.kind === 'INJURY') {
          injuryInterruptions += 1;
        } else {
          expect(snapshot.state.pending).toMatchObject({ kind: 'EVENT' });
          if (snapshot.state.pending?.kind === 'EVENT') {
            expect(snapshot.state.pending.eventId).toBe(followUps[0]?.eventId);
            linkedFollowUps += 1;
            representative ??= { root: definition.id, followUp: snapshot.state.pending.eventId };
          }
        }
      }
    }

    expect(repeatSeed).not.toBeNull();
    if (repeatSeed !== null) {
      expect(startFastCareer(repeatSeed.seed, repeatSeed.position)?.stateHash).toBe(
        repeatSeed.stateHash,
      );
    }
    expect([...fieldRootCounts.keys()].every((id) => /-120$/.test(id))).toBe(true);
    expect(fieldRootCounts.size).toBeGreaterThan(1);
    expect(Object.fromEntries([...fieldRootCounts.entries()].sort())).toEqual({
      'EVT-MEDIA-120': 4,
      'EVT-REL-120': 3,
    });
    expect(
      [...goalkeeperRootCounts.keys()].every(
        (id) => id === 'EVT-MEDIA-120' || id === 'EVT-CON-120',
      ),
    ).toBe(true);
    expect(goalkeeperRootCounts.size).toBeGreaterThan(0);
    expect(Object.fromEntries([...goalkeeperRootCounts.entries()].sort())).toEqual({
      'EVT-MEDIA-120': 4,
    });
    expect(linkedFollowUps).toBe(6);
    expect(injuryInterruptions).toBe(1);
    expect(lateRootWithoutFollowUpSlot).toBe(4);
    expect(noRoot).toBe(13);
    expect(linkedFollowUps + injuryInterruptions + lateRootWithoutFollowUpSlot + noRoot).toBe(24);
    expect(representative).not.toBeNull();

    const baselineRuntime: PairRuntime = {
      rulesetVersion: '1.7.0',
      contentPackVersion: '0.6.4',
      ruleset: loadRuleset('1.7.0'),
      pack: loadContentPack('0.6.4'),
    };
    expect(exposedSeeds).toHaveLength(11);
    for (const sample of exposedSeeds) {
      expect(startFastCareer(sample.seed, sample.position, baselineRuntime)).toBeNull();
    }
  }, 60_000);
});
