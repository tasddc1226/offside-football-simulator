import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { loadRuleset } from '../../packages/content/src/rulesets/load-ruleset.ts';
import { loadContentPack } from '../../packages/content/src/packs/load-content-pack.ts';
import { buildAnnualContentContext } from '../../packages/content/src/runtime/annual-content.ts';
import { CareerStateSchema } from '../../packages/contracts/src/career-state.ts';
import { simulate } from '../../packages/domain/src/simulate.ts';
import { startAnnualRun, nextAnnualAction } from '../../packages/domain/src/annual-career.ts';
import { computeGrowth } from '../../packages/domain/src/growth.ts';
import { statGroupOf, ATTRIBUTE_KEYS } from '../../packages/domain/src/types.ts';
import { openAnnualStory } from '../../packages/domain/src/annual-stories.ts';
import { computeSelectionScore } from '../../packages/domain/src/selection.ts';

const rulesetVersion = '3.5.0';
const contentPackVersion = '0.14.0';
const ruleset = loadRuleset(rulesetVersion);
const pack = loadContentPack(contentPackVersion);
const evidenceDir = mkdtempSync('/tmp/offside-annual-natural-');
function execute(snapshot, command) {
  const result = simulate({
    snapshot,
    ruleset,
    rulesetVersion,
    contentPackVersion,
    command: {
      ...command,
      commandId: `annual-${(snapshot?.revision ?? 0) + 1}`,
      expectedRevision: snapshot?.revision ?? 0,
    },
  });
  if (!result.ok) throw new Error(`${command.type}: ${JSON.stringify(result.error)}`);
  return result.snapshot;
}
function create(group, seed = 0) {
  const archetype = ruleset.archetypes.find((entry) => statGroupOf(entry.position) === group);
  let snapshot = execute(null, {
    type: 'CREATE_CAREER',
    payload: {
      careerId: `annual-${group}-${seed}`,
      seed: `annual-natural:${group}:${seed}`,
      simulationMode: 'FAST',
      rulesetVersion,
      contentPackVersion,
    },
  });
  snapshot = execute(snapshot, {
    type: 'UPDATE_PLAYER_DRAFT',
    payload: {
      draft: {
        name: '연간검증',
        gender: 'MALE',
        nationalityCode: 'KR',
        preferredFoot: 'RIGHT',
        position: archetype.position,
        preferredPosition: archetype.position,
        archetypeId: archetype.id,
        backgroundId: ruleset.backgrounds[0].id,
      },
    },
  });
  return execute(snapshot, { type: 'CONFIRM_PLAYER', payload: {} });
}
function runYear(initial, policy, auditChoices = true) {
  let snapshot = initial;
  const checkpoint = startAnnualRun(snapshot, ruleset, {
    serviceSeasonId: 'annual-test',
    ...(policy ? { policy } : {}),
  });
  const decisions = [],
    commands = [],
    snapshots = [];
  for (let count = 0; count < 160; count += 1) {
    const content = buildAnnualContentContext(pack, snapshot.state);
    const action = nextAnnualAction(snapshot, ruleset, checkpoint, content);
    expect(
      nextAnnualAction(snapshot, ruleset, JSON.parse(JSON.stringify(checkpoint)), content),
    ).toEqual(action);
    if (action.status === 'ERROR') throw new Error(JSON.stringify(action));
    if (action.status === 'COMPLETED') {
      expect(nextAnnualAction(snapshot, ruleset, checkpoint, content)).toEqual(action);
      return { snapshot, report: action.report, decisions, commands, snapshots, checkpoint };
    }
    let command = action.command;
    if (action.status === 'WAITING_DECISION') {
      decisions.push({
        kind: action.decision.kind,
        key: action.decision.key,
        event: snapshot.state.pending?.eventId,
      });
      if (auditChoices)
        for (const choice of action.decision.choices) execute(snapshot, choice.command);
      command = action.decision.choices[0].command;
    }
    if (command.type === 'SETTLE_SEASON') {
      const season = snapshot.state.season;
      expect(new Set(season.matches.map((match) => match.id)).size).toBe(season.matches.length);
      expect(season.matches.reduce((sum, match) => sum + match.minutes, 0)).toBe(
        season.playerStats.minutes,
      );
      for (const fixture of season.schedule.filter((entry) => entry.skipped === undefined)) {
        expect(
          season.matches.filter(
            (match) =>
              match.step === fixture.step &&
              match.order === fixture.order &&
              match.competitionId === fixture.competitionId,
          ),
        ).toHaveLength(1);
      }
    }
    const next = execute(snapshot, command);
    expect(execute(snapshot, command).stateHash).toBe(next.stateHash);
    commands.push(command);
    snapshots.push(next);
    snapshot = next;
  }
  throw new Error('annual command bound exceeded');
}

describe('annual natural command progression', () => {
  it('finishes exactly one year, resumes the same checkpoint, and every visible decision executes (4 positions × 3 years)', () => {
    const cohort = [];
    const families = new Set(),
      resumeReasons = new Set();
    for (const group of ['GK', 'DF', 'MF', 'FW']) {
      let snapshot = create(group);
      for (let year = 1; year <= 3; year += 1) {
        const before = snapshot;
        const result = runYear(snapshot);
        snapshot = result.snapshot;
        expect(snapshot.state.seasonHistory.length).toBe(year);
        expect(snapshot.state.age).toBe(before.state.age + 1);
        expect(result.commands.filter((command) => command.type === 'SETTLE_SEASON')).toHaveLength(
          1,
        );
        expect(result.commands.filter((command) => command.type === 'START_SEASON')).toHaveLength(
          1,
        );
        expect(CareerStateSchema.parse(JSON.parse(JSON.stringify(snapshot.state)))).toEqual(
          snapshot.state,
        );
        for (const observed of result.snapshots) {
          for (const thread of observed.state.annualStories?.threads ?? [])
            families.add(thread.family);
          if (observed.state.annualStories?.resumeReason)
            resumeReasons.add(observed.state.annualStories.resumeReason);
        }
        for (const delta of result.report.attributes)
          expect(delta.delta).toBe(delta.settlementDelta + delta.duringYearDelta);
        expect(result.report.baseOvr.delta).toBe(
          snapshot.state.player.profile.baseOvr - before.state.player.profile.baseOvr,
        );
        cohort.push({
          group,
          year,
          minutes: result.report.minutes,
          ovr: result.report.baseOvr,
          pauses: result.decisions.map((decision) => decision.event ?? decision.kind),
          stories: snapshot.state.annualStories?.threads.map((thread) => ({
            family: thread.family,
            stage: thread.stage,
          })),
        });
        // True resumed execution from an observed snapshot, not a synthetic season/pending.
        const split = Math.floor(result.commands.length / 2);
        let resumed = result.snapshots[split - 1];
        for (const command of result.commands.slice(split)) resumed = execute(resumed, command);
        expect(resumed.stateHash).toBe(snapshot.stateHash);
      }
    }
    expect([...families].sort()).toEqual(['OPPORTUNITY', 'ROLE_TENSION', 'SCOUT_INTEREST']);
    expect(resumeReasons.has('DEVELOPMENT') || resumeReasons.has('CHAPTER')).toBe(true);
    writeFileSync(`${evidenceDir}/cohort.json`, JSON.stringify(cohort, null, 2));
    writeFileSync(
      `${evidenceDir}/coverage.json`,
      JSON.stringify({ families: [...families], resumeReasons: [...resumeReasons] }, null, 2),
    );
  }, 60_000);

  it('partial-year runs never advance into a second year, and rejects a different career checkpoint', () => {
    const initial = create('FW', 1);
    const year = runYear(initial, undefined, false);
    const middle = year.snapshots.find(
      (entry) => entry.state.season?.currentStep >= 5 && entry.state.pending === null,
    );
    expect(middle).toBeDefined();
    const remaining = runYear(middle, undefined, false);
    expect(remaining.report.startedMidSeason).toBe(true);
    expect(remaining.snapshot.state.seasonHistory).toHaveLength(1);
    expect(remaining.commands.some((command) => command.type === 'START_SEASON')).toBe(false);
    expect(
      nextAnnualAction(create('GK', 1), ruleset, year.checkpoint, {
        advance: { eligibleEvents: [] },
      }),
    ).toMatchObject({ status: 'ERROR', code: 'ANNUAL_STATE_MISMATCH' });
  }, 30_000);

  it('minutes drive growth with no zero-minute playing credit; age and potential still cap it', () => {
    const snapshot = create('FW', 2);
    const state = snapshot.state;
    const base = {
      age: 19,
      attributes: state.attributes,
      archetypeId: state.player.profile.archetypeId,
      truePotential: 99,
      baseOvrBefore: state.player.profile.baseOvr,
      ratedMatches: 0,
      ratingSumTenths: 0,
      trainingFocus: 'ROLE',
      growthCarryCenti: Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, 0])),
    };
    const rows = [0, 30, 900, 2400].map((minutes) => computeGrowth({ ...base, minutes }, ruleset));
    expect(
      rows[0].attributeDeltas
        .flatMap((entry) => entry.causes)
        .filter((cause) => cause.cause === 'MINUTES'),
    ).toEqual([]);
    expect(rows[3].baseOvr.after).toBeGreaterThan(rows[0].baseOvr.after);
    expect(rows.map((row) => row.baseOvr.after)).toEqual(
      rows.map((row) => row.baseOvr.after).sort((a, b) => a - b),
    );
    expect(
      computeGrowth({ ...base, minutes: 2400, truePotential: base.baseOvrBefore }, ruleset).baseOvr
        .after,
    ).toBeLessThanOrEqual(base.baseOvrBefore);
    const veteran = computeGrowth({ ...base, age: 37, minutes: 2400 }, ruleset);
    expect(veteran.baseOvr.after).toBeLessThanOrEqual(rows[3].baseOvr.after);
    writeFileSync(
      `${evidenceDir}/growth.json`,
      JSON.stringify(
        rows.map((row, i) => ({ minutes: [0, 30, 900, 2400][i], ovr: row.baseOvr })),
        null,
        2,
      ),
    );
  });

  it('natural opportunity choices change a real selection input; no inverse expiry or duplicate direct-training gain', () => {
    let result, offered, changed;
    for (let seed = 0; seed < 12 && !changed; seed += 1) {
      result = runYear(create('GK', seed), undefined, false);
      offered = result.snapshots.find((entry) => entry.state.pending?.eventId === 'EVT-DEV-140');
      if (!offered) continue;
      const choices = buildAnnualContentContext(pack, offered.state).pending.choices;
      changed = choices
        .slice(0, 2)
        .map((choice) => execute(offered, choice.command))
        .find(
          (next) =>
            next.state.relationships.managerTrust > offered.state.relationships.managerTrust,
        );
    }
    expect(changed).toBeDefined();
    const input = {
      tacticalFit: offered.state.context.tacticalFit,
      managerTrust: offered.state.relationships.managerTrust,
      expectedPerformance: 60,
      squadStatus: offered.state.context.squadStatus,
    };
    expect(
      computeSelectionScore(
        { ...input, managerTrust: changed.state.relationships.managerTrust },
        ruleset.selectionRules,
      ),
    ).toBeGreaterThan(computeSelectionScore(input, ruleset.selectionRules));
    expect(
      changed.state.activeEffects.some((effect) => effect.sourceId.startsWith('EVT-DEV-140')),
    ).toBe(false);
    expect(
      result.snapshot.state.development.sessions.every((session) => session.gains.length === 0),
    ).toBe(true);
    for (const source of result.snapshots.filter((entry) =>
      entry.state.pending?.eventId?.match(/^EVT-(DEV|MGR|REL)-14[024]$/),
    )) {
      const all = buildAnnualContentContext(pack, source.state).pending.choices;
      const rejected = execute(source, all.find((choice) => choice.id === 'C').command);
      expect(rejected.state.annualStories.threads.at(-1).stage).toBe('CLOSED');
    }
  }, 30_000);

  it('cross-season follow-up uses cumulative real minutes and original failure, and does not inherit another coach (unit counterfactual)', () => {
    const year = runYear(create('GK'), undefined, false);
    const observed = year.snapshots.find((entry) => entry.state.pending?.eventId === 'EVT-DEV-140');
    const root = observed.state.annualStories.threads[0];
    const state = structuredClone(observed.state);
    state.pending = { kind: 'EVENT', eventId: 'EVT-DEV-141', version: 1 };
    state.annualStories.threads = [
      {
        ...root,
        sourceMinutes: 300,
        sourceSeason: 1,
        stage: 'FOLLOW_UP',
        choiceId: 'A',
        outcome: 'SUCCESS',
      },
    ];
    state.seasonHistory = [{ index: 1, result: { playerStats: { minutes: 480 } } }];
    state.season.index = 2;
    state.season.playerStats.minutes = 90;
    expect(
      buildAnnualContentContext(pack, state).pending.choices.map((choice) => choice.id),
    ).toEqual(['A']);
    state.annualStories.threads[0].outcome = 'FAIL';
    expect(
      buildAnnualContentContext(pack, state).pending.choices.map((choice) => choice.id),
    ).toEqual(['B']);
    state.pending = null;
    state.currentStep = 4;
    state.annualStories.evaluatedWindows = [];
    state.season.manager.id = 'different-coach';
    expect(openAnnualStory(state, [], 999).annualStories.threads[0].stage).toBe('CANCELLED');
    expect(pack.eventsById.get('EVT-MGR-143').narrative.situation).not.toContain('합의');
  }, 30_000);

  it('does not interrupt forced medical/national same-step recovery with another story (boundary unit)', () => {
    const year = runYear(create('FW'), undefined, false);
    const observed = year.snapshots.find(
      (entry) =>
        entry.state.season !== null &&
        entry.state.pending === null &&
        entry.state.currentStep >= 2 &&
        entry.state.currentStep <= 10,
    );
    for (const kind of ['REHAB_CHOSEN', 'NATIONAL_TEAM_CALLED', 'NATIONAL_TEAM_DECLINED']) {
      const state = {
        ...observed.state,
        timeline: [
          ...observed.state.timeline,
          {
            kind,
            revision: observed.revision,
            step: observed.state.currentStep,
            age: observed.state.age,
            refId: 'boundary-unit',
          },
        ],
      };
      expect(
        openAnnualStory(
          state,
          [{ eventId: 'EVT-MGR-142', version: 1, weight: 100 }],
          observed.revision + 1,
        ),
      ).toBe(state);
    }
  }, 30_000);
});
