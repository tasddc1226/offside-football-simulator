import { describe, expect, it } from 'vitest';
import { simulate, type DomainSnapshot } from '@offside/domain';
import { loadContentPack } from '../../src/packs/load-content-pack.ts';
import { loadRuleset } from '../../src/rulesets/load-ruleset.ts';
import { buildTestState, timelineEntry, TEST_PROFILE } from '../../src/runtime/build-test-state.ts';
import { selectEligibleEvents } from '../../src/runtime/select-eligible-events.ts';

describe('packs/0.4.1 현실적 커리어 서사', () => {
  const pack = loadContentPack('0.4.1');
  const ruleset = loadRuleset('1.2.0');

  function advance(
    snapshot: DomainSnapshot,
    eligibleEvents: ReturnType<typeof selectEligibleEvents>,
  ) {
    return simulate({
      snapshot,
      command: {
        type: 'ADVANCE',
        commandId: `advance-${snapshot.revision}`,
        expectedRevision: snapshot.revision,
        payload: { eligibleEvents },
      },
      ruleset,
      rulesetVersion: '1.2.0',
      contentPackVersion: '0.4.1',
    });
  }

  function resolve(snapshot: DomainSnapshot, eventId: string, choiceId: 'A' | 'B') {
    const choice = pack.eventsById
      .get(eventId)
      ?.choices.find((candidate) => candidate.id === choiceId);
    if (!choice) throw new Error(`missing choice ${eventId}:${choiceId}`);
    return simulate({
      snapshot,
      command: {
        type: 'RESOLVE_EVENT',
        commandId: `resolve-${snapshot.revision}`,
        expectedRevision: snapshot.revision,
        payload: {
          eventId,
          definitionVersion: 1,
          choiceId,
          outcomes: choice.outcomes.map((outcome) => ({
            id: outcome.id,
            kind: outcome.kind,
            weight: outcome.weight,
            effects: outcome.effects,
            ...(outcome.addTags ? { addTags: outcome.addTags } : {}),
            ...(outcome.removeTags ? { removeTags: outcome.removeTags } : {}),
          })),
        },
      },
      ruleset,
      rulesetVersion: '1.2.0',
      contentPackVersion: '0.4.1',
    });
  }

  it('manifest와 런타임 registry의 이벤트·챕터가 일치한다', () => {
    const ids = (prefix: 'events/' | 'chapters/') =>
      pack.manifest.files
        .filter((file) => file.startsWith(prefix))
        .map((file) => file.slice(prefix.length, -'.json'.length))
        .sort();
    expect(pack.events.map((event) => event.id).sort()).toEqual(ids('events/'));
    expect(pack.chapters.map((chapter) => chapter.id).sort()).toEqual(ids('chapters/'));
  });

  it.each([
    ['club-academy', 'EVT-CON-020'],
    ['school', 'EVT-CON-021'],
    ['street', 'EVT-CON-022'],
  ] as const)('%s 배경에는 고유한 첫 PATH만 연다', (backgroundId, eventId) => {
    const state = buildTestState({
      age: 19,
      contentPackVersion: '0.4.1',
      player: {
        draft: { ...buildTestState().player.draft, backgroundId },
        profile: { ...TEST_PROFILE, backgroundId },
      },
    });

    expect(selectEligibleEvents(pack, state).map((event) => event.eventId)).toEqual([eventId]);
  });

  it('선택 결과를 저장한 뒤 전용 후속만 우선한다', () => {
    const state = buildTestState({
      age: 19,
      contentPackVersion: '0.4.1',
      tags: ['진로_학교_성인훈련'],
      resolvedEventIds: ['EVT-CON-021'],
      timeline: [timelineEntry({ kind: 'EVENT_RESOLVED', refId: 'EVT-CON-021:A:A1', age: 19 })],
      player: {
        draft: { ...buildTestState().player.draft, backgroundId: 'school' },
        profile: { ...TEST_PROFILE, backgroundId: 'school' },
      },
    });

    expect(selectEligibleEvents(pack, state).map((event) => event.eventId)).toEqual([
      'EVT-CON-025',
    ]);
  });

  it.each([
    ['club-academy', 'EVT-CON-020', 'A', 'EVT-CON-023', 'A'],
    ['club-academy', 'EVT-CON-020', 'A', 'EVT-CON-023', 'B'],
    ['club-academy', 'EVT-CON-020', 'B', 'EVT-CON-024', 'A'],
    ['club-academy', 'EVT-CON-020', 'B', 'EVT-CON-024', 'B'],
    ['school', 'EVT-CON-021', 'A', 'EVT-CON-025', 'A'],
    ['school', 'EVT-CON-021', 'A', 'EVT-CON-025', 'B'],
    ['school', 'EVT-CON-021', 'B', 'EVT-CON-026', 'A'],
    ['school', 'EVT-CON-021', 'B', 'EVT-CON-026', 'B'],
    ['street', 'EVT-CON-022', 'A', 'EVT-CON-027', 'A'],
    ['street', 'EVT-CON-022', 'A', 'EVT-CON-027', 'B'],
    ['street', 'EVT-CON-022', 'B', 'EVT-CON-028', 'A'],
    ['street', 'EVT-CON-022', 'B', 'EVT-CON-028', 'B'],
  ] as const)(
    '%s PATH %s가 실제 해소·후속을 거쳐 첫 계약 제안을 연다',
    (backgroundId, openingId, choiceId, followUpId, followUpChoiceId) => {
      const snapshot: DomainSnapshot = {
        revision: 0,
        checkpoint: 'CAREER_CREATED',
        stateHash: '',
        rulesetVersion: '1.2.0',
        contentPackVersion: '0.4.1',
        state: buildTestState({
          age: 19,
          currentStep: 12,
          seasonPhase: 'SETTLEMENT',
          rulesetVersion: '1.2.0',
          contentPackVersion: '0.4.1',
          player: {
            draft: { ...buildTestState().player.draft, backgroundId },
            profile: { ...TEST_PROFILE, backgroundId },
          },
        }),
      };
      const offered = advance(snapshot, selectEligibleEvents(pack, snapshot.state));
      expect(
        offered.ok &&
          offered.snapshot.state.pending?.kind === 'EVENT' &&
          offered.snapshot.state.pending.eventId,
      ).toBe(openingId);
      if (!offered.ok) return;
      const opened = resolve(offered.snapshot, openingId, choiceId);
      expect(opened.ok).toBe(true);
      if (!opened.ok) return;
      const followed = advance(opened.snapshot, selectEligibleEvents(pack, opened.snapshot.state));
      expect(
        followed.ok &&
          followed.snapshot.state.pending?.kind === 'EVENT' &&
          followed.snapshot.state.pending.eventId,
      ).toBe(followUpId);
      if (!followed.ok) return;
      const finished = resolve(followed.snapshot, followUpId, followUpChoiceId);
      expect(finished.ok).toBe(true);
      if (!finished.ok) return;
      const nextEligible = selectEligibleEvents(pack, finished.snapshot.state);
      expect(nextEligible).toEqual([]);
      const offers = advance(finished.snapshot, nextEligible);
      if (!offers.ok)
        throw new Error(`${backgroundId}/${choiceId}: ${JSON.stringify(offers.error)}`);
      expect(offers.ok && offers.snapshot.state.pending?.kind).toBe('OFFERS');
    },
  );

  it('후반 커리어의 무계약 상태에서는 과거 진로 태그가 일반 사건을 막지 않는다', () => {
    const state = buildTestState({
      age: 26,
      stage: 'PRO',
      contract: null,
      seasonHistory: [{ seasonIndex: 1 } as never],
      tags: ['진로_하부리그', '입단테스트_완료'],
    });
    expect(selectEligibleEvents(pack, state)).toEqual(
      selectEligibleEvents(pack, { ...state, tags: [] }),
    );
  });

  it('0.4.0의 첫 PATH 정의는 변경하지 않는다', () => {
    expect(loadContentPack('0.4.0').eventsById.get('EVT-CON-002')?.narrative.situation).toContain(
      '마지막 프로 명단',
    );
    expect(pack.eventsById.has('EVT-CON-002')).toBe(false);
    expect(pack.eventsById.has('EVT-DEV-001')).toBe(false);
  });

  it('감독 역할 협의는 포지션 변경을 적용하지 않고 다음 장면으로 이어진다', () => {
    const first = pack.eventsById.get('EVT-MGR-020');
    expect(
      first?.choices
        .flatMap((choice) => choice.outcomes)
        .every((outcome) =>
          outcome.effects.every(
            (effect) => !['primaryPosition', 'positionProficiency'].includes(effect.target),
          ),
        ),
    ).toBe(true);

    const state = buildTestState({
      age: 22,
      stage: 'PRO',
      seasonPhase: 'LEAGUE',
      tags: ['역할_시험_협의'],
      resolvedEventIds: ['EVT-MGR-020'],
      timeline: [timelineEntry({ kind: 'EVENT_RESOLVED', refId: 'EVT-MGR-020:A:A1', age: 22 })],
    });
    expect(selectEligibleEvents(pack, state).map((event) => event.eventId)).toEqual([
      'EVT-MGR-021',
    ]);
  });

  it('계약 중인 젊은 프로의 프리시즌에 감독 역할 협의가 실제 eligible이다', () => {
    const contract = {
      id: 'ctr',
      offerId: 'offer',
      teamId: 'gangdong-rovers',
      teamName: '강동 로버스',
      leagueTier: 2 as const,
      lengthSeasons: 2,
      wageMinorPerWeek: 100,
      signingBonusMinor: 0,
      rolePromise: 'ROTATION' as const,
      shirtNumber: 20,
      signatureType: 'AUTO' as const,
      signedAtRevision: 1,
      kind: 'PERMANENT' as const,
      appearancePromise: { minutesShareBp: 0 },
      positionPlan: 'W' as const,
      suspended: false,
      loan: null,
      promiseBreaches: 0,
      signedSeasonIndex: 1,
    };
    const state = buildTestState({ age: 21, stage: 'PRO', seasonPhase: 'PRESEASON', contract });
    expect(selectEligibleEvents(pack, state).some((event) => event.eventId === 'EVT-MGR-020')).toBe(
      true,
    );
  });
});
