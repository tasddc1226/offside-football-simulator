import { describe, expect, it } from 'vitest';
import {
  adjustedSeverityWeights,
  applyRehabPlan,
  injuryAvailabilityFromHealth,
  onInjuryRecovered,
  onMatchInjury,
  onMatchRecurrence,
  onRecurrenceCheckFailed,
  rehabDurationRange,
  recurrenceChainLength,
} from './injury.js';
import { rulesetProto } from './__fixtures__/career-01.js';
import { seedRng } from './rng.js';
import { computeBaseOvr } from './player.js';
import { canonicalize, type JsonValue } from './canonical.js';
import { sha256Hex } from './hash.js';
import { ATTRIBUTE_KEYS, type CareerState, type InjuryEpisode, type MatchRecord } from './types.js';

function baseEpisode(overrides: Partial<InjuryEpisode> = {}): InjuryEpisode {
  return {
    id: 'INJ-1-3-1',
    severity: 'MODERATE',
    bodyPart: 'HAMSTRING',
    occurredAt: { seasonIndex: 1, step: 3, matchId: 'm1' },
    diagnosisRange: { minMatches: 3, maxMatches: 6 },
    rehab: null,
    recurrenceRiskBp: 3000,
    recurrenceChecksRemaining: 0,
    status: 'ACTIVE',
    permanentDelta: null,
    remainingMatches: 3,
    ...overrides,
  };
}

describe('onMatchInjury', () => {
  function state(seed = 'injury-test', overrides: Partial<CareerState> = {}): CareerState {
    const attributes = Object.fromEntries(
      ATTRIBUTE_KEYS.map((key) => [key, 50]),
    ) as CareerState['attributes'];
    const archetype = rulesetProto.archetypes[0]!;
    return {
      age: 17,
      attributes,
      state: { form: 50, fitness: 80, morale: 50 },
      player: {
        profile: {
          name: 'Test',
          gender: 'MALE',
          nationalityCode: 'KR',
          preferredFoot: 'RIGHT',
          preferredPosition: archetype.position,
          primaryPosition: archetype.position,
          archetypeId: archetype.id,
          backgroundId: rulesetProto.backgrounds[0]!.id,
          truePotential: 80,
          scoutedPotentialMin: 75,
          scoutedPotentialMax: 85,
          baseOvr: 50,
        },
      },
      health: { episodes: [] },
      timeline: [],
      season: { injuryCount: 0 },
      rngState: seedRng(seed),
      ...overrides,
    } as CareerState;
  }

  function match(id = 'm1'): MatchRecord {
    return {
      id,
      step: 3,
      order: 1,
      competitionId: 'LEAGUE',
      kind: 'LEAGUE',
      round: null,
      opponent: { id: 'opp-1', name: 'Opp', strength: 50 },
      home: true,
      result: { goalsFor: 1, goalsAgainst: 0, outcome: 'WIN' },
      appearance: 'START',
      outReason: null,
      minutes: 45,
      involvement: 50,
      stats: { group: 'FW', goals: 0, assists: 0, xgCenti: 0, shots: 1, offsides: 0 },
      ratingTenths: 60,
      cards: { yellow: 0, red: false },
      injuredOff: true,
      chapterId: null,
    };
  }

  function resultFor(seed: string, overrides: Partial<Parameters<typeof onMatchInjury>[0]> = {}) {
    return onMatchInjury({
      state: state(seed),
      seasonIndex: 1,
      step: 3,
      match: match(`match-${seed}`),
      availability: null,
      injuryCount: 0,
      ruleset: rulesetProto,
      rng: seedRng(seed),
      ...overrides,
    });
  }

  // These vectors were selected once from the deterministic 1.0.0 rule stream. Keeping the
  // winning seeds explicit makes the test exercise the production roll order without any runtime
  // search (minor/severe cover automatic/forced handling, bodyPart seeds cover every cumulative
  // range, and the forced pair plus post-cap seed cover the season cap transition).
  const fixedSeeds = {
    minor: 'minor-1',
    severe: 'severe-0',
    bodyPart: {
      KNEE: 'body-part-KNEE-10',
      ANKLE: 'body-part-ANKLE-3',
      HAMSTRING: 'body-part-HAMSTRING-5',
      SHOULDER: 'body-part-SHOULDER-9',
      HEAD: 'body-part-HEAD-44',
    },
    forced: ['forced-0-2', 'forced-1-0'] as const,
    afterForcedCap: 'forced-after-cap-0',
  } as const;

  it('ACTIVE/REHAB episode에 remainingMatches가 없으면 다음 시즌 carry를 거부한다', () => {
    const incomplete = { ...baseEpisode() };
    delete incomplete.remainingMatches;
    expect(() => injuryAvailabilityFromHealth({ episodes: [incomplete] })).toThrow(
      /remainingMatches/,
    );
  });

  it('심각도·부위·이탈기간 순으로 3회 roll하고 에피소드/availability/timeline을 만든다', () => {
    const rng = seedRng('injury-test');
    const result = onMatchInjury({
      state: state(),
      seasonIndex: 1,
      step: 3,
      match: match(),
      availability: null,
      injuryCount: 0,
      ruleset: rulesetProto,
      rng,
    });

    expect(result.health.episodes).toHaveLength(1);
    expect(result.health.episodes[0]!.id).toBe('INJ-1-3-1');
    expect(result.availability).toMatchObject({ kind: 'INJURY', sinceMatchId: 'm1' });
    expect(result.timeline[0]).toMatchObject({ kind: 'INJURED', refId: 'INJ-1-3-1' });
    expect(result.rng.draws - rng.draws).toBe(3);
  });

  it('MINOR는 STANDARD 재활로 자동 진행하고 severe는 cap 전 forced pending을 연다', () => {
    const minor = resultFor(fixedSeeds.minor);
    expect(minor.health.episodes[0]).toMatchObject({ rehab: 'STANDARD', status: 'REHAB' });
    const severe = resultFor(fixedSeeds.severe);
    expect(severe.forcedPending).toMatchObject({
      kind: 'INJURY',
      eventId: 'EVT-INJ-001',
      version: 1,
    });
    expect(severe.injuryCount).toBe(1);
  });

  it('후보 ruleset은 부위·재발 맥락에 맞는 이벤트를 선택하고 실제 선택지는 보존한다', () => {
    const contextualRuleset = {
      ...rulesetProto,
      injuryRules: {
        ...rulesetProto.injuryRules,
        contextualEvents: {
          byBodyPart: {
            KNEE: { id: 'EVT-INJ-131', version: 1 },
            HAMSTRING: { id: 'EVT-INJ-132', version: 1 },
          },
          recurrence: { id: 'EVT-INJ-133', version: 1 },
        },
      },
    };
    const knee = Array.from({ length: 500 }, (_, index) => {
      const seed = `contextual-knee-${index}`;
      return onMatchInjury({
        state: state(seed),
        seasonIndex: 1,
        step: 3,
        match: match(seed),
        availability: null,
        injuryCount: 0,
        ruleset: contextualRuleset,
        rng: seedRng(seed),
      });
    }).find(
      (result) =>
        result.health.episodes[0]?.severity === 'MAJOR' &&
        result.health.episodes[0]?.bodyPart === 'KNEE',
    );
    expect(knee).toBeDefined();
    if (knee === undefined) throw new Error('deterministic knee seed search failed');
    expect(knee.forcedPending?.eventId).toBe('EVT-INJ-131');
    expect(knee.forcedPending?.version).toBe(1);
    expect(knee.health.episodes[0]?.bodyPart).toBe('KNEE');
  });

  it('위험 보정은 경계값을 지키고 심각도 가중치 합을 항상 10000으로 유지한다', () => {
    expect(adjustedSeverityWeights(rulesetProto.injuryRules, state('risk-base'))).toEqual({
      MINOR: 6000,
      MODERATE: 3000,
      MAJOR: 1000,
    });
    expect(
      adjustedSeverityWeights(
        rulesetProto.injuryRules,
        state('risk-durability', {
          attributes: { ...state('risk-durability').attributes, durability: 49 },
        }),
      ),
    ).toEqual({ MINOR: 5960, MODERATE: 3030, MAJOR: 1010 });
    expect(
      adjustedSeverityWeights(
        rulesetProto.injuryRules,
        state('risk-fitness', { state: { form: 50, fitness: 49, morale: 50 } }),
      ),
    ).toEqual({ MINOR: 5000, MODERATE: 3750, MAJOR: 1250 });
    expect(
      adjustedSeverityWeights(rulesetProto.injuryRules, state('risk-age', { age: 31 })),
    ).toEqual({ MINOR: 5800, MODERATE: 3150, MAJOR: 1050 });

    const capped = adjustedSeverityWeights(
      rulesetProto.injuryRules,
      state('risk-cap', {
        age: 99,
        attributes: { ...state('risk-cap').attributes, durability: 1 },
        state: { form: 50, fitness: 0, morale: 50 },
      }),
    );
    expect(capped).toEqual({ MINOR: 0, MODERATE: 7500, MAJOR: 2500 });

    for (let durability = 1; durability <= 99; durability += 7) {
      for (let fitness = 0; fitness <= 100; fitness += 11) {
        for (let age = 17; age <= 99; age += 13) {
          const weights = adjustedSeverityWeights(
            rulesetProto.injuryRules,
            state(`risk-property-${durability}-${fitness}-${age}`, {
              age,
              attributes: { ...state('risk-property').attributes, durability },
              state: { form: 50, fitness, morale: 50 },
            }),
          );
          expect(weights.MINOR + weights.MODERATE + weights.MAJOR).toBe(10000);
          expect(Object.values(weights).every((weight) => weight >= 0)).toBe(true);
        }
      }
    }
  });

  it('bodyPart 5종을 ruleset 배열 순서의 누적 경계로 모두 선택한다', () => {
    const expected = [
      { id: 'KNEE', min: 0, max: 20 },
      { id: 'ANKLE', min: 20, max: 45 },
      { id: 'HAMSTRING', min: 45, max: 75 },
      { id: 'SHOULDER', min: 75, max: 90 },
      { id: 'HEAD', min: 90, max: 100 },
    ] as const;
    expect(rulesetProto.injuryRules.bodyParts.map((bodyPart) => bodyPart.id)).toEqual(
      expected.map((bodyPart) => bodyPart.id),
    );
    for (const bodyPart of expected) {
      expect(resultFor(fixedSeeds.bodyPart[bodyPart.id]).health.episodes[0]?.bodyPart).toBe(
        bodyPart.id,
      );
    }
  });

  it('forced 상한 2회 뒤 severe도 STANDARD 자동 처리되고 closure injuryCount가 누적된다', () => {
    let current = state('forced-cap-0');
    let injuryCount = 0;
    for (let index = 0; index < rulesetProto.injuryRules.maxForcedPerSeason; index += 1) {
      const seed = fixedSeeds.forced[index]!;
      const result = onMatchInjury({
        state: current,
        seasonIndex: 1,
        step: index + 1,
        match: match(`forced-${index}`),
        availability: null,
        injuryCount,
        ruleset: rulesetProto,
        rng: seedRng(seed),
      });
      expect(result.forcedPending).not.toBeNull();
      injuryCount = result.injuryCount;
      current = {
        ...current,
        attributes: result.attributes,
        health: result.health,
        player: { ...current.player, profile: result.profile },
        season: current.season === null ? null : { ...current.season, injuryCount },
      };
    }
    expect(injuryCount).toBe(2);

    const afterCap = onMatchInjury({
      state: current,
      seasonIndex: 1,
      step: 3,
      match: match('forced-after-cap'),
      availability: null,
      injuryCount,
      ruleset: rulesetProto,
      rng: seedRng(fixedSeeds.afterForcedCap),
    });
    expect(afterCap.health.episodes.at(-1)).toMatchObject({ status: 'REHAB', rehab: 'STANDARD' });
    expect(afterCap.forcedPending).toBeNull();
    expect(afterCap.injuryCount).toBe(2);
  });

  it('회복 시 RECOVERED와 재발 검사 창을 열고 MAJOR 후유증/baseOvr를 함께 갱신한다', () => {
    const episode = baseEpisode({ severity: 'MAJOR', status: 'REHAB', rehab: 'STANDARD' });
    const result = onInjuryRecovered({
      state: state('recovery', { health: { episodes: [episode] } }),
      availability: { kind: 'INJURY', matchesRemaining: 0, sinceMatchId: 'm1' },
      match: match('m-return'),
      ruleset: rulesetProto,
      step: 5,
      revision: 9,
      rng: seedRng('recovery-match'),
    });
    expect(result.health.episodes[0]).toMatchObject({
      status: 'RECOVERED',
      recurrenceChecksRemaining: 6,
      permanentDelta: [{ key: 'durability', delta: -1 }],
    });
    expect(result.attributes.durability).toBe(49);
    expect(result.timeline[0]).toMatchObject({ kind: 'RECOVERED', refId: episode.id, revision: 9 });
    expect(result.rng.draws).toBe(0);
  });

  it('재발은 duration roll 1회로 같은 부위의 한 단계 높은 새 에피소드와 forced pending을 만든다', () => {
    const original = baseEpisode({
      status: 'RECOVERED',
      rehab: 'STANDARD',
      recurrenceChecksRemaining: 6,
    });
    const rng = seedRng('recurrence');
    const source = state('recurrence');
    const cbArchetype = rulesetProto.archetypes.find(
      (candidate) => candidate.id === 'cb-aerial-dominator',
    )!;
    const recurrenceState: CareerState = {
      ...source,
      attributes: { ...source.attributes, jumping: 51, strength: 51, tackling: 51 },
      player: {
        ...source.player,
        profile: {
          ...source.player.profile!,
          preferredPosition: cbArchetype.position,
          primaryPosition: cbArchetype.position,
          archetypeId: cbArchetype.id,
          baseOvr: 51,
        },
      },
    };
    const result = onMatchRecurrence({
      state: { ...recurrenceState, health: { episodes: [original] } },
      seasonIndex: 1,
      step: 8,
      match: match('m-recur'),
      episodeId: original.id,
      injuryCount: 0,
      ruleset: rulesetProto,
      rng,
      revision: 10,
    });
    expect(result.rng.draws - rng.draws).toBe(1);
    expect(result.health.episodes[0]).toMatchObject({
      status: 'RECURRED',
      recurrenceChecksRemaining: 0,
    });
    expect(result.health.episodes[1]).toMatchObject({
      severity: 'MAJOR',
      bodyPart: original.bodyPart,
      occurredAt: { matchId: 'm-recur' },
    });
    expect(result.forcedPending).toMatchObject({
      kind: 'INJURY',
      episodeId: result.health.episodes[1]!.id,
    });
    expect(result.health.episodes[1]!.permanentDelta).toEqual([{ key: 'durability', delta: -2 }]);
    expect(result.attributes.durability).toBe(48);
    const archetype = rulesetProto.archetypes.find(
      (candidate) => candidate.id === recurrenceState.player.profile?.archetypeId,
    )!;
    expect(result.profile?.baseOvr).toBe(computeBaseOvr(result.attributes, archetype.roleWeights));
    expect(result.profile?.baseOvr).toBe(50);

    const recovered = onInjuryRecovered({
      state: {
        ...recurrenceState,
        attributes: result.attributes,
        player: { ...recurrenceState.player, profile: result.profile },
        health: result.health,
        timeline: result.timeline,
      },
      availability: { kind: 'INJURY', matchesRemaining: 0, sinceMatchId: 'm-recur' },
      match: match('m-recur-return'),
      ruleset: rulesetProto,
      step: 9,
      revision: 11,
      rng: result.rng,
    });
    expect(recovered.attributes.durability).toBe(48);
    expect(recovered.health.episodes[1]!.permanentDelta).toEqual([
      { key: 'durability', delta: -2 },
    ]);
  });

  it('새 별도 부상은 기존 RECOVERED 재발 창을 닫고 새 회복 창만 연다', () => {
    const older = baseEpisode({
      id: 'INJ-older',
      status: 'RECOVERED',
      recurrenceChecksRemaining: 4,
    });
    const source = state('overlap-new-injury', { health: { episodes: [older] } });
    const created = onMatchInjury({
      state: source,
      seasonIndex: 1,
      step: 7,
      match: match('overlap-new-0'),
      availability: null,
      injuryCount: 0,
      ruleset: rulesetProto,
      rng: seedRng('overlap-new-0'),
    });
    expect(created.health.episodes.at(-1)?.severity).toBe('MINOR');
    expect(created.health.episodes[0]).toMatchObject({
      id: 'INJ-older',
      status: 'RECOVERED',
      recurrenceChecksRemaining: 0,
    });

    const newEpisode = created.health.episodes[1]!;
    const recovered = onInjuryRecovered({
      state: { ...source, health: created.health },
      availability: {
        kind: 'INJURY',
        matchesRemaining: 0,
        sinceMatchId: newEpisode.occurredAt.matchId,
      },
      match: match('overlap-new-return'),
      ruleset: rulesetProto,
      step: 8,
      rng: created.rng,
    });
    expect(recovered.health.episodes[0]).toMatchObject({
      id: 'INJ-older',
      recurrenceChecksRemaining: 0,
    });
    expect(recovered.health.episodes[1]).toMatchObject({
      status: 'RECOVERED',
      recurrenceChecksRemaining: 6,
    });
  });

  it('재발 성공도 다른 RECOVERED 창을 직렬 연장하지 않고 닫는다', () => {
    const older = baseEpisode({
      id: 'INJ-older',
      status: 'RECOVERED',
      recurrenceChecksRemaining: 4,
    });
    const newer = baseEpisode({
      id: 'INJ-newer',
      status: 'RECOVERED',
      occurredAt: { seasonIndex: 1, step: 6, matchId: 'm-newer' },
      recurrenceChecksRemaining: 6,
    });
    const source = state('overlap-recurrence', { health: { episodes: [older, newer] } });
    const result = onMatchRecurrence({
      state: source,
      seasonIndex: 1,
      step: 8,
      match: match('m-recur-overlap'),
      episodeId: newer.id,
      injuryCount: 0,
      ruleset: rulesetProto,
      rng: seedRng('overlap-recurrence-roll'),
      allowForcedPending: false,
    });
    expect(result.health.episodes[0]).toMatchObject({
      id: 'INJ-older',
      recurrenceChecksRemaining: 0,
    });
    expect(result.health.episodes[1]).toMatchObject({
      id: 'INJ-newer',
      status: 'RECURRED',
      recurrenceChecksRemaining: 0,
    });
  });

  it('MINOR 재발은 MODERATE로 상승하고 재발 창 실패는 0에서 더 줄지 않는다', () => {
    const original = baseEpisode({
      severity: 'MINOR',
      status: 'RECOVERED',
      rehab: 'STANDARD',
      recurrenceChecksRemaining: 6,
    });
    const source = state('minor-recurrence');
    const result = onMatchRecurrence({
      state: { ...source, health: { episodes: [original] } },
      seasonIndex: 1,
      step: 8,
      match: match('m-minor-recur'),
      episodeId: original.id,
      injuryCount: 2,
      ruleset: rulesetProto,
      rng: seedRng('minor-recurrence-roll'),
      allowForcedPending: false,
    });
    expect(result.health.episodes[1]).toMatchObject({
      severity: 'MODERATE',
      status: 'REHAB',
      rehab: 'STANDARD',
      permanentDelta: [{ key: 'durability', delta: -1 }],
    });
    expect(result.attributes.durability).toBe(49);

    const failedOnce = onRecurrenceCheckFailed(
      { ...source, health: { episodes: [original] } },
      original.id,
    );
    expect(failedOnce.episodes[0]?.recurrenceChecksRemaining).toBe(5);
    const failedToZero = onRecurrenceCheckFailed({ ...source, health: failedOnce }, original.id);
    expect(failedToZero.episodes[0]?.recurrenceChecksRemaining).toBe(4);
    let expired = failedToZero;
    for (let i = 0; i < 4; i += 1)
      expired = onRecurrenceCheckFailed({ ...source, health: expired }, original.id);
    expect(expired.episodes[0]?.recurrenceChecksRemaining).toBe(0);
    expect(
      onRecurrenceCheckFailed({ ...source, health: expired }, original.id).episodes[0]
        ?.recurrenceChecksRemaining,
    ).toBe(0);
  });

  it('CONSERVATIVE risk survives recurrence and only the contiguous same-body chain counts', () => {
    const original = baseEpisode({
      id: 'INJ-original',
      status: 'RECOVERED',
      rehab: 'CONSERVATIVE',
      recurrenceRiskBp: 1500,
      recurrenceChecksRemaining: 6,
    });
    const source = state('bounded-conservative', { health: { episodes: [original] } });
    const policyRuleset = {
      ...rulesetProto,
      injuryRules: { ...rulesetProto.injuryRules, recurrenceMaxChain: 2 },
    };
    const result = onMatchRecurrence({
      state: source,
      seasonIndex: 1,
      step: 8,
      match: match('m-bounded'),
      episodeId: original.id,
      injuryCount: 2,
      ruleset: policyRuleset,
      rng: seedRng('bounded-conservative-roll'),
      allowForcedPending: false,
    });
    expect(result.health.episodes[1]!.recurrenceRiskBp).toBe(1500);
    const next = { ...result.health.episodes[1]!, status: 'RECOVERED' as const };
    expect(recurrenceChainLength([result.health.episodes[0]!, next], next.id)).toBe(1);
    const fresh = baseEpisode({ id: 'INJ-fresh', bodyPart: 'ANKLE', status: 'RECOVERED' });
    expect(recurrenceChainLength([result.health.episodes[0]!, next, fresh], fresh.id)).toBe(0);

    const legacy = onMatchRecurrence({
      state: source,
      seasonIndex: 1,
      step: 8,
      match: match('m-legacy'),
      episodeId: original.id,
      injuryCount: 2,
      ruleset: rulesetProto,
      rng: seedRng('bounded-conservative-roll'),
      allowForcedPending: false,
    });
    expect(legacy.health.episodes[1]!.recurrenceRiskBp).toBe(3000);
  });

  it('HEAD 후유증 없음과 clamp 경계의 실제 delta를 기록한다', () => {
    const head = baseEpisode({
      severity: 'MAJOR',
      bodyPart: 'HEAD',
      status: 'REHAB',
      rehab: 'STANDARD',
    });
    const headState = state('head-recovery', { health: { episodes: [head] } });
    const headResult = onInjuryRecovered({
      state: headState,
      availability: { kind: 'INJURY', matchesRemaining: 0, sinceMatchId: 'm1' },
      match: match('head-return'),
      ruleset: rulesetProto,
      step: 5,
      rng: seedRng('head-recovery-roll'),
    });
    expect(headResult.attributes).toEqual(headState.attributes);
    expect(headResult.profile).toEqual(headState.player.profile);
    expect(headResult.health.episodes[0]?.permanentDelta).toEqual([]);

    const clamped = onMatchRecurrence({
      state: {
        ...state('clamp-recurrence', {
          attributes: { ...state('clamp-recurrence').attributes, durability: 1 },
        }),
        health: {
          episodes: [
            baseEpisode({ status: 'RECOVERED', rehab: 'STANDARD', recurrenceChecksRemaining: 6 }),
          ],
        },
      },
      seasonIndex: 1,
      step: 8,
      match: match('clamp-recur'),
      episodeId: 'INJ-1-3-1',
      injuryCount: 2,
      ruleset: rulesetProto,
      rng: seedRng('clamp-recurrence-roll'),
      allowForcedPending: false,
    });
    expect(clamped.attributes.durability).toBe(1);
    expect(clamped.health.episodes[1]?.permanentDelta).toEqual([]);
  });

  it('동일 입력 hook 결과의 canonical hash가 결정론적으로 같다', () => {
    const first = resultFor('injury-hash-determinism');
    const second = resultFor('injury-hash-determinism');
    const digest = (result: ReturnType<typeof onMatchInjury>) =>
      sha256Hex(canonicalize(result as unknown as JsonValue));
    expect(first).toEqual(second);
    expect(digest(first)).toBe(digest(second));
  });
});

describe('applyRehabPlan', () => {
  it('EARLY: 원 diagnosisRange를 보존하고 returnShiftMatches만큼 복귀 범위만 당긴다', () => {
    const episode = baseEpisode({
      diagnosisRange: { minMatches: 3, maxMatches: 6 },
      recurrenceRiskBp: 3000,
    });
    const updated = applyRehabPlan(episode, 'EARLY', rulesetProto.injuryRules);
    // EARLY: returnShiftMatches -2, recurrenceAddBp +1500(룰셋 injuryRules.rehab.EARLY).
    expect(updated.diagnosisRange).toEqual({ minMatches: 3, maxMatches: 6 });
    expect(rehabDurationRange(updated, 'EARLY', rulesetProto.injuryRules)).toEqual({
      minMatches: 1,
      maxMatches: 4,
    });
    expect(updated.recurrenceRiskBp).toBe(4500);
    expect(updated.status).toBe('REHAB');
    expect(updated.rehab).toBe('EARLY');
  });

  it('STANDARD: 원 diagnosisRange를 보존하고 이동 없는 복귀 범위를 사용한다', () => {
    const episode = baseEpisode({
      diagnosisRange: { minMatches: 3, maxMatches: 6 },
      recurrenceRiskBp: 3000,
    });
    const updated = applyRehabPlan(episode, 'STANDARD', rulesetProto.injuryRules);
    expect(updated.diagnosisRange).toEqual({ minMatches: 3, maxMatches: 6 });
    expect(rehabDurationRange(updated, 'STANDARD', rulesetProto.injuryRules)).toEqual({
      minMatches: 3,
      maxMatches: 6,
    });
    expect(updated.recurrenceRiskBp).toBe(3000);
    expect(updated.status).toBe('REHAB');
    expect(updated.rehab).toBe('STANDARD');
  });

  it('CONSERVATIVE: 원 diagnosisRange를 보존하고 returnShiftMatches만큼 복귀 범위만 늘린다', () => {
    const episode = baseEpisode({
      diagnosisRange: { minMatches: 3, maxMatches: 6 },
      recurrenceRiskBp: 3000,
    });
    const updated = applyRehabPlan(episode, 'CONSERVATIVE', rulesetProto.injuryRules);
    // CONSERVATIVE: returnShiftMatches +2, recurrenceAddBp -1000.
    expect(updated.diagnosisRange).toEqual({ minMatches: 3, maxMatches: 6 });
    expect(rehabDurationRange(updated, 'CONSERVATIVE', rulesetProto.injuryRules)).toEqual({
      minMatches: 5,
      maxMatches: 8,
    });
    expect(updated.recurrenceRiskBp).toBe(2000);
  });

  it('diagnosisRange 경계는 최소 1로 clamp된다(EARLY가 -2 이동시켜도 0 아래로 내려가지 않는다)', () => {
    const episode = baseEpisode({ diagnosisRange: { minMatches: 1, maxMatches: 2 } });
    const updated = applyRehabPlan(episode, 'EARLY', rulesetProto.injuryRules);
    expect(updated.diagnosisRange).toEqual({ minMatches: 1, maxMatches: 2 });
    expect(rehabDurationRange(updated, 'EARLY', rulesetProto.injuryRules)).toEqual({
      minMatches: 1,
      maxMatches: 1,
    });
  });

  it('recurrenceRiskBp는 0~10000으로 clamp된다', () => {
    const high = applyRehabPlan(
      baseEpisode({ recurrenceRiskBp: 9500 }),
      'EARLY',
      rulesetProto.injuryRules,
    );
    expect(high.recurrenceRiskBp).toBe(10000);

    const low = applyRehabPlan(
      baseEpisode({ recurrenceRiskBp: 200 }),
      'CONSERVATIVE',
      rulesetProto.injuryRules,
    );
    expect(low.recurrenceRiskBp).toBe(0);
  });

  it('id·severity·bodyPart·occurredAt·permanentDelta는 건드리지 않는다', () => {
    const episode = baseEpisode({ permanentDelta: [{ key: 'durability', delta: -1 }] });
    const updated = applyRehabPlan(episode, 'STANDARD', rulesetProto.injuryRules);
    expect(updated.id).toBe(episode.id);
    expect(updated.severity).toBe(episode.severity);
    expect(updated.bodyPart).toBe(episode.bodyPart);
    expect(updated.occurredAt).toEqual(episode.occurredAt);
    expect(updated.permanentDelta).toEqual(episode.permanentDelta);
  });
});
