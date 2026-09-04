import { describe, expect, it } from 'vitest';
import { EventDefinitionSchema, type EventDefinition } from '../schema/event.ts';
import type { PackManifest } from '../schema/pack.ts';
import type { NarrativeDictionary } from '../schema/narrative.ts';
import { loadContentPack } from '../packs/load-content-pack.ts';
import type { ContentPack } from '../packs/load-content-pack.ts';
import { selectEligibleEvents } from './select-eligible-events.ts';
import { buildTestState, timelineEntry, TEST_DRAFT, TEST_PROFILE } from './build-test-state.ts';

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

/** selectEligibleEvents는 events/eventsById만 읽는다. manifest·narrativeTokens·chapters는 최소값으로 채운다. */
function makeContentPack(events: EventDefinition[]): ContentPack {
  return {
    manifest: MINIMAL_MANIFEST,
    events,
    eventsById: new Map(events.map((event) => [event.id, event])),
    chapters: [],
    chaptersById: new Map(),
    narrativeTokens: MINIMAL_NARRATIVE,
  };
}

function makeEvent(overrides: Partial<EventDefinition> & Pick<EventDefinition, 'id'>): EventDefinition {
  return EventDefinitionSchema.parse({
    version: 1,
    phases: ['YOUTH'],
    triggers: { eq: ['career.stage', 'YOUTH'] },
    exclusionTags: [],
    weight: 10,
    safety: { minorSafe: true },
    choices: [
      {
        id: 'A',
        label: '선택 A',
        riskLabel: 'LOW',
        previewEffects: [{ label: '효과' }],
        outcomes: [{ id: 'A1', kind: 'FIXED', weight: 100, title: '결과', effects: [] }],
      },
      {
        id: 'B',
        label: '선택 B',
        riskLabel: 'LOW',
        previewEffects: [{ label: '효과' }],
        outcomes: [{ id: 'B1', kind: 'FIXED', weight: 100, title: '결과', effects: [] }],
      },
    ],
    narrative: { situation: '상황' },
    ...overrides,
  });
}

describe('selectEligibleEvents: content 0.1.0 팩 골든', () => {
  it('확정 직후(YOUTH·17·SETTLEMENT·태그 없음)엔 EVT-CON-002만 나온다', () => {
    const pack = loadContentPack('0.1.0');
    const state = buildTestState();
    expect(selectEligibleEvents(pack, state)).toEqual([{ eventId: 'EVT-CON-002', version: 1, weight: 10 }]);
  });

  it('CON-002 A 해소 직후(baseOvr 59)엔 followUp으로 EVT-CON-003만 나온다', () => {
    const pack = loadContentPack('0.1.0');
    const state = buildTestState({
      tags: ['진로_입단테스트'],
      resolvedEventIds: ['EVT-CON-002'],
      timeline: [timelineEntry({ kind: 'EVENT_RESOLVED', refId: 'EVT-CON-002:A:A1' })],
      player: { draft: TEST_DRAFT, profile: { ...TEST_PROFILE, baseOvr: 59 } },
    });
    expect(selectEligibleEvents(pack, state)).toEqual([{ eventId: 'EVT-CON-003', version: 1, weight: 10 }]);
  });

  it('CON-002 A 해소 직후(baseOvr 54)여도 followUp은 트리거를 보지 않아 그대로 EVT-CON-003이다', () => {
    const pack = loadContentPack('0.1.0');
    const state = buildTestState({
      tags: ['진로_입단테스트'],
      resolvedEventIds: ['EVT-CON-002'],
      timeline: [timelineEntry({ kind: 'EVENT_RESOLVED', refId: 'EVT-CON-002:A:A1' })],
      player: { draft: TEST_DRAFT, profile: { ...TEST_PROFILE, baseOvr: 54 } },
    });
    expect(selectEligibleEvents(pack, state)).toEqual([{ eventId: 'EVT-CON-003', version: 1, weight: 10 }]);
  });

  it('CON-003 해소 뒤엔 더 이상 제시할 이벤트가 없다', () => {
    const pack = loadContentPack('0.1.0');
    const state = buildTestState({
      tags: ['진로_입단테스트', '입단테스트_완료', '테스트_성공'],
      resolvedEventIds: ['EVT-CON-002', 'EVT-CON-003'],
      timeline: [
        timelineEntry({ kind: 'EVENT_RESOLVED', refId: 'EVT-CON-002:A:A1' }),
        timelineEntry({ kind: 'EVENT_RESOLVED', refId: 'EVT-CON-003:A:A1' }),
      ],
    });
    expect(selectEligibleEvents(pack, state)).toEqual([]);
  });

  it('pending이 있으면 항상 빈 배열이다', () => {
    const pack = loadContentPack('0.1.0');
    const state = buildTestState({ pending: { kind: 'EVENT', eventId: 'EVT-CON-002', version: 1 } });
    expect(selectEligibleEvents(pack, state)).toEqual([]);
  });

  it('status가 ACTIVE가 아니면(DRAFT) 빈 배열이다', () => {
    const pack = loadContentPack('0.1.0');
    const state = buildTestState({ status: 'DRAFT' });
    expect(selectEligibleEvents(pack, state)).toEqual([]);
  });
});

describe('selectEligibleEvents: 필터(합성 이벤트)', () => {
  it('exclusionTags와 state.tags가 겹치면 제외한다', () => {
    const pack = makeContentPack([makeEvent({ id: 'EVT-DEV-901', exclusionTags: ['제외_태그'] })]);
    const state = buildTestState({ tags: ['제외_태그'] });
    expect(selectEligibleEvents(pack, state)).toEqual([]);
  });

  it('resolvedEventIds에 있고 cooldown이 없으면 영구 제외(1회성)한다', () => {
    const pack = makeContentPack([makeEvent({ id: 'EVT-DEV-902' })]);
    const state = buildTestState({ resolvedEventIds: ['EVT-DEV-902'] });
    expect(selectEligibleEvents(pack, state)).toEqual([]);
  });

  it('cooldown이 있으면 steps 경과 전엔 제외되고 이후엔 다시 나온다', () => {
    const pack = makeContentPack([makeEvent({ id: 'EVT-DEV-903', cooldown: { steps: 3 } })]);
    const resolvedAtStepZero = [timelineEntry({ kind: 'EVENT_RESOLVED', refId: 'EVT-DEV-903:A:A1', step: 0 })];

    const stillCoolingDown = buildTestState({
      currentStep: 2,
      resolvedEventIds: ['EVT-DEV-903'],
      timeline: resolvedAtStepZero,
    });
    expect(selectEligibleEvents(pack, stillCoolingDown)).toEqual([]);

    const afterCooldown = buildTestState({
      currentStep: 3,
      resolvedEventIds: ['EVT-DEV-903'],
      timeline: resolvedAtStepZero,
    });
    expect(selectEligibleEvents(pack, afterCooldown)).toEqual([{ eventId: 'EVT-DEV-903', version: 1, weight: 10 }]);
  });

  it('나이가 minAge~maxAge를 벗어나면 제외한다', () => {
    const pack = makeContentPack([makeEvent({ id: 'EVT-DEV-904', minAge: 18, maxAge: 20 })]);
    expect(selectEligibleEvents(pack, buildTestState({ age: 17 }))).toEqual([]);
    expect(selectEligibleEvents(pack, buildTestState({ age: 19 }))).toEqual([
      { eventId: 'EVT-DEV-904', version: 1, weight: 10 },
    ]);
  });

  // T-3-001 D-52: presentation이 있는 정의는 일반 EVENT 후보에서 빠진다(해당 pending 생성기만 고른다).
  // T-4-001 D-52: presentation이 INJURY면 모든 choice에 rehabPlan이 필요하다(event.ts superRefine).
  it('presentation이 있는 정의는 트리거를 통과해도 일반 EVENT 후보에서 빠진다', () => {
    const pack = makeContentPack([
      makeEvent({
        id: 'EVT-DEV-905',
        presentation: 'INJURY',
        choices: [
          {
            id: 'A',
            label: '선택 A',
            riskLabel: 'LOW',
            previewEffects: [{ label: '효과' }],
            outcomes: [{ id: 'A1', kind: 'FIXED', weight: 100, title: '결과', effects: [] }],
            rehabPlan: 'STANDARD',
          },
          {
            id: 'B',
            label: '선택 B',
            riskLabel: 'LOW',
            previewEffects: [{ label: '효과' }],
            outcomes: [{ id: 'B1', kind: 'FIXED', weight: 100, title: '결과', effects: [] }],
            rehabPlan: 'EARLY',
          },
        ],
      }),
    ]);
    expect(selectEligibleEvents(pack, buildTestState())).toEqual([]);
  });

  it('결과는 eventId 오름차순으로 정렬된다', () => {
    const pack = makeContentPack([
      makeEvent({ id: 'EVT-DEV-902', weight: 5 }),
      makeEvent({ id: 'EVT-DEV-901', weight: 7 }),
    ]);
    expect(selectEligibleEvents(pack, buildTestState())).toEqual([
      { eventId: 'EVT-DEV-901', version: 1, weight: 7 },
      { eventId: 'EVT-DEV-902', version: 1, weight: 5 },
    ]);
  });
});
