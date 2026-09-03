import { describe, expect, it } from 'vitest';
import type { Command, DomainSnapshot, Effect, FootballSeason, SimulationResult } from '@offside/domain';
import { simulate } from '@offside/domain';
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
    narrativeTokens: { name: ['x'], club: ['x'], manager: ['x'], rival: ['x'], captain: ['x'], team: ['x'], delta: [] },
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

type ResolveEventOutcomePayload = { id: string; weight: number; effects: Effect[]; addTags?: string[]; removeTags?: string[] };

/** apps/web career-actions.ts의 toResolveEventOutcomes와 같은 매핑(팩 outcome → RESOLVE_EVENT payload). */
function toResolveEventOutcomes(outcomes: EventDefinition['choices'][number]['outcomes']): ResolveEventOutcomePayload[] {
  return outcomes.map((outcome) => {
    const payload: ResolveEventOutcomePayload = {
      id: outcome.id,
      weight: outcome.weight,
      effects: outcome.effects,
    };
    if (outcome.addTags !== undefined) payload.addTags = outcome.addTags;
    if (outcome.removeTags !== undefined) payload.removeTags = outcome.removeTags;
    return payload;
  });
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
});
