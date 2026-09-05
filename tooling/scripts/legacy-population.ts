import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { loadRetirementArtifacts } from '../../packages/content/src/retirement-artifacts.ts';
import { loadRuleset } from '../../packages/content/src/rulesets/load-ruleset.ts';
import { loadContentPack } from '../../packages/content/src/packs/load-content-pack.ts';
import { canonicalize, type JsonValue } from '../../packages/domain/src/canonical.ts';
import { createCareerArchiveCore } from '../../packages/domain/src/legacy/archive.ts';
import { createLegacyResult, LEGACY_POLICY } from '../../packages/domain/src/legacy/result.ts';
import { retirementDecisionRequired } from '../../packages/domain/src/legacy/career-retirement.ts';
import { sha256Hex } from '../../packages/domain/src/hash.ts';
import { careerEventChoices } from '../../packages/domain/src/legacy/career-event.ts';
import {
  advancePayload,
  commandForPending,
  chooseDeterministicIndex,
} from './legacy-population-choices.ts';
import { simulate, verifySnapshot, type Command } from '../../packages/domain/src/simulate.ts';
import {
  statGroupOf,
  type DomainSnapshot,
  type SimulationMode,
  type StatGroup,
} from '../../packages/domain/src/types.ts';

const RULESET_VERSION = '1.0.0';
const CONTENT_PACK_VERSION = '0.3.0';
const POSITIONS = ['GK', 'DF', 'MF', 'FW'] as const satisfies readonly StatGroup[];
const PROTOCOL_VERSION = 'phase5-population-2-registered-choices';
type Position = (typeof POSITIONS)[number];
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
  archetypeId: string;
  backgroundId: string;
  simulationMode: SimulationMode;
  finalChoice: string;
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
  artifacts: ReturnType<typeof sourceArtifacts>;
  groups: Partial<Record<Position, Group>>;
};
const GENERATOR_CODE_HASH = process.env.LEGACY_POPULATION_BUNDLE_HASH ?? 'UNHASHED_WORKTREE';
function canonicalAny(value: unknown): string {
  return canonicalize(value as JsonValue);
}
const runtimeRuleset = loadRuleset(RULESET_VERSION);
const runtimePack = loadContentPack(CONTENT_PACK_VERSION);
const POLICY_CHECKSUM = sha256Hex(canonicalAny(LEGACY_POLICY));
// A published reference population must never become an input to its own generation.
function sourceArtifacts() {
  const { rulesetVersion, rulesetChecksum, contentPackVersion, contentPackChecksum } =
    loadRetirementArtifacts(RULESET_VERSION, CONTENT_PACK_VERSION);
  return { rulesetVersion, rulesetChecksum, contentPackVersion, contentPackChecksum };
}

function command(
  snapshot: DomainSnapshot | null,
  type: Command['type'],
  payload: unknown,
  id: string,
): DomainSnapshot {
  const result = simulate({
    snapshot,
    command: {
      type,
      payload,
      commandId: id,
      expectedRevision: snapshot?.revision ?? 0,
    } as Command & {
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
  const seed = snapshot.state.careerId;
  const registered = commandForPending(snapshot.state, runtimePack, seed);
  if (registered !== undefined) return command(snapshot, registered.type, registered.payload, id);
  if (pending?.kind === 'OFFERS' || pending?.kind === 'CONTRACT') {
    const offers = pending.offers.filter(
      (offer) =>
        offer.negotiationState !== 'WITHDRAWN' &&
        (offer.validUntilRevision === null || offer.validUntilRevision >= snapshot.revision + 1),
    );
    const index = chooseDeterministicIndex(
      seed,
      `market:${snapshot.state.seasonHistory.length}:${snapshot.state.currentStep}`,
      offers.length + 1,
    );
    const offer = offers[index] ?? (snapshot.state.contract === null ? offers[0] : undefined);
    return offer === undefined
      ? command(snapshot, 'REJECT_OFFER', { offerId: null }, id)
      : command(snapshot, 'ACCEPT_OFFER', { offerId: offer.id }, id);
  }
  if (pending?.kind === 'ROLE_PROPOSAL') {
    // Preserve the position stratum: cross-group changes are explicitly declined.
    const crossesGroup =
      pending.proposal.type === 'POSITION_CHANGE' &&
      statGroupOf(pending.proposal.to) !==
        statGroupOf(snapshot.state.player.profile!.primaryPosition);
    const accept =
      !crossesGroup && chooseDeterministicIndex(seed, `role:${snapshot.revision}`, 2) === 0;
    return command(snapshot, 'RESOLVE_ROLE', { decision: accept ? 'ACCEPT' : 'DECLINE' }, id);
  }
  if (pending?.kind === 'LOAN_RETURN') {
    return command(
      snapshot,
      'LOAN_RETURN',
      {
        decision:
          pending.options[
            chooseDeterministicIndex(seed, `loan:${snapshot.revision}`, pending.options.length)
          ],
      },
      id,
    );
  }
  if (pending !== null && pending?.kind !== 'SETTLEMENT')
    throw new Error(`Unhandled pending ${pending?.kind}`);
  return snapshot;
}

function runCareer(position: Position, seedIndex: number, requestedSeasons: number): PopulationRow {
  const seed = `phase5-population:${position}:${seedIndex}`;
  const archetypes = runtimeRuleset.archetypes.filter((a) => statGroupOf(a.position) === position);
  const archetype = archetypes[chooseDeterministicIndex(seed, 'archetype', archetypes.length)]!;
  const background =
    runtimeRuleset.backgrounds[
      chooseDeterministicIndex(seed, 'background', runtimeRuleset.backgrounds.length)
    ]!;
  const simulationMode: SimulationMode =
    chooseDeterministicIndex(seed, 'mode', 2) === 0 ? 'FAST' : 'CHAPTER';
  let snapshot = command(
    null,
    'CREATE_CAREER',
    {
      careerId: `population-${position}-${seedIndex}`,
      seed,
      simulationMode,
      rulesetVersion: RULESET_VERSION,
      contentPackVersion: CONTENT_PACK_VERSION,
    },
    `${seed}-create`,
  );
  snapshot = command(
    snapshot,
    'UPDATE_PLAYER_DRAFT',
    {
      draft: {
        name: `표본 ${position} ${seedIndex}`,
        gender: chooseDeterministicIndex(seed, 'gender', 2) === 0 ? 'MALE' : 'FEMALE',
        nationalityCode: 'KR',
        preferredFoot: ['LEFT', 'RIGHT', 'BOTH'][chooseDeterministicIndex(seed, 'foot', 3)],
        position: archetype.position,
        archetypeId: archetype.id,
        backgroundId: background.id,
      },
    },
    `${seed}-draft`,
  );
  snapshot = command(snapshot, 'CONFIRM_PLAYER', {}, `${seed}-confirm`);
  for (let step = 0; snapshot.state.contract === null && step < 100; step++) {
    snapshot =
      snapshot.state.pending === null
        ? command(
            snapshot,
            'ADVANCE',
            advancePayload(snapshot.state, runtimePack),
            `${seed}-youth-${step}`,
          )
        : closePending(snapshot, `${seed}-youth-${step}`);
  }
  if (snapshot.state.contract === null) throw new Error(`No first contract for ${seed}`);
  let seasons = 0;
  while (seasons < requestedSeasons) {
    for (let step = 0; snapshot.state.pending !== null && step < 100; step++)
      snapshot = closePending(snapshot, `${seed}-boundary-${seasons}-${step}`);
    if (seasons > 0 && retirementDecisionRequired(snapshot.state)) break;
    for (let decision = 0; decision < 3; decision++) {
      const choices = careerEventChoices(snapshot.state);
      const eligible = choices.filter(
        (choice) =>
          choice !== 'MENTOR' || chooseDeterministicIndex(seed, `mentor:${seasons}`, 2) === 0,
      );
      if (eligible.length === 0) break;
      // Sample eligible U23 first; service options disappear if a medal grants special service.
      const choice = eligible.includes('INTERNATIONAL')
        ? 'INTERNATIONAL'
        : eligible[
            chooseDeterministicIndex(seed, `career-event:${seasons}:${decision}`, eligible.length)
          ];
      snapshot = command(
        snapshot,
        'CAREER_EVENT',
        { choice },
        `${seed}-career-event-${seasons}-${decision}`,
      );
    }
    seasons += 1;
    const seasonIndex = seasons;
    snapshot = command(
      snapshot,
      'START_SEASON',
      {
        simulationMode,
        trainingFocus: ['ROLE', 'TECHNICAL', 'PHYSICAL', 'MENTAL'][
          chooseDeterministicIndex(seed, `training:${seasons}`, 4)
        ],
        serviceSeasonId: `population-${position}-${seedIndex}-${seasonIndex}`,
        legacyLedger: true,
      },
      `${position}-${seedIndex}-${seasonIndex}-start`,
    );
    for (let step = 0; step < 200; step += 1) {
      if (snapshot.state.pending?.kind === 'SETTLEMENT') {
        snapshot = command(
          snapshot,
          'SETTLE_SEASON',
          {},
          `${position}-${seedIndex}-${seasonIndex}-${step}-settle`,
        );
        break;
      }
      snapshot =
        snapshot.state.pending === null
          ? command(
              snapshot,
              'ADVANCE',
              advancePayload(snapshot.state, runtimePack),
              `${seed}-${seasonIndex}-${step}-advance`,
            )
          : closePending(snapshot, `${seed}-${seasonIndex}-${step}-resolve`);
    }
    if (snapshot.state.season !== null || snapshot.state.seasonHistory.length !== seasonIndex)
      throw new Error(`season ${seasonIndex} did not settle for ${position}/${seedIndex}`);
    const verification = verifySnapshot(snapshot);
    if (!verification.ok)
      throw new Error(`invalid snapshot for ${position}/${seedIndex}: ${verification.reason}`);
  }
  for (let step = 0; snapshot.state.pending !== null && step < 100; step++)
    snapshot = closePending(snapshot, `${seed}-retire-before-${step}`);
  const finalChoice =
    chooseDeterministicIndex(seed, 'epilogue', 2) === 0 ? 'RETIRE' : 'COACH_EPILOGUE';
  snapshot = command(
    snapshot,
    'RETIRE',
    { choice: finalChoice },
    `${position}-${seedIndex}-retire`,
  );
  if (snapshot.state.status !== 'RETIRED')
    throw new Error(`retirement did not settle for ${position}/${seedIndex}`);
  if (statGroupOf(snapshot.state.player.profile!.primaryPosition) !== position)
    throw new Error(`position stratum drift for ${position}/${seedIndex}`);
  const artifacts = sourceArtifacts();
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
    archetypeId: archetype.id,
    backgroundId: background.id,
    simulationMode,
    finalChoice,
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
    choicePolicy: 'registered-hash-strata-v1',
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
  const artifacts = sourceArtifacts();
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
  for (const position of positions) {
    const existing = checkpoint.groups[position];
    const rows = [...(existing?.rows ?? [])];
    for (let index = rows.length; index < count; index += 1) {
      const requestedSeasons = (index % seasons) + 1;
      rows.push(runCareer(position, index, requestedSeasons));
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
