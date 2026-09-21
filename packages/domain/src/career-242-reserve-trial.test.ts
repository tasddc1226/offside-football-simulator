import { describe, expect, it } from 'vitest';
import candidateRulesetJson from '../../content/rulesets/3.4.0/ruleset.json' with { type: 'json' };
import { hashState } from './hash.js';
import { needsDevelopment } from './development.js';
import { simulate, verifySnapshot, type Command } from './simulate.js';
import type { DomainSnapshot, Ruleset } from './index.js';

const RULESET = candidateRulesetJson as unknown as Ruleset;
const INPUT = { ruleset: RULESET, rulesetVersion: '3.4.0', contentPackVersion: '0.13.0' };
type EngineCommand = Command & { commandId: string; expectedRevision: number };

function command<T extends Command['type']>(snapshot: DomainSnapshot, type: T, payload: Extract<Command, { type: T }>['payload']): EngineCommand {
  return { type, commandId: `${type}-${snapshot.revision}`, expectedRevision: snapshot.revision, payload } as EngineCommand;
}

function apply(snapshot: DomainSnapshot, next: EngineCommand): DomainSnapshot {
  const result = simulate({ ...INPUT, snapshot, command: next });
  if (!result.ok) throw new Error(`${next.type}: ${result.error.code} ${result.error.message}`);
  return result.snapshot;
}

function driveToSettlement(snapshot: DomainSnapshot): DomainSnapshot {
  let current = snapshot;
  for (let guard = 0; guard < 60; guard += 1) {
    if (current.state.pending?.kind === 'SETTLEMENT') {
      return apply(current, command(current, 'SETTLE_SEASON', {}));
    }
    if (current.state.pending?.kind === 'ROLE_PROPOSAL') {
      current = apply(current, command(current, 'RESOLVE_ROLE', { decision: 'ACCEPT' }));
      continue;
    }
    if (current.state.pending?.kind === 'INJURY') {
      const pending = current.state.pending;
      current = apply(current, command(current, 'RESOLVE_EVENT', {
        eventId: pending.eventId,
        definitionVersion: pending.version,
        choiceId: 'A',
        outcomes: [{ id: 'A1', kind: 'FIXED', weight: 100, effects: [] }],
        rehabPlan: 'STANDARD',
      }));
      continue;
    }
    if (needsDevelopment(current.state, RULESET)) {
      current = apply(current, command(current, 'DEVELOP', { drill: 'CONTROL', load: 'BALANCED', partner: 'COACH' }));
      continue;
    }
    current = apply(current, command(current, 'ADVANCE', { eligibleEvents: [] }));
  }
  throw new Error('settlement was not reached');
}

function startCareer(): DomainSnapshot {
  const created = simulate({ ...INPUT, snapshot: null, command: {
    type: 'CREATE_CAREER', commandId: 'create', expectedRevision: 0,
    payload: { careerId: 'career-242', seed: 'career-242-reserve', simulationMode: 'FAST', rulesetVersion: '3.4.0', contentPackVersion: '0.13.0' },
  } });
  if (!created.ok) throw new Error(`${created.error.code} ${created.error.message}`);
  let snapshot = created.snapshot;
  snapshot = apply(snapshot, command(snapshot, 'UPDATE_PLAYER_DRAFT', { draft: { name: '김서준', gender: 'UNSPECIFIED', nationalityCode: 'KR', preferredFoot: 'LEFT' } }));
  snapshot = apply(snapshot, command(snapshot, 'UPDATE_PLAYER_DRAFT', { draft: { position: 'AM', archetypeId: 'am-playmaker', backgroundId: 'club-academy' } }));
  snapshot = apply(snapshot, command(snapshot, 'CONFIRM_PLAYER', {}));
  const taggedState = { ...snapshot.state, tags: ['진로_아카데미'] };
  snapshot = { ...snapshot, state: taggedState, stateHash: hashState(taggedState) };
  if (snapshot.state.pending?.kind !== 'OFFERS') {
    snapshot = apply(snapshot, command(snapshot, 'ADVANCE', { eligibleEvents: [] }));
  }
  const offers = snapshot.state.pending;
  if (offers?.kind !== 'OFFERS') throw new Error('first contract offers missing');
  snapshot = apply(snapshot, command(snapshot, 'ACCEPT_OFFER', { offerId: offers.offers[0]!.id }));

  const team = RULESET.teams.find((entry) => entry.id === 'incheon-gaetbeol-fc')!;
  const contract = snapshot.state.contract!;
  const state = {
    ...snapshot.state,
    player: { ...snapshot.state.player, profile: { ...snapshot.state.player.profile!, primaryPosition: 'AM' as const, archetypeId: 'am-playmaker' } },
    contract: { ...contract, teamId: team.id, teamName: team.name, leagueTier: 1 as const },
    clubHistory: snapshot.state.clubHistory.map((stint) => ({ ...stint, teamId: team.id, teamName: team.name, leagueTier: 1 as const })),
  };
  return { ...snapshot, state, stateHash: hashState(state) };
}

describe('candidate 3.4 #242 reserve trial', () => {
  it('runs real START/RESOLVE_ROLE/ADVANCE/SETTLE commands and gives a healthy zero-slot RESERVE a real SUB', () => {
    let snapshot = startCareer();
    snapshot = apply(snapshot, command(snapshot, 'START_SEASON', { simulationMode: 'FAST', serviceSeasonId: 'reserve-s1' }));
    const pending = snapshot.state.pending;
    expect(pending?.kind).toBe('ROLE_PROPOSAL');
    if (pending?.kind !== 'ROLE_PROPOSAL') return;
    const state = {
      ...snapshot.state,
      pending: { ...pending, proposal: { type: 'ROLE_CHANGE' as const, position: 'AM' as const, from: 'ROTATION' as const, to: 'RESERVE' as const } },
    };
    snapshot = apply({ ...snapshot, state, stateHash: hashState(state) }, command({ ...snapshot, state, stateHash: hashState(state) }, 'RESOLVE_ROLE', { decision: 'ACCEPT' }));
    expect(snapshot.state.contract?.rolePromise).toBe('RESERVE');
    const settled = driveToSettlement(snapshot);
    const reloaded = JSON.parse(JSON.stringify(settled)) as DomainSnapshot;
    expect(verifySnapshot(reloaded)).toEqual({ ok: true });
    const first = settled.state.seasonHistory.at(-1)?.result;
    expect(first).toBeDefined();
    expect(first?.playerStats.minutes).toBeGreaterThan(0);
    expect(first?.selectionSummary.sub).toBeGreaterThan(0);
    expect(first?.playerStats.injuries).toBe(0);
    expect(first?.awards?.length).toBeGreaterThan(0);
    expect(first?.milestones?.map((milestone) => milestone.milestoneId)).toContain('FIRST_APPEARANCE');

    snapshot = settled;
    if (snapshot.state.pending?.kind === 'OFFERS') {
      snapshot = apply(snapshot, command(snapshot, 'ACCEPT_OFFER', { offerId: snapshot.state.pending.offers[0]!.id }));
    }
    snapshot = apply(snapshot, command(snapshot, 'START_SEASON', { simulationMode: 'FAST', serviceSeasonId: 'reserve-s2' }));
    expect(snapshot.state.contract?.rolePromise).toBe('RESERVE');
    expect(snapshot.state.player.profile?.primaryPosition).toBe('AM');
    expect(snapshot.state.season?.selection.position).toBe('AM');
    const secondStart = snapshot.state.pending;
    if (secondStart?.kind === 'ROLE_PROPOSAL') snapshot = apply(snapshot, command(snapshot, 'RESOLVE_ROLE', { decision: 'ACCEPT' }));
    const secondSettled = driveToSettlement(snapshot);
    expect(verifySnapshot(JSON.parse(JSON.stringify(secondSettled)) as DomainSnapshot)).toEqual({ ok: true });
    expect(secondSettled.state.seasonHistory).toHaveLength(2);
    expect(secondSettled.state.seasonHistory[1]?.result.playerStats.minutes).toBeGreaterThan(0);
    expect(secondSettled.state.seasonHistory[1]?.result.selectionSummary.sub).toBeGreaterThan(0);
    expect(secondSettled.state.seasonHistory[1]?.result.milestones?.map((milestone) => milestone.milestoneId)).not.toContain('FIRST_APPEARANCE');
  });
});
