// T-3-006: 팩 0.2.0이 새로 더한 PRO 이벤트 5개(EVT-CON-010~013, EVT-MEDIA-006)의 계약 테스트.
// 스키마 통과는 loadContentPack이 이미 강제하므로(파싱 실패 시 throw), 여기서는 그 위의 콘텐츠
// 불변식(태그 문자열·배타·효과 제한·RUMOUR 제외·PRO/YOUTH 트리거 분기)만 확인한다.
import { describe, expect, it } from 'vitest';
import type { EventDefinition } from '../../src/schema/event.ts';
import type { ContentPack } from '../../src/packs/load-content-pack.ts';
import type { NarrativeDictionary } from '../../src/schema/narrative.ts';
import type { PackManifest } from '../../src/schema/pack.ts';
import { loadContentPack } from '../../src/packs/load-content-pack.ts';
import { evaluateCondition, type ConditionContext } from '../../src/schema/condition.ts';
import { selectEligibleEvents } from '../../src/runtime/select-eligible-events.ts';
import { buildTestState } from '../../src/runtime/build-test-state.ts';
import { RELATION_TARGETS } from '../../src/schema/effect.ts';

const pack020 = loadContentPack('0.2.0');
const NEW_EVENT_IDS = ['EVT-CON-010', 'EVT-CON-011', 'EVT-CON-012', 'EVT-CON-013', 'EVT-MEDIA-006'] as const;

function getEvent(id: (typeof NEW_EVENT_IDS)[number]): EventDefinition {
  const event = pack020.eventsById.get(id);
  if (!event) throw new Error(`0.2.0 팩에 ${id}가 없다`);
  return event;
}

describe('0.2.0 새 이벤트 5개: 로드', () => {
  it.each(NEW_EVENT_IDS)('%s가 0.2.0 팩에서 스키마 통과 상태로 로드된다', (id) => {
    expect(getEvent(id).id).toBe(id);
  });

  it.each(NEW_EVENT_IDS)('%s는 authoring이 PROTOTYPE이다(U-013 (A))', (id) => {
    expect(getEvent(id).authoring).toBe('PROTOTYPE');
  });

  it.each(NEW_EVENT_IDS)('%s는 safety.minorSafe가 true다', (id) => {
    expect(getEvent(id).safety.minorSafe).toBe(true);
  });
});

describe('0.2.0 새 이벤트 5개: 태그 문자열 3종·배타', () => {
  const MARKET_TAGS = ['이적_희망', '잔류_선언', '에이전트_계약'] as const;

  it('EVT-CON-010의 선택지는 이적_희망 또는 잔류_선언 태그를 정확한 문자열로만 준다', () => {
    const event = getEvent('EVT-CON-010');
    const allAddTags = event.choices.flatMap((choice) => choice.outcomes.flatMap((outcome) => outcome.addTags ?? []));
    expect(allAddTags.sort()).toEqual(['이적_희망', '잔류_선언'].sort());
  });

  it('EVT-CON-011의 A 선택지는 에이전트_계약 태그를 정확한 문자열로 준다', () => {
    const event = getEvent('EVT-CON-011');
    const choiceA = event.choices.find((choice) => choice.id === 'A');
    expect(choiceA?.outcomes.flatMap((outcome) => outcome.addTags ?? [])).toEqual(['에이전트_계약']);
  });

  it('어떤 outcome도 이적_희망과 잔류_선언을 동시에 주지 않는다(전체 팩)', () => {
    for (const event of pack020.events) {
      for (const choice of event.choices) {
        for (const outcome of choice.outcomes) {
          const tags = new Set(outcome.addTags ?? []);
          const hasBoth = tags.has('이적_희망') && tags.has('잔류_선언');
          expect(hasBoth, `${event.id}.${choice.id}.${outcome.id}`).toBe(false);
        }
      }
    }
  });

  it('EVT-CON-010은 이적_희망/잔류_선언 부여 시 반대쪽 태그를 removeTags로 정리한다', () => {
    const event = getEvent('EVT-CON-010');
    const choiceA1 = event.choices.find((c) => c.id === 'A')?.outcomes.find((o) => o.id === 'A1');
    const choiceC1 = event.choices.find((c) => c.id === 'C')?.outcomes.find((o) => o.id === 'C1');
    expect(choiceA1?.addTags).toEqual(['이적_희망']);
    expect(choiceA1?.removeTags).toEqual(['잔류_선언']);
    expect(choiceC1?.addTags).toEqual(['잔류_선언']);
    expect(choiceC1?.removeTags).toEqual(['이적_희망']);
  });

  it('EVT-CON-012의 태그 부여 outcome은 이적_희망을 정확한 문자열로 쓴다', () => {
    const event = getEvent('EVT-CON-012');
    const taggedOutcomes = event.choices.flatMap((choice) => choice.outcomes.filter((outcome) => (outcome.addTags?.length ?? 0) > 0));
    expect(taggedOutcomes.flatMap((outcome) => outcome.addTags ?? [])).toContain('이적_희망');
    for (const tag of taggedOutcomes.flatMap((outcome) => outcome.addTags ?? [])) {
      if (tag === '이적_희망') expect(MARKET_TAGS as readonly string[]).toContain(tag);
    }
  });
});

describe('0.2.0 새 이벤트 5개: 효과 kind 제한·절댓값', () => {
  it.each(NEW_EVENT_IDS)('%s의 모든 effect kind는 RELATION·CURRENT·CONTEXT 중 하나다(PERMANENT·DEFERRED 금지)', (id) => {
    const event = getEvent(id);
    for (const choice of event.choices) {
      for (const outcome of choice.outcomes) {
        for (const effect of outcome.effects) {
          expect(['RELATION', 'CURRENT', 'CONTEXT']).toContain(effect.kind);
        }
      }
    }
  });

  it.each(NEW_EVENT_IDS)('%s의 RELATION effect delta 절댓값은 8 이하다', (id) => {
    const event = getEvent(id);
    for (const choice of event.choices) {
      for (const outcome of choice.outcomes) {
        for (const effect of outcome.effects) {
          if (effect.kind !== 'RELATION') continue;
          expect(RELATION_TARGETS as readonly string[]).toContain(effect.target);
          expect(Math.abs(effect.delta)).toBeLessThanOrEqual(8);
        }
      }
    }
  });

  it.each(NEW_EVENT_IDS)('%s의 모든 FAIL outcome에는 회복 경로가 있다(커리어를 끝내지 않음: PERMANENT 효과 없음)', (id) => {
    const event = getEvent(id);
    for (const choice of event.choices) {
      for (const outcome of choice.outcomes) {
        if (outcome.kind !== 'FAIL') continue;
        expect(outcome.effects.every((effect) => effect.kind !== 'PERMANENT')).toBe(true);
      }
    }
  });
});

describe('EVT-CON-010: presentation RUMOUR은 일반 EVENT 후보에서 빠진다', () => {
  const MINIMAL_MANIFEST: PackManifest = {
    contentPackVersion: '0.0.0-test',
    compatibleRulesetVersions: ['1.0.0'],
    clientMinVersion: '0.0.0-test',
    playtested: false,
    checksum: '0'.repeat(64),
    files: [],
  };
  const MINIMAL_NARRATIVE: NarrativeDictionary = {
    name: ['x'],
    club: ['x'],
    manager: ['x'],
    rival: ['x'],
    captain: ['x'],
    team: ['x'],
    agent: ['x'],
    delta: [],
  };

  function isolatedPack(event: EventDefinition): ContentPack {
    return {
      manifest: MINIMAL_MANIFEST,
      events: [event],
      eventsById: new Map([[event.id, event]]),
      chapters: [],
      chaptersById: new Map(),
      narrativeTokens: MINIMAL_NARRATIVE,
    };
  }

  it('EVT-CON-010은 presentation이 RUMOUR다', () => {
    expect(getEvent('EVT-CON-010').presentation).toBe('RUMOUR');
  });

  it('트리거가 통과할 조건이어도 selectEligibleEvents 결과에 EVT-CON-010이 없다', () => {
    const event = getEvent('EVT-CON-010');
    const state = buildTestState({
      stage: 'PRO',
      seasonPhase: 'TRANSFER_WINDOW',
      currentStep: 7,
      contract: {
        id: 'CTR-test',
        offerId: 'OFR-test',
        teamId: 'seorabeol-united',
        teamName: '서라벌 유나이티드',
        leagueTier: 1,
        lengthSeasons: 3,
        wageMinorPerWeek: 1000000,
        signingBonusMinor: 0,
        rolePromise: 'STARTER',
        shirtNumber: 9,
        signatureType: 'AUTO',
        signedAtRevision: 1,
        kind: 'PERMANENT',
        appearancePromise: { minutesShareBp: 6500 },
        positionPlan: 'W',
        suspended: false,
        loan: null,
        promiseBreaches: 0,
        signedSeasonIndex: 1,
      },
    });
    expect(selectEligibleEvents(isolatedPack(event), state)).toEqual([]);
  });
});

describe('0.2.0 새 이벤트 4개(RUMOUR 제외): PRO 합성 상태에서 트리거 통과, YOUTH 상태에서 불통과', () => {
  it('EVT-CON-011: proSeasons>=1·태그 없음이면 PRO에서 통과, YOUTH면 실패', () => {
    const triggers = getEvent('EVT-CON-011').triggers;
    const proContext: ConditionContext = { 'career.stage': 'PRO', 'career.proSeasons': 1, 'career.tags': [] };
    const youthContext: ConditionContext = { 'career.stage': 'YOUTH', 'career.proSeasons': 1, 'career.tags': [] };
    expect(evaluateCondition(triggers, proContext)).toBe(true);
    expect(evaluateCondition(triggers, youthContext)).toBe(false);
  });

  it('EVT-CON-012: promiseBreaches>=1·step<=3이면 PRO에서 통과, YOUTH면 실패', () => {
    const triggers = getEvent('EVT-CON-012').triggers;
    const proContext: ConditionContext = { 'career.stage': 'PRO', 'contract.promiseBreaches': 1, 'season.step': 2 };
    const youthContext: ConditionContext = { 'career.stage': 'YOUTH', 'contract.promiseBreaches': 1, 'season.step': 2 };
    expect(evaluateCondition(triggers, proContext)).toBe(true);
    expect(evaluateCondition(triggers, youthContext)).toBe(false);
  });

  it('EVT-CON-013: seasonsRemaining<=1·PERMANENT·step 4~6이면 PRO에서 통과, YOUTH면 실패', () => {
    const triggers = getEvent('EVT-CON-013').triggers;
    const proContext: ConditionContext = {
      'career.stage': 'PRO',
      'contract.seasonsRemaining': 1,
      'contract.kind': 'PERMANENT',
      'season.step': 5,
    };
    const youthContext: ConditionContext = { ...proContext, 'career.stage': 'YOUTH' };
    expect(evaluateCondition(triggers, proContext)).toBe(true);
    expect(evaluateCondition(triggers, youthContext)).toBe(false);
  });

  it('EVT-MEDIA-006: permanentTransfers>=1·LEAGUE면 PRO에서 통과, YOUTH면 실패', () => {
    const triggers = getEvent('EVT-MEDIA-006').triggers;
    const proContext: ConditionContext = {
      'career.stage': 'PRO',
      'career.permanentTransfers': 1,
      'season.phase': 'LEAGUE',
    };
    const youthContext: ConditionContext = { ...proContext, 'career.stage': 'YOUTH' };
    expect(evaluateCondition(triggers, proContext)).toBe(true);
    expect(evaluateCondition(triggers, youthContext)).toBe(false);
  });
});
