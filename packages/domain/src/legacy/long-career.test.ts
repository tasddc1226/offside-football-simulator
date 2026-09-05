import { describe, expect, it } from 'vitest';
import seasonLogRaw from '../__fixtures__/career-02-season.json';
import { careerGkFixture } from '../__fixtures__/career-04-gk.js';
import { careerDfFixture } from '../__fixtures__/career-07-df.js';
import { careerMfFixture } from '../__fixtures__/career-08-mf.js';
import { careerFwFixture } from '../__fixtures__/career-09-fw.js';
import { runCareerFixture, rulesetProto } from '../__fixtures__/career-01.js';
import { utf8Encode } from '../canonical.js';
import { simulate, verifySnapshot, type Command } from '../simulate.js';
import type { DomainSnapshot, SimulationMode } from '../types.js';
import {
  createCareerArchiveCore,
  verifyCareerArchiveCore,
  type CareerArchiveCore,
} from './archive.js';

type SeasonLog = {
  startSeason: { simulationMode: SimulationMode; serviceSeasonId: string };
  commands: Array<{ type: Command['type']; payload: unknown }>;
};

// This is the checked-in FAST command log used by the real season fixture. It is
// deliberately replayed through simulate; no SeasonSummary/seasonHistory is copied.
const seasonLog = (seasonLogRaw as { commands: Record<SimulationMode, SeasonLog['commands']> })
  .commands.FAST;
const fixtureEvent = seasonLog.find((command) => command.type === 'ADVANCE')!.payload;

function runCommand(
  snapshot: DomainSnapshot,
  type: Command['type'],
  payload: unknown,
  id: string,
): DomainSnapshot {
  const result = simulate({
    snapshot,
    command: { type, payload, commandId: id, expectedRevision: snapshot.revision } as Command & {
      commandId: string;
      expectedRevision: number;
    },
    ruleset: rulesetProto,
    rulesetVersion: '1.0.0',
    contentPackVersion: '0.1.0',
  });
  if (!result.ok) {
    throw new Error(
      `${type} failed: ${result.error.code} ${result.error.message}; pending=${snapshot.state.pending?.kind ?? 'none'}`,
    );
  }
  return result.snapshot;
}

function closeBlockingPending(snapshot: DomainSnapshot, id: string): DomainSnapshot {
  const pending = snapshot.state.pending;
  if (pending?.kind === 'OFFERS' || pending?.kind === 'CONTRACT') {
    return runCommand(snapshot, 'REJECT_OFFER', { offerId: null }, `${id}-market`);
  }
  if (pending?.kind === 'INJURY') {
    return runCommand(
      snapshot,
      'RESOLVE_EVENT',
      {
        eventId: pending.eventId,
        definitionVersion: pending.version,
        choiceId: 'A',
        outcomes: [{ id: 'A1', kind: 'FIXED', weight: 100, effects: [] }],
        rehabPlan: 'STANDARD',
      },
      `${id}-injury`,
    );
  }
  if (pending?.kind === 'NATIONAL_TEAM') {
    return runCommand(
      snapshot,
      'RESOLVE_EVENT',
      {
        eventId: pending.eventId,
        definitionVersion: pending.version,
        choiceId: 'C',
        outcomes: [{ id: 'C1', kind: 'FIXED', weight: 100, effects: [] }],
        callUp: 'DECLINE',
      },
      `${id}-national-team`,
    );
  }
  return snapshot;
}

type CareerFixtureInput = NonNullable<Parameters<typeof runCareerFixture>[0]>;

function runTwentySeasons(fixture: CareerFixtureInput): {
  snapshot: DomainSnapshot;
  archive: CareerArchiveCore;
} {
  let snapshot = runCareerFixture(fixture);
  const initialAge = snapshot.state.age;
  const initialTruePotential = snapshot.state.player.profile!.truePotential;

  for (let season = 1; season <= 20; season++) {
    snapshot = closeBlockingPending(snapshot, `long-career-${season}-before-start`);
    snapshot = runCommand(
      snapshot,
      'START_SEASON',
      {
        simulationMode: 'FAST',
        serviceSeasonId: `long-career-${fixture.createCareer.careerId}-${season}`,
      },
      `long-career-${season}-start`,
    );
    for (let step = 0; step < 100; step++) {
      snapshot = closeBlockingPending(snapshot, `long-career-${season}-${step}`);
      if (snapshot.state.pending?.kind === 'ROLE_PROPOSAL') {
        snapshot = runCommand(
          snapshot,
          'RESOLVE_ROLE',
          { decision: 'ACCEPT' },
          `long-career-${season}-${step}-role`,
        );
      } else if (snapshot.state.pending?.kind === 'EVENT') {
        const pending = snapshot.state.pending;
        snapshot = runCommand(
          snapshot,
          'RESOLVE_EVENT',
          {
            eventId: pending.eventId,
            definitionVersion: pending.version,
            choiceId: 'A',
            outcomes: [{ id: 'A1', kind: 'FIXED', weight: 100, effects: [] }],
          },
          `long-career-${season}-${step}-event`,
        );
      } else if (snapshot.state.pending?.kind === 'SETTLEMENT') {
        snapshot = runCommand(
          snapshot,
          'SETTLE_SEASON',
          {},
          `long-career-${season}-${step}-settle`,
        );
        break;
      } else {
        snapshot = runCommand(
          snapshot,
          'ADVANCE',
          fixtureEvent,
          `long-career-${season}-${step}-advance`,
        );
      }
    }
    expect(snapshot.state.season).toBeNull();
    expect(snapshot.state.seasonHistory).toHaveLength(season);
    expect(verifySnapshot(snapshot)).toEqual({ ok: true });
    expect(snapshot.state.player.profile!.truePotential).toBe(initialTruePotential);
    for (const value of Object.values(snapshot.state.attributes)) {
      expect(Number.isSafeInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
  }

  expect(snapshot.state.age).toBe(initialAge + 20);
  expect(snapshot.state.seasonHistory.map((summary) => summary.index)).toEqual(
    Array.from({ length: 20 }, (_, index) => index + 1),
  );
  snapshot = closeBlockingPending(snapshot, `long-career-final-market`);
  snapshot = runCommand(snapshot, 'RETIRE', { choice: 'RETIRE' }, 'long-career-retire');
  expect(snapshot.state.status).toBe('RETIRED');
  expect(snapshot.checkpoint).toBe('RETIREMENT');

  // Explicit test-registry artifact values; these are not production checksums.
  const context = {
    binding: {
      careerId: fixture.createCareer.careerId,
      createdServiceSeasonId: `long-career-${fixture.createCareer.careerId}-1`,
      rulesetVersion: '1.0.0',
      contentPackVersion: '0.1.0',
    },
    artifacts: {
      rulesetVersion: '1.0.0',
      rulesetChecksum: 'a'.repeat(64),
      contentPackVersion: '0.1.0',
      contentPackChecksum: 'b'.repeat(64),
    },
  } as const;
  const archive = createCareerArchiveCore(snapshot, context);
  expect(verifyCareerArchiveCore(archive, context)).toEqual({ ok: true });
  expect(archive.records.totals.seasons).toBe(20);
  expect(archive.records.sources).toHaveLength(20);
  expect(
    archive.records.positions.reduce((sum, position) => sum + position.totals.seasons, 0),
  ).toBe(20);

  const archiveBytes = utf8Encode(JSON.stringify(archive)).byteLength;
  expect(archiveBytes).toBeLessThanOrEqual(256 * 1024);

  const afterRetirement = simulate({
    snapshot,
    command: {
      type: 'ADVANCE',
      payload: { eligibleEvents: [] },
      commandId: 'long-career-after-retire-advance',
      expectedRevision: snapshot.revision,
    },
    ruleset: rulesetProto,
    rulesetVersion: '1.0.0',
    contentPackVersion: '0.1.0',
  });
  expect(afterRetirement).toMatchObject({
    ok: false,
    error: { details: { reason: 'CAREER_RETIRED' } },
  });
  return { snapshot, archive };
}

describe('Phase 5 long-career real-engine regression', () => {
  it(
    'completes 20 real FAST seasons for GK/DF/MF/FW without cloning season history',
    // Keep the runner timeout above the explicit performance budget so a budget
    // failure is reported by the assertion rather than by Vitest's watchdog.
    { timeout: 150_000 },
    () => {
      const fixtures = [careerGkFixture, careerDfFixture, careerMfFixture, careerFwFixture];
      const started = Date.now();
      const runs = fixtures.map(runTwentySeasons);
      const elapsedMs = Date.now() - started;

      // Explicit CI budget: this is a regression guard, not a claim about production latency.
      // This test proves real-engine 20-season completion and invariants only; it does not
      // establish the Phase 5 golden age-curve acceptance artifact.
      expect(elapsedMs).toBeLessThan(120_000);
      for (const { snapshot, archive } of runs) {
        expect(snapshot.state.seasonHistory).toHaveLength(20);
        expect(snapshot.state.age).toBeGreaterThan(20);
        expect(archive.records.totals.seasons).toBe(20);
      }
    },
  );
});
