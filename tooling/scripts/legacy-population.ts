import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { loadRetirementArtifacts } from '../../packages/content/src/retirement-artifacts.ts';
import { loadRuleset } from '../../packages/content/src/rulesets/load-ruleset.ts';
import { canonicalize, type JsonValue } from '../../packages/domain/src/canonical.ts';
import { createCareerArchiveCore } from '../../packages/domain/src/legacy/archive.ts';
import { createLegacyResult, LEGACY_POLICY } from '../../packages/domain/src/legacy/result.ts';
import { retirementDecisionRequired } from '../../packages/domain/src/legacy/career-retirement.ts';
import { sha256Hex } from '../../packages/domain/src/hash.ts';
import {
  runCareerFixture,
  type CareerFixture,
} from '../../packages/domain/src/__fixtures__/career-01.ts';
import { careerGkFixture } from '../../packages/domain/src/__fixtures__/career-04-gk.ts';
import { careerDfFixture } from '../../packages/domain/src/__fixtures__/career-07-df.ts';
import { careerMfFixture } from '../../packages/domain/src/__fixtures__/career-08-mf.ts';
import { careerFwFixture } from '../../packages/domain/src/__fixtures__/career-09-fw.ts';
import seasonRaw from '../../packages/domain/src/__fixtures__/career-02-season.json' with { type: 'json' };
import { simulate, verifySnapshot, type Command } from '../../packages/domain/src/simulate.ts';
import type { DomainSnapshot, SimulationMode, StatGroup } from '../../packages/domain/src/types.ts';

const RULESET_VERSION = '1.0.0';
const CONTENT_PACK_VERSION = '0.1.0';
const POSITIONS = ['GK', 'DF', 'MF', 'FW'] as const satisfies readonly StatGroup[];
const PROTOCOL_VERSION = 'phase5-population-1';
type Position = (typeof POSITIONS)[number];
type SeasonLog = { commands: Array<{ type: Command['type']; payload: unknown }> };
type PopulationRow = Readonly<{
  position: Position;
  seedIndex: number;
  seed: string;
  requestedSeasons: number;
  seasons: number;
  score: number;
  bandId: string;
  endingId: string;
  archiveHash: string;
  resultHash: string;
}>;
type Group = Readonly<{ position: Position; rows: readonly PopulationRow[]; hash: string }>;
type Checkpoint = {
  protocolVersion: string;
  generatorCodeHash: string;
  rulesetVersion: string;
  contentPackVersion: string;
  policyChecksum: string;
  countPerPosition: number;
  maxSeasons: number;
  artifacts: ReturnType<typeof loadRetirementArtifacts>;
  groups: Partial<Record<Position, Group>>;
};
const GENERATOR_CODE_HASH = process.env.LEGACY_POPULATION_BUNDLE_HASH ?? 'UNHASHED_WORKTREE';
function canonicalAny(value: unknown): string {
  return canonicalize(value as JsonValue);
}
const runtimeRuleset = loadRuleset(RULESET_VERSION);
const POLICY_CHECKSUM = sha256Hex(canonicalAny(LEGACY_POLICY));

const seasonLog = (seasonRaw as { commands: Record<SimulationMode, SeasonLog['commands']> })
  .commands.FAST;
const fixtureEvent = seasonLog.find((command) => command.type === 'ADVANCE')?.payload;
if (fixtureEvent === undefined) throw new Error('FAST fixture has no ADVANCE payload');

function command(
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
    ruleset: runtimeRuleset,
    rulesetVersion: RULESET_VERSION,
    contentPackVersion: CONTENT_PACK_VERSION,
  });
  if (!result.ok) throw new Error(`${type} failed: ${result.error.code}: ${result.error.message}`);
  return result.snapshot;
}

function closePending(snapshot: DomainSnapshot, id: string): DomainSnapshot {
  const pending = snapshot.state.pending;
  if (pending?.kind === 'OFFERS' || pending?.kind === 'CONTRACT')
    return command(snapshot, 'REJECT_OFFER', { offerId: null }, `${id}-reject`);
  if (pending?.kind === 'ROLE_PROPOSAL')
    return command(snapshot, 'RESOLVE_ROLE', { decision: 'ACCEPT' }, `${id}-role`);
  if (pending?.kind === 'EVENT')
    return command(
      snapshot,
      'RESOLVE_EVENT',
      {
        eventId: pending.eventId,
        definitionVersion: pending.version,
        choiceId: 'A',
        outcomes: [{ id: 'A1', kind: 'FIXED', weight: 100, effects: [] }],
      },
      `${id}-event`,
    );
  if (pending?.kind === 'INJURY')
    return command(
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
  if (pending?.kind === 'NATIONAL_TEAM')
    return command(
      snapshot,
      'RESOLVE_EVENT',
      {
        eventId: pending.eventId,
        definitionVersion: pending.version,
        choiceId: 'C',
        outcomes: [{ id: 'C1', kind: 'FIXED', weight: 100, effects: [] }],
        callUp: 'DECLINE',
      },
      `${id}-national`,
    );
  return snapshot;
}

function runCareer(
  fixture: CareerFixture,
  position: Position,
  seedIndex: number,
  requestedSeasons: number,
): PopulationRow {
  const seed = `phase5-population:${position}:${seedIndex}`;
  let snapshot = runCareerFixture(
    {
      ...fixture,
      createCareer: {
        ...fixture.createCareer,
        careerId: `population-${position}-${seedIndex}`,
        seed,
      },
    },
    runtimeRuleset,
  );
  let seasons = 0;
  while (seasons < requestedSeasons) {
    seasons += 1;
    const seasonIndex = seasons;
    snapshot = closePending(snapshot, `${position}-${seedIndex}-${seasonIndex}-before`);
    snapshot = command(
      snapshot,
      'START_SEASON',
      {
        simulationMode: 'FAST',
        serviceSeasonId: `population-${position}-${seedIndex}-${seasonIndex}`,
        legacyLedger: true,
      },
      `${position}-${seedIndex}-${seasonIndex}-start`,
    );
    for (let step = 0; step < 100; step += 1) {
      snapshot = closePending(snapshot, `${position}-${seedIndex}-${seasonIndex}-${step}`);
      if (snapshot.state.pending?.kind === 'SETTLEMENT') {
        snapshot = command(
          snapshot,
          'SETTLE_SEASON',
          {},
          `${position}-${seedIndex}-${seasonIndex}-${step}-settle`,
        );
        break;
      }
      snapshot = command(
        snapshot,
        'ADVANCE',
        fixtureEvent,
        `${position}-${seedIndex}-${seasonIndex}-${step}-advance`,
      );
    }
    if (snapshot.state.season !== null || snapshot.state.seasonHistory.length !== seasonIndex)
      throw new Error(`season ${seasonIndex} did not settle for ${position}/${seedIndex}`);
    const verification = verifySnapshot(snapshot);
    if (!verification.ok)
      throw new Error(`invalid snapshot for ${position}/${seedIndex}: ${verification.reason}`);
    if (retirementDecisionRequired(snapshot.state)) break;
  }
  snapshot = closePending(snapshot, `${position}-${seedIndex}-retire-before`);
  snapshot = command(snapshot, 'RETIRE', { choice: 'RETIRE' }, `${position}-${seedIndex}-retire`);
  if (snapshot.state.status !== 'RETIRED')
    throw new Error(`retirement did not settle for ${position}/${seedIndex}`);
  const artifacts = loadRetirementArtifacts(RULESET_VERSION, CONTENT_PACK_VERSION);
  const context = {
    binding: {
      careerId: snapshot.state.careerId,
      createdServiceSeasonId: `population-${position}-${seedIndex}-1`,
      rulesetVersion: RULESET_VERSION,
      contentPackVersion: CONTENT_PACK_VERSION,
    },
    artifacts,
  };
  const archive = createCareerArchiveCore(snapshot, context);
  const result = createLegacyResult(archive, context);
  return {
    position,
    seedIndex,
    seed,
    requestedSeasons,
    seasons,
    score: result.totalScore,
    bandId: result.bandId,
    endingId: result.endingId,
    archiveHash: archive.hash,
    resultHash: result.hash,
  };
}

function hashRows(rows: readonly PopulationRow[]): string {
  return sha256Hex(canonicalAny(rows));
}
function seedFor(position: Position, index: number): string {
  return `phase5-population:${position}:${index}`;
}
function parseIntArg(args: string[], name: string, fallback: number): number {
  const index = args.indexOf(name);
  const value = index >= 0 ? Number(args[index + 1]) : fallback;
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`);
  return value;
}
function arg(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
}

async function readCheckpoint(
  path: string,
  artifacts: Checkpoint['artifacts'],
  count: number,
  maxSeasons: number,
): Promise<Checkpoint> {
  try {
    const checkpoint = JSON.parse(await readFile(path, 'utf8')) as Checkpoint;
    if (
      checkpoint.protocolVersion !== PROTOCOL_VERSION ||
      checkpoint.generatorCodeHash !== GENERATOR_CODE_HASH ||
      checkpoint.rulesetVersion !== RULESET_VERSION ||
      checkpoint.contentPackVersion !== CONTENT_PACK_VERSION ||
      checkpoint.policyChecksum !== POLICY_CHECKSUM ||
      checkpoint.countPerPosition !== count ||
      checkpoint.maxSeasons !== maxSeasons ||
      JSON.stringify(checkpoint.artifacts) !== JSON.stringify(artifacts)
    )
      throw new Error('checkpoint protocol/code/version/policy/count/artifact mismatch');
    for (const position of POSITIONS) {
      const group = checkpoint.groups[position];
      if (group !== undefined) {
        if (
          group.position !== position ||
          group.hash !== hashRows(group.rows) ||
          group.rows.length > count
        )
          throw new Error(`checkpoint group ${position} hash/count mismatch`);
        group.rows.forEach((row, index) => {
          const requestedSeasons = (index % maxSeasons) + 1;
          if (
            row.seedIndex !== index ||
            row.seed !== seedFor(position, index) ||
            row.requestedSeasons !== requestedSeasons ||
            row.seasons < 1 ||
            row.seasons > requestedSeasons
          )
            throw new Error(`checkpoint group ${position} seed/length mismatch at ${index}`);
        });
      }
    }
    return checkpoint;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      return {
        protocolVersion: PROTOCOL_VERSION,
        generatorCodeHash: GENERATOR_CODE_HASH,
        rulesetVersion: RULESET_VERSION,
        contentPackVersion: CONTENT_PACK_VERSION,
        policyChecksum: POLICY_CHECKSUM,
        countPerPosition: count,
        maxSeasons,
        artifacts,
        groups: {},
      };
    throw error;
  }
}

async function writeCheckpoint(path: string, checkpoint: Checkpoint): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(checkpoint, null, 2)}\n`, 'utf8');
  await rename(temporary, path);
}

async function writePopulation(
  path: string,
  checkpoint: Checkpoint,
  count: number,
  seasons: number,
  smoke: boolean,
): Promise<void> {
  const groups = POSITIONS.map((position) => checkpoint.groups[position]);
  if (groups.some((group) => group === undefined || group.rows.length !== count))
    throw new Error('refusing partial population publish');
  if (count < 10_000 && !smoke)
    throw new Error(
      'count below 10000 is smoke-only; pass --smoke for an explicit non-publishing report',
    );
  const scores = Object.fromEntries(
    POSITIONS.map((position) => [
      position,
      checkpoint.groups[position]!.rows.map((row) => row.score).sort((a, b) => a - b),
    ]),
  ) as Record<Position, number[]>;
  const population = {
    id: `phase5-reference-${RULESET_VERSION}-${CONTENT_PACK_VERSION}`,
    legacyVersion: '1.0.0',
    rulesetVersion: RULESET_VERSION,
    scores,
  };
  const provenance = {
    protocolVersion: PROTOCOL_VERSION,
    generatorCodeHash: process.env.LEGACY_POPULATION_BUNDLE_HASH ?? 'UNHASHED_WORKTREE',
    seedPolicy: 'phase5-population:<position>:<zero-based-index>',
    requestedSeasonPolicy: '1 + (seedIndex mod --seasons)',
    rulesetVersion: RULESET_VERSION,
    contentPackVersion: CONTENT_PACK_VERSION,
    artifacts: checkpoint.artifacts,
    policyChecksum: POLICY_CHECKSUM,
    countPerPosition: count,
    maxSeasons: seasons,
  };
  const payload = { population, provenance, groups };
  await mkdir(dirname(path), { recursive: true });
  if (smoke) {
    await writeFile(
      path,
      `${JSON.stringify({ kind: 'SMOKE_REPORT', ...payload, smoke: true }, null, 2)}\n`,
      'utf8',
    );
    return;
  }
  await writeFile(
    path,
    `${JSON.stringify({ kind: 'REFERENCE_POPULATION', ...payload, populationHash: sha256Hex(canonicalAny(payload)) }, null, 2)}\n`,
    'utf8',
  );
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const count = parseIntArg(argv, '--count', 10000);
  const seasons = parseIntArg(argv, '--seasons', 20);
  if (seasons > 20) throw new Error('--seasons must be between 1 and 20');
  const checkpointPath = resolve(
    arg(argv, '--checkpoint') ?? 'artifacts/legacy-population.checkpoint.json',
  );
  const outputPath = resolve(arg(argv, '--out') ?? 'artifacts/legacy-population.json');
  const smoke = argv.includes('--smoke');
  const artifacts = loadRetirementArtifacts(RULESET_VERSION, CONTENT_PACK_VERSION);
  const positionArg = arg(argv, '--position');
  const positions =
    positionArg === undefined
      ? POSITIONS
      : POSITIONS.filter((position) => position === positionArg);
  if (positions.length === 0) throw new Error(`--position must be one of ${POSITIONS.join(', ')}`);
  const mergeArg = arg(argv, '--merge-checkpoints');
  if (mergeArg !== undefined) {
    const merged: Checkpoint = {
      protocolVersion: PROTOCOL_VERSION,
      generatorCodeHash: GENERATOR_CODE_HASH,
      rulesetVersion: RULESET_VERSION,
      contentPackVersion: CONTENT_PACK_VERSION,
      policyChecksum: POLICY_CHECKSUM,
      countPerPosition: count,
      maxSeasons: seasons,
      artifacts,
      groups: {},
    };
    for (const path of mergeArg.split(',').filter(Boolean)) {
      const part = await readCheckpoint(resolve(path), artifacts, count, seasons);
      for (const position of POSITIONS) {
        const group = part.groups[position];
        if (group !== undefined) {
          if (merged.groups[position] !== undefined)
            throw new Error(`duplicate checkpoint group ${position}`);
          merged.groups[position] = group;
        }
      }
    }
    await writePopulation(outputPath, merged, count, seasons, smoke);
    return;
  }
  const checkpoint = await readCheckpoint(checkpointPath, artifacts, count, seasons);
  const fixtures: Record<Position, CareerFixture> = {
    GK: careerGkFixture,
    DF: careerDfFixture,
    MF: careerMfFixture,
    FW: careerFwFixture,
  };
  for (const position of positions) {
    const existing = checkpoint.groups[position];
    const rows = [...(existing?.rows ?? [])];
    for (let index = rows.length; index < count; index += 1) {
      const requestedSeasons = (index % seasons) + 1;
      rows.push(runCareer(fixtures[position], position, index, requestedSeasons));
      if (rows.length % 100 === 0 || rows.length === count) {
        checkpoint.groups[position] = { position, rows, hash: hashRows(rows) };
        await writeCheckpoint(checkpointPath, checkpoint);
        console.log(`${position}: ${rows.length}/${count} careers verified`);
      }
    }
    checkpoint.groups[position] = { position, rows, hash: hashRows(rows) };
    await writeCheckpoint(checkpointPath, checkpoint);
  }
  if (positionArg !== undefined) return;
  await writePopulation(outputPath, checkpoint, count, seasons, smoke);
}

if (
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv.includes('--__population-run')
) {
  await main(process.argv.slice(2).filter((arg) => arg !== '--__population-run'));
}
