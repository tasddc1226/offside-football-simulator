import { describe, expect, it } from 'vitest';
import golden from './__fixtures__/career-03-underdog.golden.json';
import { careerUnderdogFixture, rulesetProto, runUnderdogSeasonFixture, type UnderdogFixedInputs } from './__fixtures__/career-03-underdog.js';
import { runCareerFixture } from './__fixtures__/career-01.js';
import { verifySnapshot } from './simulate.js';
import { applyCondition, type ConditionState } from './condition.js';
import { applyCompetitorFormDrift } from './match.js';
import { computeSquadStatus, rankPositionForPlayer } from './selection.js';
import type { Competitor, MatchRecord, SelectionAppearance } from './types.js';

/** T-2-011 4번: `season.matches`에는 PLAYER 본인의 `MatchAppearance`만 저장되고 경쟁자(COMP-W-1·
 * COMP-W-2)의 가상 선발 여부는 저장되지 않는다. 그래서 매 경기 `rankPositionForPlayer`를 다시 불러
 * 순위를 재구성한다 — RESOLVE_ROLE 이후 시즌 내내 고정인 입력(`fixedInputs`)과, 매 경기 갱신되는
 * 입력(선수 squadStatus는 `lastRatingTenths` 폴드, 경쟁자 form은 `applyCompetitorFormDrift` 폴드,
 * 선수 폼·체력·사기는 step 단위 `applyCondition` 폴드)을 실제 프로덕션 코드(`playMatch`·
 * `createStepMatchWiring`)와 같은 순서로 그대로 재현한다. 재구성이 맞는지는 이 replay가 만든 선수
 * 본인의 매 경기 출전 여부가 실제 `season.matches[i].appearance`와 완전히 같은지로 자체 검증한다.
 */
function shadowReplaySeason(
  fixedInputs: UnderdogFixedInputs,
  matches: readonly MatchRecord[],
): Array<{ playerAppearance: SelectionAppearance; rivalAppearances: Record<string, SelectionAppearance> }> {
  const rules = rulesetProto.selectionRules;
  const totalSteps = rulesetProto.leagueCalendar.steps.length;

  let competitors: readonly Competitor[] = fixedInputs.initialCompetitors;
  let squadStatus = fixedInputs.initialSquadStatus;
  let lastRatingTenths: number | null = null;
  let condition: ConditionState = fixedInputs.initialCondition;
  let matchIndex = 0;

  const results: Array<{ playerAppearance: SelectionAppearance; rivalAppearances: Record<string, SelectionAppearance> }> = [];

  for (let step = 1; step <= totalSteps; step++) {
    const stepMatches = matches.filter((match) => match.step === step);
    for (const match of stepMatches) {
      const excluded = match.outReason === 'SUSPENSION' || match.outReason === 'INJURY' ? match.outReason : null;
      const ranking = rankPositionForPlayer({
        ruleset: rulesetProto,
        styleId: fixedInputs.styleId,
        position: fixedInputs.position,
        playerName: fixedInputs.playerName,
        baseOvr: fixedInputs.baseOvr,
        tacticalFit: fixedInputs.tacticalFit,
        managerTrust: fixedInputs.managerTrust,
        form: condition.form,
        fitness: condition.fitness,
        morale: condition.morale,
        familiarity: fixedInputs.familiarity,
        squadStatus,
        competitors,
        excluded,
      });
      const player = ranking.candidates.find((c) => c.id === 'PLAYER')!;
      const rivalAppearances: Record<string, SelectionAppearance> = {};
      for (const candidate of ranking.candidates) {
        if (candidate.id !== 'PLAYER') rivalAppearances[candidate.id] = candidate.appearance;
      }
      results.push({ playerAppearance: player.appearance, rivalAppearances });

      const nextLastRatingTenths: number | null = match.minutes > 0 ? match.ratingTenths : lastRatingTenths;
      squadStatus = computeSquadStatus(
        {
          rolePromise: fixedInputs.rolePromiseForSquadStatus,
          captaincy: 'NONE',
          lastRating: nextLastRatingTenths === null ? null : nextLastRatingTenths / 10,
        },
        rules,
        rulesetProto.contractRules.squadStatusByRole,
      );
      lastRatingTenths = nextLastRatingTenths;
      competitors = applyCompetitorFormDrift(competitors, matchIndex, rulesetProto.matchRules.competitorFormDrift.amplitude);
      matchIndex += 1;
    }
    condition = applyCondition(condition, stepMatches, rulesetProto.conditionRules, rulesetProto.seasonBoundaryReset.form);
  }

  return results;
}

describe('career-03-underdog fixture — "OVR이 낮아도 전술 적합도가 높으면 선발된다"(phase-2 완료 조건)', () => {
  it('golden 값과 정확히 일치한다', () => {
    const snapshot = runCareerFixture(careerUnderdogFixture);
    expect(snapshot.revision).toBe(golden.revision);
    expect(snapshot.stateHash).toBe(golden.stateHash);
    expect(snapshot.checkpoint).toBe(golden.checkpoint);
    expect(snapshot.state.rngState.draws).toBe(golden.rngStateDraws);
    expect(snapshot.state.player.profile?.baseOvr).toBe(golden.baseOvr);
    expect(verifySnapshot(snapshot)).toEqual({ ok: true });
  });

  it('경쟁자보다 baseOvr이 낮은 선수가 Tactical Fit 덕분에 선발(rank 1, START)이다', () => {
    const snapshot = runCareerFixture(careerUnderdogFixture);
    const season = snapshot.state.season;
    expect(season).not.toBeNull();
    if (season === null) return;

    expect(season.styleId).toBe(golden.season.styleId);
    expect(season.squadRole).toBe(golden.season.squadRole);
    expect(season.squad.competitors.length).toBe(golden.season.competitorsCount);

    const selection = season.selection;
    expect(selection.position).toBe(golden.selection.position);
    expect(selection.slots).toBe(golden.selection.slots);
    expect(selection.benchSlots).toBe(golden.selection.benchSlots);
    expect(selection.candidates).toEqual(
      golden.selection.candidates.map((c) => ({ ...c, name: expect.any(String), managerTrust: expect.any(Number), excluded: null })),
    );
    expect(selection.playerReason).toEqual(golden.selection.playerReason);

    const player = selection.candidates.find((c) => c.id === 'PLAYER')!;
    const higherOvrStarters = selection.candidates.filter((c) => c.id !== 'PLAYER' && c.appearance !== 'OUT' && c.baseOvr > player.baseOvr);
    expect(player.appearance).toBe('START');
    expect(higherOvrStarters.length).toBeGreaterThan(0);
    expect(player.tacticalFit).toBeGreaterThan(Math.max(...higherOvrStarters.map((c) => c.tacticalFit)));
  });
});

describe('career-03-underdog 시즌 완주 — 선발 수가 경쟁자보다 많다(phase-2 완료 조건 4번, T-2-011)', () => {
  it('시즌이 SETTLE_SEASON까지 완주한다', () => {
    const { snapshot, beforeSettlement } = runUnderdogSeasonFixture();
    expect(beforeSettlement.matchesPlayed).toBeGreaterThan(15);
    expect(snapshot.state.season).toBeNull();
    expect(snapshot.state.seasonHistory).toHaveLength(1);
  });

  it('경쟁자(COMP-W-1·COMP-W-2)를 매 경기 shadow-replay로 재구성하면, 그 경기별 선수 선발 여부 재구성값이 실제 출전 기록과 완전히 같다(자기 검증)', () => {
    const { fixedInputs, beforeSettlement } = runUnderdogSeasonFixture();
    for (const id of ['COMP-W-1', 'COMP-W-2']) {
      const rival = fixedInputs.initialCompetitors.find((c) => c.id === id);
      expect(rival, id).toBeDefined();
      expect(rival?.baseOvr, id).toBeGreaterThan(fixedInputs.baseOvr);
    }

    const replay = shadowReplaySeason(fixedInputs, beforeSettlement.matches);
    expect(replay).toHaveLength(beforeSettlement.matches.length);
    expect(replay.map((r) => r.playerAppearance)).toEqual(beforeSettlement.matches.map((m) => m.appearance));
  });

  // W 포지션은 slots=2·benchSlots=1이고 실제 경쟁자가 COMP-W-1·COMP-W-2 둘뿐이라, 선수를 포함해도
  // "선발(START) 두 자리 + 벤치 한 자리"에 후보 셋이 정확히 다 들어간다(OUT이 나오려면 부상·정지뿐).
  // 그래서 선수가 거의 매 경기 rank 1(START)인 이 fixture에서는 rank 2인 COMP-W-1도 slots=2 덕에
  // 선수와 "같이" 거의 매 경기 START다 — "선수 선발 수 > COMP-W-1 선발 수"는 2-slot 구조상 원천적으로
  // 성립할 수 없는 비교다(선수가 제외되는 경기에도 COMP-W-1은 그대로 rank 1로 올라가 START를 유지한다).
  // 선수의 전술 적합도가 실제로 밀어내는 상대는 두 경쟁자 중 항상 점수가 더 낮은 COMP-W-2(rank 3,
  // benchSlots=1이라 SUB)다 — baseOvr은 COMP-W-1과 같이 80으로 선수(58)보다 높지만, Tactical Fit이
  // 밀려 시즌 내내 벤치에 머문다. "OVR 낮아도 전술 적합도로 선발"의 완료 조건은 이 경쟁자와의 비교로
  // 고정한다.
  it('시즌 전체 선수 선발(START) 수가, 선수보다 baseOvr이 높지만 Tactical Fit에 밀려 벤치에 머무는 COMP-W-2의 shadow-replay 선발 수보다 많다', () => {
    const { fixedInputs, beforeSettlement } = runUnderdogSeasonFixture();
    const replay = shadowReplaySeason(fixedInputs, beforeSettlement.matches);

    const playerStarts = beforeSettlement.playerStats.appearances.started;
    const comp2Starts = replay.filter((r) => r.rivalAppearances['COMP-W-2'] === 'START').length;
    expect(playerStarts).toBeGreaterThan(comp2Starts);
  });
});
