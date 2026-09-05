import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { loadRetirementArtifacts } from '../../packages/content/src/retirement-artifacts.ts';
import { loadRuleset } from '../../packages/content/src/rulesets/load-ruleset.ts';
import {
  loadContentPack,
  type ContentPack,
} from '../../packages/content/src/packs/load-content-pack.ts';
import { canonicalize, type JsonValue } from '../../packages/domain/src/canonical.ts';
import { createCareerArchiveCore } from '../../packages/domain/src/legacy/archive.ts';
import {
  createLegacyResult,
  deriveLegacyEvidence,
  legacyPolicyForVersion,
  type LegacyVersion,
} from '../../packages/domain/src/legacy/result.ts';
import { retirementDecisionRequired } from '../../packages/domain/src/legacy/career-retirement.ts';
import { sha256Hex } from '../../packages/domain/src/hash.ts';
import { careerEventChoices } from '../../packages/domain/src/legacy/career-event.ts';
import { legacyPopulationId } from './legacy-population-identity.ts';
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
  type Offer,
  type TrainingFocus,
} from '../../packages/domain/src/types.ts';

const RULESET_VERSION = arg(process.argv.slice(2), '--ruleset-version') ?? '1.0.0';
const CONTENT_PACK_VERSION = '0.3.0';
const POSITIONS = ['GK', 'DF', 'MF', 'FW'] as const satisfies readonly StatGroup[];
export type PopulationStrategy = 'random' | 'opportunity' | 'mixed';
const configuredStrategy = arg(process.argv.slice(2), '--strategy') ?? 'random';
if (!['random', 'opportunity', 'mixed'].includes(configuredStrategy))
  throw new Error('--strategy must be random, opportunity, or mixed');
const STRATEGY = configuredStrategy as PopulationStrategy;
const PROTOCOL_VERSION =
  STRATEGY === 'random' && RULESET_VERSION === '1.0.0'
    ? 'phase5-population-3-ui-choices'
    : 'phase5-population-5-policy-isolation';
const CHOICE_POLICY = STRATEGY === 'random' ? 'ui-action-strata-v1' : `ui-${STRATEGY}-v1`;
export type Position = (typeof POSITIONS)[number];
export type PopulationRow = Readonly<{
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
  componentScores: Readonly<
    Record<'achievement' | 'contribution' | 'longevity' | 'relationship' | 'narrative', number>
  >;
  minutes: number;
  possibleMinutes: number;
  peakOvr: number;
  trophies: number;
  endingCandidates: readonly string[];
  strategy: string;
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
  legacyVersion: LegacyVersion;
  choicePolicy: string;
  range?: { start: number; end: number };
  artifacts: ReturnType<typeof sourceArtifacts>;
  groups: Partial<Record<Position, Group>>;
};
const GENERATOR_CODE_HASH = process.env.LEGACY_POPULATION_BUNDLE_HASH ?? 'UNHASHED_WORKTREE';
function canonicalAny(value: unknown): string {
  return canonicalize(value as JsonValue);
}
const runtimeRuleset = loadRuleset(RULESET_VERSION);
const runtimePack = loadContentPack(CONTENT_PACK_VERSION);

type PopulationRuntime = Readonly<{
  rulesetVersion: string;
  contentPackVersion: typeof CONTENT_PACK_VERSION;
  ruleset: typeof runtimeRuleset;
  pack: ContentPack;
  strategy: PopulationStrategy;
}>;

export type CareerSeasonReading = Readonly<{
  seasonIndex: number;
  trainingFocus: TrainingFocus;
  snapshot: DomainSnapshot;
}>;

/**
 * Optional hooks are diagnostic-only. With no options, runCareer uses the exact
 * command-line runtime selected above, preserving the population generator.
 */
export type RunCareerOptions = Readonly<{
  rulesetVersion?: string;
  strategy?: PopulationStrategy;
  trainingFocusOverride?: TrainingFocus;
  onSeasonSettled?: (reading: CareerSeasonReading) => void;
}>;

const defaultRuntime: PopulationRuntime = {
  rulesetVersion: RULESET_VERSION,
  contentPackVersion: CONTENT_PACK_VERSION,
  ruleset: runtimeRuleset,
  pack: runtimePack,
  strategy: STRATEGY,
};

function runtimeFor(options: RunCareerOptions): PopulationRuntime {
  const strategy = options.strategy ?? STRATEGY;
  if (!['random', 'opportunity', 'mixed'].includes(strategy))
    throw new Error('strategy must be random, opportunity, or mixed');
  if (options.rulesetVersion === undefined && strategy === STRATEGY) return defaultRuntime;
  return {
    rulesetVersion: options.rulesetVersion ?? RULESET_VERSION,
    contentPackVersion: CONTENT_PACK_VERSION,
    ruleset: loadRuleset(options.rulesetVersion ?? RULESET_VERSION),
    pack: runtimePack,
    strategy,
  };
}

function policyChecksum(version: LegacyVersion): string {
  return sha256Hex(canonicalAny(legacyPolicyForVersion(version)));
}
// A published reference population must never become an input to its own generation.
function sourceArtifacts(rulesetVersion = RULESET_VERSION) {
  const {
    rulesetVersion: loadedRulesetVersion,
    rulesetChecksum,
    contentPackVersion,
    contentPackChecksum,
  } = loadRetirementArtifacts(rulesetVersion, CONTENT_PACK_VERSION);
  return {
    rulesetVersion: loadedRulesetVersion,
    rulesetChecksum,
    contentPackVersion,
    contentPackChecksum,
  };
}

function command(
  snapshot: DomainSnapshot | null,
  type: Command['type'],
  payload: unknown,
  id: string,
  runtime: PopulationRuntime = defaultRuntime,
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
    ruleset: runtime.ruleset,
    rulesetVersion: runtime.rulesetVersion,
    contentPackVersion: runtime.contentPackVersion,
  });
  if (!result.ok) throw new Error(`${type} failed: ${result.error.code}: ${result.error.message}`);
  return result.snapshot;
}

/** Synthetic strategy, fixed before replay. Only public offer/role/age information is used. */
function informedStrategy(careerId: string, strategy: PopulationStrategy = STRATEGY): boolean {
  return (
    strategy === 'opportunity' ||
    (strategy === 'mixed' && chooseDeterministicIndex(careerId, 'career-strategy', 2) === 0)
  );
}

function opportunityOffer(
  offers: readonly Offer[],
  currentTeamId: string | undefined,
): Offer | undefined {
  const ranked = offers.toSorted(
    (a, b) =>
      (a.competitorSummary?.rank ?? 99) - (b.competitorSummary?.rank ?? 99) ||
      b.tacticalFitEstimate - a.tacticalFitEstimate ||
      Number(b.teamId === currentTeamId) - Number(a.teamId === currentTeamId),
  );
  const best = ranked[0];
  const stay = offers.find((offer) => offer.teamId === currentTeamId);
  // Avoid a move for a negligible fit advantage when the projected competition rank is equal.
  if (
    best &&
    stay &&
    best.competitorSummary?.rank === stay.competitorSummary?.rank &&
    best.tacticalFitEstimate - stay.tacticalFitEstimate < 10
  )
    return stay;
  return best;
}

function closePending(
  snapshot: DomainSnapshot,
  id: string,
  runtime: PopulationRuntime = defaultRuntime,
): DomainSnapshot {
  const pending = snapshot.state.pending;
  const seed = snapshot.state.careerId;
  const registered = commandForPending(snapshot.state, runtime.pack, seed);
  if (registered !== undefined)
    return command(snapshot, registered.type, registered.payload, id, runtime);
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
    const offer = informedStrategy(seed, runtime.strategy)
      ? opportunityOffer(offers, snapshot.state.contract?.teamId)
      : (offers[index] ?? (snapshot.state.contract === null ? offers[0] : undefined));
    return offer === undefined
      ? command(snapshot, 'REJECT_OFFER', { offerId: null }, id, runtime)
      : command(snapshot, 'ACCEPT_OFFER', { offerId: offer.id }, id, runtime);
  }
  if (pending?.kind === 'ROLE_PROPOSAL') {
    // Preserve the position stratum: cross-group changes are explicitly declined.
    const crossesGroup =
      pending.proposal.type === 'POSITION_CHANGE' &&
      statGroupOf(pending.proposal.to) !==
        statGroupOf(snapshot.state.player.profile!.primaryPosition);
    const accept =
      pending.proposal.type === 'KEEP' ||
      (!crossesGroup &&
        (informedStrategy(seed, runtime.strategy) ||
          chooseDeterministicIndex(seed, `role:${snapshot.revision}`, 2) === 0));
    return command(
      snapshot,
      'RESOLVE_ROLE',
      { decision: accept ? 'ACCEPT' : 'DECLINE' },
      id,
      runtime,
    );
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
      runtime,
    );
  }
  if (pending !== null && pending?.kind !== 'SETTLEMENT')
    throw new Error(`Unhandled pending ${pending?.kind}`);
  return snapshot;
}

export function runCareer(
  position: Position,
  seedIndex: number,
  requestedSeasons: number,
  legacyVersion: LegacyVersion,
  options: RunCareerOptions = {},
): PopulationRow {
  const runtime = runtimeFor(options);
  const seed = `phase5-population:${position}:${seedIndex}`;
  const archetypes = runtime.ruleset.archetypes.filter((a) => statGroupOf(a.position) === position);
  const archetype = archetypes[chooseDeterministicIndex(seed, 'archetype', archetypes.length)]!;
  const background =
    runtime.ruleset.backgrounds[
      chooseDeterministicIndex(seed, 'background', runtime.ruleset.backgrounds.length)
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
      rulesetVersion: runtime.rulesetVersion,
      contentPackVersion: runtime.contentPackVersion,
    },
    `${seed}-create`,
    runtime,
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
    runtime,
  );
  snapshot = command(snapshot, 'CONFIRM_PLAYER', {}, `${seed}-confirm`, runtime);
  for (let step = 0; snapshot.state.contract === null && step < 100; step++) {
    snapshot =
      snapshot.state.pending === null
        ? command(
            snapshot,
            'ADVANCE',
            advancePayload(snapshot.state, runtime.pack),
            `${seed}-youth-${step}`,
            runtime,
          )
        : closePending(snapshot, `${seed}-youth-${step}`, runtime);
  }
  if (snapshot.state.contract === null) throw new Error(`No first contract for ${seed}`);
  let seasons = 0;
  while (seasons < requestedSeasons) {
    for (let step = 0; snapshot.state.pending !== null && step < 100; step++)
      snapshot = closePending(snapshot, `${seed}-boundary-${seasons}-${step}`, runtime);
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
        runtime,
      );
    }
    seasons += 1;
    const seasonIndex = seasons;
    const trainingFocus: TrainingFocus =
      options.trainingFocusOverride ??
      (informedStrategy(snapshot.state.careerId, runtime.strategy)
        ? snapshot.state.age < 30
          ? 'ROLE'
          : 'MENTAL'
        : (['ROLE', 'TECHNICAL', 'PHYSICAL', 'MENTAL'] as const)[
            chooseDeterministicIndex(seed, `training:${seasons}`, 4)
          ]!);
    snapshot = command(
      snapshot,
      'START_SEASON',
      {
        simulationMode,
        trainingFocus,
        serviceSeasonId: `population-${position}-${seedIndex}-${seasonIndex}`,
        legacyLedger: true,
      },
      `${position}-${seedIndex}-${seasonIndex}-start`,
      runtime,
    );
    for (let step = 0; step < 200; step += 1) {
      if (snapshot.state.pending?.kind === 'SETTLEMENT') {
        snapshot = command(
          snapshot,
          'SETTLE_SEASON',
          {},
          `${position}-${seedIndex}-${seasonIndex}-${step}-settle`,
          runtime,
        );
        break;
      }
      snapshot =
        snapshot.state.pending === null
          ? command(
              snapshot,
              'ADVANCE',
              advancePayload(snapshot.state, runtime.pack),
              `${seed}-${seasonIndex}-${step}-advance`,
              runtime,
            )
          : closePending(snapshot, `${seed}-${seasonIndex}-${step}-resolve`, runtime);
    }
    if (snapshot.state.season !== null || snapshot.state.seasonHistory.length !== seasonIndex)
      throw new Error(`season ${seasonIndex} did not settle for ${position}/${seedIndex}`);
    const verification = verifySnapshot(snapshot);
    if (!verification.ok)
      throw new Error(`invalid snapshot for ${position}/${seedIndex}: ${verification.reason}`);
    options.onSeasonSettled?.({ seasonIndex, trainingFocus, snapshot });
  }
  for (let step = 0; snapshot.state.pending !== null && step < 100; step++)
    snapshot = closePending(snapshot, `${seed}-retire-before-${step}`, runtime);
  const finalChoice =
    chooseDeterministicIndex(seed, 'epilogue', 2) === 0 ? 'RETIRE' : 'COACH_EPILOGUE';
  snapshot = command(
    snapshot,
    'RETIRE',
    { choice: finalChoice },
    `${position}-${seedIndex}-retire`,
    runtime,
  );
  if (snapshot.state.status !== 'RETIRED')
    throw new Error(`retirement did not settle for ${position}/${seedIndex}`);
  if (statGroupOf(snapshot.state.player.profile!.primaryPosition) !== position)
    throw new Error(`position stratum drift for ${position}/${seedIndex}`);
  const artifacts = sourceArtifacts(runtime.rulesetVersion);
  const context = {
    binding: {
      careerId: snapshot.state.careerId,
      createdServiceSeasonId: `population-${position}-${seedIndex}-1`,
      rulesetVersion: runtime.rulesetVersion,
      contentPackVersion: runtime.contentPackVersion,
    },
    artifacts,
  };
  const archive = createCareerArchiveCore(snapshot, context);
  const evidence = deriveLegacyEvidence(archive, legacyVersion);
  const result = createLegacyResult(archive, context, undefined, legacyVersion);
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
    componentScores: result.componentScores,
    minutes: archive.records.totals.minutes,
    possibleMinutes: archive.records.totals.possibleMinutes,
    peakOvr: Math.max(
      0,
      ...snapshot.state.seasonHistory.map((season) => season.result.baseOvr.after),
    ),
    trophies: evidence.trophies,
    endingCandidates: result.endingCandidates,
    strategy: informedStrategy(snapshot.state.careerId, runtime.strategy)
      ? 'opportunity'
      : 'random',
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
function legacyVersionArg(args: string[]): LegacyVersion {
  const value = arg(args, '--legacy-version') ?? '1.0.0';
  if (value !== '1.0.0' && value !== '1.1.0')
    throw new Error('--legacy-version must be 1.0.0 or 1.1.0');
  return value;
}

async function readCheckpoint(
  path: string,
  artifacts: Checkpoint['artifacts'],
  count: number,
  maxSeasons: number,
  expectedLegacyVersion: LegacyVersion,
  expectedRange?: { start: number; end: number },
): Promise<Checkpoint> {
  try {
    const checkpoint = JSON.parse(await readFile(path, 'utf8')) as Checkpoint;
    if (
      checkpoint.protocolVersion !== PROTOCOL_VERSION ||
      checkpoint.generatorCodeHash !== GENERATOR_CODE_HASH ||
      checkpoint.rulesetVersion !== RULESET_VERSION ||
      checkpoint.contentPackVersion !== CONTENT_PACK_VERSION ||
      checkpoint.policyChecksum !== policyChecksum(expectedLegacyVersion) ||
      checkpoint.countPerPosition !== count ||
      checkpoint.maxSeasons !== maxSeasons ||
      checkpoint.legacyVersion !== expectedLegacyVersion ||
      checkpoint.choicePolicy !== CHOICE_POLICY ||
      (expectedRange !== undefined &&
        (checkpoint.range?.start !== expectedRange.start ||
          checkpoint.range?.end !== expectedRange.end)) ||
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
        const groupRange = checkpoint.range ?? { start: 0, end: count };
        if (
          groupRange.start < 0 ||
          groupRange.end > count ||
          groupRange.end <= groupRange.start ||
          group.rows.length > groupRange.end - groupRange.start
        )
          throw new Error(`checkpoint group ${position} range mismatch`);
        group.rows.forEach((row, offset) => {
          const index = groupRange.start + offset;
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
        policyChecksum: policyChecksum(expectedLegacyVersion),
        countPerPosition: count,
        maxSeasons,
        legacyVersion: expectedLegacyVersion,
        choicePolicy: CHOICE_POLICY,
        ...(expectedRange === undefined ? {} : { range: expectedRange }),
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
  legacyVersion: LegacyVersion,
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
  const provenance = {
    protocolVersion: PROTOCOL_VERSION,
    generatorCodeHash: process.env.LEGACY_POPULATION_BUNDLE_HASH ?? 'UNHASHED_WORKTREE',
    choicePolicy: CHOICE_POLICY,
    seedPolicy: 'phase5-population:<position>:<zero-based-index>',
    requestedSeasonPolicy: '1 + (seedIndex mod --seasons)',
    rulesetVersion: RULESET_VERSION,
    contentPackVersion: CONTENT_PACK_VERSION,
    artifacts: checkpoint.artifacts,
    policyChecksum: policyChecksum(legacyVersion),
    legacyVersion,
    countPerPosition: count,
    maxSeasons: seasons,
  };
  const population = {
    id: legacyPopulationId(provenance),
    legacyVersion,
    rulesetVersion: RULESET_VERSION,
    scores,
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
  const legacyVersion = legacyVersionArg(argv);
  if (seasons > 20) throw new Error('--seasons must be between 1 and 20');
  const checkpointPath = resolve(
    arg(argv, '--checkpoint') ?? 'artifacts/legacy-population.checkpoint.json',
  );
  const outputPath = resolve(arg(argv, '--out') ?? 'artifacts/legacy-population.json');
  const smoke = argv.includes('--smoke');
  const seedStartArg = arg(argv, '--seed-start');
  const seedEndArg = arg(argv, '--seed-end');
  if ((seedStartArg === undefined) !== (seedEndArg === undefined))
    throw new Error('--seed-start and --seed-end must be supplied together');
  const seedStart = seedStartArg === undefined ? 0 : Number(seedStartArg);
  const seedEnd = seedEndArg === undefined ? count : Number(seedEndArg);
  if (
    !Number.isInteger(seedStart) ||
    !Number.isInteger(seedEnd) ||
    seedStart < 0 ||
    seedEnd <= seedStart ||
    seedEnd > count
  )
    throw new Error('--seed-start/--seed-end must describe a non-empty range within --count');
  const range = { start: seedStart, end: seedEnd };
  if (!smoke && !/^[a-f0-9]{64}$/.test(GENERATOR_CODE_HASH))
    throw new Error(
      'A publishable run requires a hashed frozen bundle; use legacy-population-node.mjs',
    );
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
      policyChecksum: policyChecksum(legacyVersion),
      countPerPosition: count,
      maxSeasons: seasons,
      legacyVersion,
      choicePolicy: CHOICE_POLICY,
      artifacts,
      groups: {},
    };
    const ranges = new Map<
      Position,
      Array<{ start: number; end: number; rows: readonly PopulationRow[] }>
    >();
    for (const path of mergeArg.split(',').filter(Boolean)) {
      const part = await readCheckpoint(resolve(path), artifacts, count, seasons, legacyVersion);
      for (const position of POSITIONS) {
        const group = part.groups[position];
        if (group !== undefined) {
          const partRange = part.range ?? { start: 0, end: count };
          const list = ranges.get(position) ?? [];
          list.push({ start: partRange.start, end: partRange.end, rows: group.rows });
          ranges.set(position, list);
        }
      }
    }
    for (const position of POSITIONS) {
      const parts = (ranges.get(position) ?? []).sort((a, b) => a.start - b.start);
      let cursor = 0;
      const rows: PopulationRow[] = [];
      for (const part of parts) {
        if (part.start !== cursor || part.end - part.start !== part.rows.length)
          throw new Error(`checkpoint ${position} has missing/overlapping range`);
        rows.push(...part.rows);
        cursor = part.end;
      }
      if (cursor !== count) throw new Error(`checkpoint ${position} does not cover 0..${count}`);
      merged.groups[position] = { position, rows, hash: hashRows(rows) };
    }
    await writePopulation(outputPath, merged, count, seasons, smoke, legacyVersion);
    return;
  }
  const checkpoint = await readCheckpoint(
    checkpointPath,
    artifacts,
    count,
    seasons,
    legacyVersion,
    seedStartArg === undefined ? undefined : range,
  );
  for (const position of positions) {
    const existing = checkpoint.groups[position];
    const rows = [...(existing?.rows ?? [])];
    for (let index = seedStart + rows.length; index < seedEnd; index += 1) {
      const requestedSeasons = (index % seasons) + 1;
      rows.push(runCareer(position, index, requestedSeasons, legacyVersion));
      if (rows.length % 100 === 0 || rows.length === count) {
        checkpoint.groups[position] = { position, rows, hash: hashRows(rows) };
        checkpoint.range = range;
        await writeCheckpoint(checkpointPath, checkpoint);
        console.log(`${position}: ${rows.length}/${count} careers verified`);
      }
    }
    checkpoint.groups[position] = { position, rows, hash: hashRows(rows) };
    checkpoint.range = range;
    await writeCheckpoint(checkpointPath, checkpoint);
  }
  if (positionArg !== undefined) return;
  await writePopulation(outputPath, checkpoint, count, seasons, smoke, legacyVersion);
}

if (
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv.includes('--__population-run')
) {
  await main(process.argv.slice(2).filter((arg) => arg !== '--__population-run'));
}
