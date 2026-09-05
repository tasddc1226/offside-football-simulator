import { describe, expect, it } from 'vitest';
import { buildDefaultManager } from './manager.js';
import { generateCompetitors } from './competitors.js';
import { runSettledFixture } from './__fixtures__/career-06-settled.js';
import { rulesetProto } from './__fixtures__/career-01.js';
import { projectOfferSelection, seasonSquadSeed } from './offer-projection.js';
import { seedRng } from './rng.js';
import { hashState } from './hash.js';
import { simulate } from './simulate.js';
import { generateMarket } from './market.js';
import { computeSquadStatus, computeTacticalFit, familiarityOf, findTacticalStyle, rankPositionForPlayer } from './selection.js';

const ruleset110 = {
  ...rulesetProto,
  version: '1.1.0',
  offerProjection: { version: '1.1.0' as const, competitorSeedVersion: 'squad:season-team-v1' as const },
};

describe('Legacy 1.1 offer projection', () => {
  it('uses a shared team/season seed and does not depend on the career RNG state', () => {
    const { beforeSettlementState: state } = runSettledFixture();
    const team = ruleset110.teams.find((candidate) => candidate.id === state.contract!.teamId)!;
    const first = projectOfferSelection({ state, ruleset: ruleset110, team, rolePromise: 'ROTATION', seasonIndex: 2 });
    const second = projectOfferSelection({
      state: { ...state, rngState: seedRng('different-decision-stream') },
      ruleset: ruleset110,
      team,
      rolePromise: 'ROTATION',
      seasonIndex: 2,
    });
    expect(seasonSquadSeed(team.id, 2)).toBe(`squad:season-team-v1:${team.id}:2`);
    expect(second).toEqual(first);
  });

  it('reports full selection rank, not the number of higher-OVR competitors', () => {
    const { beforeSettlementState: state } = runSettledFixture();
    const team = ruleset110.teams.find((candidate) => candidate.id === state.contract!.teamId)!;
    const rolePromise = 'STARTER' as const;
    const projection = projectOfferSelection({ state, ruleset: ruleset110, team, rolePromise, seasonIndex: 2 });
    const profile = state.player.profile!;
    const manager = buildDefaultManager({
      teamId: team.id,
      tacticalStyleId: team.tacticalStyleId,
      primaryPosition: profile.primaryPosition,
      seasonHistory: state.seasonHistory,
      ruleset: ruleset110,
      timeline: state.timeline,
    });
    const style = findTacticalStyle(ruleset110, team.tacticalStyleId);
    const competitors = generateCompetitors(ruleset110, team, seedRng(seasonSquadSeed(team.id, 2))).competitors;
    const ranking = rankPositionForPlayer({
      ruleset: ruleset110,
      styleId: team.tacticalStyleId,
      position: profile.primaryPosition,
      playerName: profile.name,
      baseOvr: profile.baseOvr,
      tacticalFit: computeTacticalFit(state.attributes, profile.archetypeId, profile.primaryPosition, style, ruleset110.selectionRules, manager.preferredArchetypeIds),
      managerTrust: state.relationships.managerTrust,
      form: state.state.form,
      fitness: state.state.fitness,
      morale: state.state.morale,
      familiarity: familiarityOf(state.context.positionProficiency, ruleset110.selectionRules),
      squadStatus: computeSquadStatus({ rolePromise, captaincy: 'NONE', lastRating: null }, ruleset110.selectionRules, ruleset110.contractRules.squadStatusByRole),
      competitors,
    });
    expect(projection.competitorSummary.rank).toBe(ranking.candidates.find((candidate) => candidate.id === 'PLAYER')!.rank);
  });

  it('matches generated 1.1 market preview to the accepted transfer and START_SEASON ranking', () => {
    const settled = runSettledFixture().snapshot;
    const upgradedState = { ...settled.state, rulesetVersion: '1.1.0' };
    const generated = generateMarket({
      state: upgradedState,
      ruleset: ruleset110,
      reason: 'INTEREST',
      revision: settled.revision,
      rng: upgradedState.rngState,
    });
    const offer = generated.pending.offers.find((candidate) => candidate.kind !== 'RENEWAL');
    if (offer === undefined) throw new Error('1.1 market did not produce a transfer/loan offer');
    if (offer.competitorSummary === null) throw new Error('1.1 market offer has no competitor projection');
    const preview = {
      tacticalFit: offer.tacticalFitEstimate,
      rank: offer.competitorSummary.rank,
    };
    const marketState = {
      ...upgradedState,
      pending: generated.pending,
      rngState: generated.rngState,
    };
    let snapshot: typeof settled = { ...settled, rulesetVersion: '1.1.0', state: marketState, stateHash: hashState(marketState) };
    const accepted = simulate({
      snapshot,
      command: { type: 'ACCEPT_OFFER', payload: { offerId: offer.id }, commandId: 'projection-transfer', expectedRevision: snapshot.revision },
      ruleset: ruleset110,
      rulesetVersion: '1.1.0',
      contentPackVersion: snapshot.contentPackVersion,
    });
    if (!accepted.ok) throw new Error(`market offer acceptance failed: ${accepted.error.message}`);
    snapshot = accepted.snapshot;
    const started = simulate({
      snapshot,
      command: { type: 'START_SEASON', payload: { simulationMode: 'FAST', serviceSeasonId: 'projection-season' }, commandId: 'projection-start', expectedRevision: snapshot.revision },
      ruleset: ruleset110,
      rulesetVersion: '1.1.0',
      contentPackVersion: snapshot.contentPackVersion,
    });
    if (!started.ok) throw new Error(`start failed: ${started.error.message}`);
    const player = started.snapshot.state.season!.selection.candidates.find((candidate) => candidate.id === 'PLAYER')!;
    expect(started.snapshot.state.context.tacticalFit).toBe(preview.tacticalFit);
    expect(player.rank).toBe(preview.rank);
  });
});
