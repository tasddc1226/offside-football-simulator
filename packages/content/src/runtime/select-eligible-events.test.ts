import { describe, expect, it } from 'vitest';
import type { CareerState, Offer } from '@offside/domain';
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

type ReservedPresentation = 'INJURY' | 'NATIONAL_TEAM' | 'RUMOUR';
type GeneralPresentation = 'SLUMP' | 'LOCKER_ROOM' | 'ETHICS' | 'MEDIA';

function makePresentationChoice(
  id: 'A' | 'B',
  presentation: ReservedPresentation,
): EventDefinition['choices'][number] {
  return {
    id,
    label: `선택 ${id}`,
    riskLabel: 'LOW',
    previewEffects: [{ label: '효과' }],
    outcomes: [{ id: `${id}1`, kind: 'FIXED', weight: 100, title: '결과', effects: [] }],
    ...(presentation === 'INJURY'
      ? { rehabPlan: 'STANDARD' as const }
      : presentation === 'NATIONAL_TEAM'
        ? { callUp: 'ACCEPT' as const }
        : {}),
  };
}

function makePresentationEvent(id: string, presentation: ReservedPresentation | GeneralPresentation): EventDefinition {
  if (presentation === 'INJURY' || presentation === 'NATIONAL_TEAM' || presentation === 'RUMOUR') {
    return makeEvent({
      id,
      presentation,
      choices: [makePresentationChoice('A', presentation), makePresentationChoice('B', presentation)],
    });
  }
  return makeEvent({ id, presentation });
}

function makeFollowUpSource(id: string, followUpEventId: string): EventDefinition {
  return makeEvent({
    id,
    choices: [
      {
        id: 'A',
        label: '선택 A',
        riskLabel: 'LOW',
        previewEffects: [{ label: '효과' }],
        outcomes: [
          {
            id: 'A1',
            kind: 'FIXED',
            weight: 100,
            title: '결과',
            effects: [],
            followUps: [{ eventId: followUpEventId }],
          },
        ],
      },
      {
        id: 'B',
        label: '선택 B',
        riskLabel: 'LOW',
        previewEffects: [{ label: '효과' }],
        outcomes: [{ id: 'B1', kind: 'FIXED', weight: 100, title: '결과', effects: [] }],
      },
    ],
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

  it('steps cooldown은 시즌 경계에서도 career step을 이어서 센다(step 10→다음 시즌 1은 3, 2는 4)', () => {
    const event = makeEvent({ id: 'EVT-DEV-916', cooldown: { steps: 4 } });
    const timeline = [
      timelineEntry({ kind: 'EVENT_RESOLVED', refId: `${event.id}:A:A1`, step: 10 }),
      timelineEntry({ kind: 'SEASON_SETTLED', refId: null, step: 12, revision: 2 }),
    ];
    const pack = makeContentPack([event]);

    expect(
      selectEligibleEvents(pack, buildTestState({ currentStep: 1, resolvedEventIds: [event.id], timeline })),
    ).toEqual([]);
    expect(
      selectEligibleEvents(pack, buildTestState({ currentStep: 2, resolvedEventIds: [event.id], timeline })),
    ).toEqual([{ eventId: event.id, version: 1, weight: 10 }]);
  });

  it('steps cooldown은 여러 결산 경계를 누적해 결정론적으로 해제한다', () => {
    const event = makeEvent({ id: 'EVT-DEV-917', cooldown: { steps: 26 } });
    const timeline = [
      timelineEntry({ kind: 'EVENT_RESOLVED', refId: `${event.id}:A:A1`, step: 10 }),
      timelineEntry({ kind: 'SEASON_SETTLED', refId: null, step: 12, revision: 2 }),
      timelineEntry({ kind: 'SEASON_SETTLED', refId: null, step: 12, revision: 3 }),
    ];
    const pack = makeContentPack([event]);

    expect(
      selectEligibleEvents(pack, buildTestState({ currentStep: 11, resolvedEventIds: [event.id], timeline })),
    ).toEqual([]);
    expect(
      selectEligibleEvents(pack, buildTestState({ currentStep: 12, resolvedEventIds: [event.id], timeline })),
    ).toEqual([{ eventId: event.id, version: 1, weight: 10 }]);
  });

  it('seasons cooldown은 기존처럼 마지막 해소 뒤 SEASON_SETTLED 횟수로 해제한다', () => {
    const event = makeEvent({ id: 'EVT-DEV-918', cooldown: { seasons: 2 } });
    const pack = makeContentPack([event]);
    const resolved = timelineEntry({ kind: 'EVENT_RESOLVED', refId: `${event.id}:A:A1`, step: 10 });
    const oneSeason = [resolved, timelineEntry({ kind: 'SEASON_SETTLED', refId: null, step: 12, revision: 2 })];
    const twoSeasons = [
      ...oneSeason,
      timelineEntry({ kind: 'SEASON_SETTLED', refId: null, step: 12, revision: 3 }),
    ];

    expect(
      selectEligibleEvents(pack, buildTestState({ currentStep: 1, resolvedEventIds: [event.id], timeline: oneSeason })),
    ).toEqual([]);
    expect(
      selectEligibleEvents(pack, buildTestState({ currentStep: 1, resolvedEventIds: [event.id], timeline: twoSeasons })),
    ).toEqual([{ eventId: event.id, version: 1, weight: 10 }]);
  });

  it('나이가 minAge~maxAge를 벗어나면 제외한다', () => {
    const pack = makeContentPack([makeEvent({ id: 'EVT-DEV-904', minAge: 18, maxAge: 20 })]);
    expect(selectEligibleEvents(pack, buildTestState({ age: 17 }))).toEqual([]);
    expect(selectEligibleEvents(pack, buildTestState({ age: 19 }))).toEqual([
      { eventId: 'EVT-DEV-904', version: 1, weight: 10 },
    ]);
  });

  // T-4-003 D-52: INJURY/NATIONAL_TEAM/RUMOUR만 전용 pending 생성기가 소비하고 일반 슬롯에서 제외한다.
  it.each([
    { presentation: 'INJURY' as const, id: 'EVT-DEV-905' },
    { presentation: 'NATIONAL_TEAM' as const, id: 'EVT-DEV-906' },
  ])('전용 presentation %s는 trigger를 통과해도 일반 후보에서 제외한다', ({ presentation, id }) => {
    const pack = makeContentPack([makePresentationEvent(id, presentation)]);
    expect(selectEligibleEvents(pack, buildTestState())).toEqual([]);
  });

  it.each([
    { presentation: 'INJURY' as const, candidateId: 'EVT-DEV-908' },
    { presentation: 'NATIONAL_TEAM' as const, candidateId: 'EVT-DEV-909' },
  ])('전용 presentation %s는 followUp 후보에서도 제외한다', ({ presentation, candidateId }) => {
    const source = makeFollowUpSource('EVT-DEV-911', candidateId);
    const candidate = makePresentationEvent(candidateId, presentation);
    const state = buildTestState({
      resolvedEventIds: [source.id],
      timeline: [timelineEntry({ kind: 'EVENT_RESOLVED', refId: `${source.id}:A:A1` })],
    });

    expect(selectEligibleEvents(makeContentPack([source, candidate]), state)).toEqual([]);
  });

  it('RUMOUR는 step 7 window의 빈 CONTRACT 체크포인트에서만 기존 trigger 평가를 통과한다', () => {
    const event = EventDefinitionSchema.parse({
      ...makePresentationEvent('EVT-DEV-907', 'RUMOUR'),
      phases: ['TRANSFER_WINDOW'],
      triggers: { eq: ['career.stage', 'PRO'] },
    });
    const checkpoint = buildTestState({
      stage: 'PRO',
      season: { currentStep: 7, steps: [{ index: 7, windowOpen: true }], matches: [] } as unknown as CareerState['season'],
      pending: {
        kind: 'CONTRACT',
        step: 7,
        offers: [],
        market: { openedAtRevision: 1, seasonIndex: 1, reason: 'PRE_NEGOTIATION', safeOfferId: null },
      },
    });
    expect(selectEligibleEvents(makeContentPack([event]), checkpoint)).toEqual([
      { eventId: event.id, version: 1, weight: 10, slot: 'TRANSFER_WINDOW' },
    ]);
    expect(
      selectEligibleEvents(makeContentPack([event]), {
        ...checkpoint,
        pending: {
          kind: 'CONTRACT',
          step: 7,
          offers: [{ id: 'offer' } as Offer],
          market: { openedAtRevision: 1, seasonIndex: 1, reason: 'PRE_NEGOTIATION', safeOfferId: null },
        } as unknown as CareerState['pending'],
      }),
    ).toEqual([]);
    expect(selectEligibleEvents(makeContentPack([event]), { ...checkpoint, pending: { kind: 'EVENT', eventId: event.id, version: 1 } })).toEqual([]);
  });

  it.each(['SLUMP', 'LOCKER_ROOM', 'ETHICS', 'MEDIA'] as const)(
    '%s는 일반 후보에서 trigger 불일치는 제외하고 일치하면 포함한다',
    (presentation) => {
      const event = EventDefinitionSchema.parse({
        ...makePresentationEvent('EVT-DEV-912', presentation),
        triggers: { eq: ['career.age', 18] },
      });
      expect(selectEligibleEvents(makeContentPack([event]), buildTestState({ age: 17 }))).toEqual([]);
      expect(selectEligibleEvents(makeContentPack([event]), buildTestState({ age: 18 }))).toEqual([
        { eventId: event.id, version: 1, weight: 10 },
      ]);
    },
  );

  it.each(['SLUMP', 'LOCKER_ROOM', 'ETHICS', 'MEDIA'] as const)(
    '%s는 일반 후보에서 trigger와 cooldown 규칙을 따른다',
    (presentation) => {
      const event = makePresentationEvent('EVT-DEV-913', presentation);
      const withCooldown = EventDefinitionSchema.parse({ ...event, cooldown: { steps: 3 } });
      const resolvedAtStepZero = [timelineEntry({ kind: 'EVENT_RESOLVED', refId: `${event.id}:A:A1`, step: 0 })];

      expect(
        selectEligibleEvents(
          makeContentPack([withCooldown]),
          buildTestState({ currentStep: 2, resolvedEventIds: [event.id], timeline: resolvedAtStepZero }),
        ),
      ).toEqual([]);
      expect(
        selectEligibleEvents(
          makeContentPack([withCooldown]),
          buildTestState({ currentStep: 3, resolvedEventIds: [event.id], timeline: resolvedAtStepZero }),
        ),
      ).toEqual([{ eventId: event.id, version: 1, weight: 10 }]);
    },
  );

  it.each(['SLUMP', 'LOCKER_ROOM', 'ETHICS', 'MEDIA'] as const)(
    '%s는 followUp 후보로 포함되고 followUp에서는 trigger를 우회한다',
    (presentation) => {
      const candidate = makePresentationEvent('EVT-DEV-914', presentation);
      const candidateWithImpossibleTrigger = EventDefinitionSchema.parse({
        ...candidate,
        triggers: { eq: ['career.age', 99] },
      });
      const source = makeFollowUpSource('EVT-DEV-915', candidate.id);
      const state = buildTestState({
        resolvedEventIds: [source.id],
        timeline: [timelineEntry({ kind: 'EVENT_RESOLVED', refId: `${source.id}:A:A1` })],
      });

      expect(selectEligibleEvents(makeContentPack([source, candidateWithImpossibleTrigger]), state)).toEqual([
        { eventId: candidate.id, version: 1, weight: 10 },
      ]);
    },
  );

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
