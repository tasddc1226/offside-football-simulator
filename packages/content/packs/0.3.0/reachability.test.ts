import { describe, expect, it } from 'vitest';
import { simulate, type Command, type DomainSnapshot, type Effect, type SimulationResult } from '@offside/domain';
import type { EventDefinition } from '../../src/schema/event.ts';
import type { ChapterDefinition } from '../../src/schema/chapter.ts';
import { loadContentPack, type ContentPack } from '../../src/packs/load-content-pack.ts';
import { loadRuleset } from '../../src/rulesets/load-ruleset.ts';
import { selectEligibleEvents } from '../../src/runtime/select-eligible-events.ts';
import { selectChapterCandidates } from '../../src/runtime/select-chapter-candidates.ts';

// T-4-008 2절: seed 500개 x 2시즌(청소년 시즌 진입 전 온보딩 포함) 실제 CHAPTER 모드 재생으로
// 이번 작업이 새로 더한 이벤트 12개·챕터 3개가 실제 selectEligibleEvents/selectChapterCandidates
// + domain simulate 조합에서 최소 1회 "선택"(pending으로 실제 제시)되는지 센다. 팩·룰셋만 실행하고
// 선택은 매 pending마다 시드 기반 의사난수로 다양화한다(항상 같은 choice만 고르면 특정 trigger가
// 우연히도 계속 만족되거나 계속 실패할 수 있어 표본이 편향된다).

const RULESET_VERSION = '1.0.0';
const CONTENT_PACK_VERSION = '0.3.0';
const SEED_COUNT = 500;
const SEASONS_PER_SEED = 2;

const NEW_EVENT_IDS = [
  'EVT-INJ-003',
  'EVT-INJ-004',
  'EVT-REL-003',
  'EVT-REL-005',
  'EVT-REL-008',
  'EVT-MGR-003',
  'EVT-MGR-004',
  'EVT-SLUMP-011',
  'EVT-ETH-011',
  'EVT-MEDIA-002',
  'EVT-MEDIA-004',
  'EVT-NAT-002',
] as const;

const NEW_CHAPTER_IDS = ['CHP-MATCH-005', 'CHP-MATCH-006', 'CHP-MATCH-007'] as const;

// 포지션군 3종(GK·DF·FW)이 모두 표본에 들도록 8 포지션 아키타입을 전부 순환한다.
const ARCHETYPE_IDS = [
  'gk-shot-stopper',
  'gk-sweeper-keeper',
  'gk-commander',
  'cb-stopper',
  'cb-ball-playing',
  'cb-aerial-dominator',
  'fb-overlapping',
  'fb-defensive',
  'fb-inverted',
  'dm-destroyer',
  'dm-deep-lying-playmaker',
  'dm-box-to-box',
  'cm-playmaker',
  'cm-box-to-box',
  'cm-advanced',
  'am-playmaker',
  'am-shadow-striker',
  'am-wide-creator',
  'inside-forward',
  'w-touchline-winger',
  'w-inverted-winger',
  'st-poacher',
  'st-target-man',
  'st-false-nine',
] as const;

const BACKGROUND_IDS = ['club-academy', 'school', 'street'] as const;

type CommandInput = Command & { commandId: string; expectedRevision: number };
type ResolveEventOutcomePayload = Extract<Command, { type: 'RESOLVE_EVENT' }>['payload']['outcomes'][number];
type ResolveChapterOutcomePayload = Extract<Command, { type: 'RESOLVE_CHAPTER' }>['payload']['outcomes'][number];

/** apps/web career-actions.ts toResolveEventOutcomes와 같은 매핑. */
function toResolveEventOutcomes(outcomes: EventDefinition['choices'][number]['outcomes']): ResolveEventOutcomePayload[] {
  return outcomes.map((outcome) => {
    const payload: ResolveEventOutcomePayload = { id: outcome.id, kind: outcome.kind, weight: outcome.weight, effects: outcome.effects as Effect[] };
    if (outcome.addTags !== undefined) payload.addTags = outcome.addTags;
    if (outcome.removeTags !== undefined) payload.removeTags = outcome.removeTags;
    return payload;
  });
}

/** apps/web career-actions.ts toResolveChapterOutcomes와 같은 매핑. */
function toResolveChapterOutcomes(
  outcomes: ChapterDefinition['decisions'][number]['options'][number]['outcomes'],
): ResolveChapterOutcomePayload[] {
  return outcomes.map((outcome) => {
    const payload: ResolveChapterOutcomePayload = {
      id: outcome.id,
      kind: outcome.kind,
      weight: outcome.weight,
      effects: outcome.effects as Effect[],
      ratingDeltaTenths: outcome.ratingDeltaTenths,
    };
    if (outcome.addTags !== undefined) payload.addTags = outcome.addTags;
    if (outcome.removeTags !== undefined) payload.removeTags = outcome.removeTags;
    return payload;
  });
}

/** 시드 문자열 + 카운터를 0 이상 정수로 흩뿌리는 결정론적 의사난수(암호학적 강도 불필요, 표본 다양화 목적). */
function pseudoRandomIndex(seedLabel: string, counter: number, modulus: number): number {
  let hash = 2166136261;
  const input = `${seedLabel}:${counter}`;
  for (let i = 0; i < input.length; i += 1) {
    hash = Math.imul(hash ^ input.charCodeAt(i), 16777619);
  }
  const positive = hash >>> 0;
  return modulus <= 0 ? 0 : positive % modulus;
}

function runOrThrow(snapshot: DomainSnapshot | null, command: CommandInput, ruleset: ReturnType<typeof loadRuleset>): DomainSnapshot {
  const result: SimulationResult = simulate({ snapshot, command, ruleset, rulesetVersion: RULESET_VERSION, contentPackVersion: CONTENT_PACK_VERSION });
  if (!result.ok) {
    throw new Error(`${command.type} 실패: ${result.error.code} ${result.error.message}`);
  }
  return result.snapshot;
}

type Tally = { eligible: Record<string, number>; chosen: Record<string, number>; chaptersChosen: Record<string, number> };

function makeTally(): Tally {
  const eligible: Record<string, number> = {};
  const chosen: Record<string, number> = {};
  const chaptersChosen: Record<string, number> = {};
  for (const id of NEW_EVENT_IDS) {
    eligible[id] = 0;
    chosen[id] = 0;
  }
  for (const id of NEW_CHAPTER_IDS) {
    chaptersChosen[id] = 0;
  }
  return { eligible, chosen, chaptersChosen };
}

/**
 * CREATE_CAREER부터 SEASONS_PER_SEED 시즌 결산까지 CHAPTER 모드로 실제 재생하며, 매 pending을
 * 실제 팩 정의의 choice/option으로 해소한다(seed별 의사난수로 선택을 다양화). 모든 pending
 * 종류(EVENT·CHAPTER·OFFERS·CONTRACT·ROLE_PROPOSAL·INJURY·NATIONAL_TEAM·LOAN_RETURN·SETTLEMENT)를
 * 실제 명령으로 닫는다.
 */
function playSeeded(seedLabel: string, pack: ContentPack, ruleset: ReturnType<typeof loadRuleset>, tally: Tally): void {
  let counter = 0;
  const newId = () => `reach-${seedLabel}-${counter++}`;
  let snapshot: DomainSnapshot;
  const withMeta = (command: Command): CommandInput => ({ ...command, commandId: newId(), expectedRevision: snapshot.revision });

  snapshot = runOrThrow(
    null,
    { type: 'CREATE_CAREER', commandId: newId(), expectedRevision: 0, payload: { careerId: `car_${seedLabel}`, seed: seedLabel, simulationMode: 'CHAPTER', rulesetVersion: RULESET_VERSION, contentPackVersion: CONTENT_PACK_VERSION } },
    ruleset,
  );

  const archetypeId = ARCHETYPE_IDS[pseudoRandomIndex(seedLabel, -1, ARCHETYPE_IDS.length)]!;
  const archetype = ruleset.archetypes.find((candidate) => candidate.id === archetypeId);
  if (archetype === undefined) throw new RangeError(`archetypeId '${archetypeId}'가 룰셋에 없다.`);
  const backgroundId = BACKGROUND_IDS[pseudoRandomIndex(seedLabel, -2, BACKGROUND_IDS.length)]!;

  snapshot = runOrThrow(snapshot, withMeta({ type: 'UPDATE_PLAYER_DRAFT', payload: { draft: { name: '도달성', gender: 'UNSPECIFIED', nationalityCode: 'KR', preferredFoot: 'RIGHT' } } }), ruleset);
  snapshot = runOrThrow(snapshot, withMeta({ type: 'UPDATE_PLAYER_DRAFT', payload: { draft: { position: archetype.position, archetypeId, backgroundId } } }), ruleset);
  snapshot = runOrThrow(snapshot, withMeta({ type: 'CONFIRM_PLAYER', payload: {} }), ruleset);

  function pickEventChoice(definition: EventDefinition, stepCounter: number) {
    const index = pseudoRandomIndex(seedLabel, stepCounter, definition.choices.length);
    return definition.choices[index]!;
  }

  function recordEligible(state: DomainSnapshot['state']): { eligibleEvents: ReturnType<typeof selectEligibleEvents>; chapterCandidates: ReturnType<typeof selectChapterCandidates> } {
    const eligibleEvents = selectEligibleEvents(pack, state);
    for (const candidate of eligibleEvents) {
      if (candidate.eventId in tally.eligible) tally.eligible[candidate.eventId] = (tally.eligible[candidate.eventId] ?? 0) + 1;
    }
    const chapterCandidates = selectChapterCandidates(pack, state);
    return { eligibleEvents, chapterCandidates };
  }

  // 단일 상태기계 루프: season===null이면 온보딩/시즌 사이(시장 등) 국면, season!==null이면
  // 시즌 진행 중. seasonsSettled가 SEASONS_PER_SEED에 이르면 멈춘다. 결산 직후 openMarketAfterSettlement가
  // OFFERS/CONTRACT pending을 남길 수 있어(START_SEASON은 그 pending을 그대로 두면 MARKET_OPEN으로
  // 실패한다) 시즌 시작 전에도 같은 pending 처리 분기를 그대로 통과시킨다.
  let seasonsSettled = 0;
  let seasonIndex = 0;
  for (let guard = 0; guard < 600 && snapshot.state.status === 'ACTIVE' && seasonsSettled < SEASONS_PER_SEED; guard += 1) {
    const pending = snapshot.state.pending;

    if (pending === null) {
      if (snapshot.state.season === null) {
        if (snapshot.state.contract === null) {
          const { eligibleEvents } = recordEligible(snapshot.state);
          snapshot = runOrThrow(snapshot, withMeta({ type: 'ADVANCE', payload: { eligibleEvents } }), ruleset);
          continue;
        }
        snapshot = runOrThrow(snapshot, withMeta({ type: 'START_SEASON', payload: { simulationMode: 'CHAPTER', serviceSeasonId: `svc-${seedLabel}-${seasonIndex}` } }), ruleset);
        seasonIndex += 1;
        continue;
      }
      const { eligibleEvents, chapterCandidates } = recordEligible(snapshot.state);
      snapshot = runOrThrow(snapshot, withMeta({ type: 'ADVANCE', payload: { eligibleEvents, chapterCandidates } }), ruleset);
      continue;
    }

    if (pending.kind === 'SETTLEMENT') {
      snapshot = runOrThrow(snapshot, withMeta({ type: 'SETTLE_SEASON', payload: {} }), ruleset);
      seasonsSettled += 1;
      continue;
    }
    if (pending.kind === 'ROLE_PROPOSAL') {
      snapshot = runOrThrow(snapshot, withMeta({ type: 'RESOLVE_ROLE', payload: { decision: 'ACCEPT' } }), ruleset);
      continue;
    }
    if (pending.kind === 'EVENT') {
      if (pending.eventId in tally.chosen) tally.chosen[pending.eventId] = (tally.chosen[pending.eventId] ?? 0) + 1;
      const definition = pack.eventsById.get(pending.eventId);
      if (definition === undefined) throw new Error(`팩에 이벤트 정의가 없다: ${pending.eventId}`);
      const choice = pickEventChoice(definition, guard);
      snapshot = runOrThrow(snapshot, withMeta({ type: 'RESOLVE_EVENT', payload: { eventId: definition.id, definitionVersion: definition.version, choiceId: choice.id, outcomes: toResolveEventOutcomes(choice.outcomes) } }), ruleset);
      continue;
    }
    if (pending.kind === 'CHAPTER') {
      if (pending.chapterId in tally.chaptersChosen) tally.chaptersChosen[pending.chapterId] = (tally.chaptersChosen[pending.chapterId] ?? 0) + 1;
      const definition = pack.chaptersById.get(pending.chapterId);
      if (definition === undefined) throw new Error(`팩에 챕터 정의가 없다: ${pending.chapterId}`);
      const decision = definition.decisions[pending.resolved.length];
      if (decision === undefined) throw new Error(`챕터 ${pending.chapterId}의 decisionIndex ${pending.resolved.length}가 정의를 벗어난다.`);
      const optionIndex = pseudoRandomIndex(seedLabel, guard, decision.options.length);
      const option = decision.options[optionIndex]!;
      snapshot = runOrThrow(snapshot, withMeta({ type: 'RESOLVE_CHAPTER', payload: { chapterId: definition.id, definitionVersion: definition.version, decisionId: decision.id, optionId: option.id, outcomes: toResolveChapterOutcomes(option.outcomes) } }), ruleset);
      continue;
    }
    if (pending.kind === 'INJURY') {
      const definition = pack.eventsById.get(pending.eventId);
      if (definition === undefined) throw new Error(`팩에 INJURY 이벤트 정의가 없다: ${pending.eventId}`);
      const choice = pickEventChoice(definition, guard);
      if (choice.rehabPlan === undefined) throw new Error(`INJURY choice에 rehabPlan이 없다: ${definition.id}.${choice.id}`);
      snapshot = runOrThrow(snapshot, withMeta({ type: 'RESOLVE_EVENT', payload: { eventId: definition.id, definitionVersion: definition.version, choiceId: choice.id, outcomes: toResolveEventOutcomes(choice.outcomes), rehabPlan: choice.rehabPlan } }), ruleset);
      continue;
    }
    if (pending.kind === 'NATIONAL_TEAM') {
      const definition = pack.eventsById.get(pending.eventId);
      if (definition === undefined) throw new Error(`팩에 NATIONAL_TEAM 이벤트 정의가 없다: ${pending.eventId}`);
      const choice = pickEventChoice(definition, guard);
      if (choice.callUp === undefined) throw new Error(`NATIONAL_TEAM choice에 callUp이 없다: ${definition.id}.${choice.id}`);
      snapshot = runOrThrow(snapshot, withMeta({ type: 'RESOLVE_EVENT', payload: { eventId: definition.id, definitionVersion: definition.version, choiceId: choice.id, outcomes: toResolveEventOutcomes(choice.outcomes), callUp: choice.callUp } }), ruleset);
      continue;
    }
    if (pending.kind === 'CONTRACT') {
      if (pending.offers.length > 0) {
        snapshot = runOrThrow(snapshot, withMeta({ type: 'REJECT_OFFER', payload: { offerId: null } }), ruleset);
      } else {
        snapshot = runOrThrow(snapshot, withMeta({ type: 'ADVANCE', payload: { eligibleEvents: [] } }), ruleset);
      }
      continue;
    }
    if (pending.kind === 'LOAN_RETURN') {
      const option = pending.options[pseudoRandomIndex(seedLabel, guard, Math.max(1, pending.options.length))] ?? 'RETURN';
      snapshot = runOrThrow(snapshot, withMeta({ type: 'LOAN_RETURN', payload: { decision: option } }), ruleset);
      continue;
    }
    if (pending.kind === 'OFFERS') {
      if (snapshot.state.contract === null) {
        // 온보딩: 첫 계약이 없으면 커리어가 진행되지 않으므로 반드시 하나를 받아들인다.
        const offer = pending.offers[pseudoRandomIndex(seedLabel, guard, Math.max(1, pending.offers.length))];
        if (offer === undefined) throw new Error('OFFERS pending인데 offers가 비어 있다.');
        snapshot = runOrThrow(snapshot, withMeta({ type: 'ACCEPT_OFFER', payload: { offerId: offer.id } }), ruleset);
        continue;
      }
      // 시즌 사이 이적시장(재계약 실패 뒤 등)은 항상 거절하고 원소속에 남는다(수락하면 팀이 바뀌어
      // 관계·감독 신뢰가 리셋되고 표본 해석이 복잡해진다).
      snapshot = runOrThrow(snapshot, withMeta({ type: 'REJECT_OFFER', payload: { offerId: null } }), ruleset);
      continue;
    }
    throw new Error(`예상하지 못한 pending: ${JSON.stringify(pending)}`);
  }
}

describe('packs/0.3.0 도달성: seed 500개 x 2시즌', () => {
  it(
    '새 이벤트 12개·새 챕터 3개가 실제 CHAPTER 모드 재생에서 최소 1회 이상 선택된다',
    () => {
      const pack = loadContentPack(CONTENT_PACK_VERSION);
      const ruleset = loadRuleset(RULESET_VERSION);
      const tally = makeTally();
      const failures: string[] = [];

      for (let seedIndex = 0; seedIndex < SEED_COUNT; seedIndex += 1) {
        const seedLabel = `t4008-reach-${seedIndex}`;
        try {
          playSeeded(seedLabel, pack, ruleset, tally);
        } catch (error) {
          failures.push(`${seedLabel}: ${(error as Error).message}`);
        }
      }

      // 표본 재생 자체가 예외 없이 끝나야 아래 카운트를 신뢰할 수 있다.
      expect(failures.slice(0, 5)).toEqual([]);

      console.log('T-4-008 도달성 표(이벤트, eligible 횟수, chosen 횟수):');
      for (const id of NEW_EVENT_IDS) {
        console.log(`  ${id}: eligible=${tally.eligible[id]} chosen=${tally.chosen[id]}`);
      }
      console.log('T-4-008 도달성 표(챕터, chosen 횟수):');
      for (const id of NEW_CHAPTER_IDS) {
        console.log(`  ${id}: chosen=${tally.chaptersChosen[id]}`);
      }

      for (const id of NEW_EVENT_IDS) {
        expect(tally.chosen[id], `${id}이(가) 0회 선택됐다(eligible=${tally.eligible[id]})`).toBeGreaterThan(0);
      }
      for (const id of NEW_CHAPTER_IDS) {
        expect(tally.chaptersChosen[id], `${id}이(가) 0회 선택됐다`).toBeGreaterThan(0);
      }
    },
    300_000,
  );
});
