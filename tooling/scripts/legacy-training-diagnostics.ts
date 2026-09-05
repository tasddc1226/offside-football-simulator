import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { loadRetirementArtifacts } from '../../packages/content/src/retirement-artifacts.ts';
import { runCareer, type Position, type PopulationRow } from './legacy-population.ts';
import { canonicalize, type JsonValue } from '../../packages/domain/src/canonical.ts';
import { legacyPolicyForVersion } from '../../packages/domain/src/legacy/result.ts';
import { sha256Hex } from '../../packages/domain/src/hash.ts';
import type { CareerSeasonReading } from './legacy-population.ts';
import type { PositionStatsTotals, TrainingFocus } from '../../packages/domain/src/types.ts';

const RULESET_VERSION = '1.1.0' as const;
const LEGACY_VERSION = '1.1.0' as const;
const CONTENT_PACK_VERSION = '0.3.0' as const;
const STRATEGY = 'opportunity' as const;
const FOCUSES = ['ROLE', 'TECHNICAL'] as const satisfies readonly TrainingFocus[];
const POSITIONS = ['GK', 'DF', 'MF', 'FW'] as const satisfies readonly Position[];
const MAX_SEED_INDEX = 7;
const MAX_SEASONS = 20;
const MAX_REPLAYS = 64;

type DiagnosticFocus = (typeof FOCUSES)[number];
const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, '../..');
const execFileAsync = promisify(execFile);

function arg(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (value === undefined || value.startsWith('--')) throw new Error(`${name} requires a value`);
  return value;
}

function boundedInt(args: readonly string[], name: string, fallback: number, max: number): number {
  const value = Number(arg(args, name) ?? fallback);
  if (!Number.isSafeInteger(value) || value < 1 || value > max)
    throw new Error(`${name} must be an integer between 1 and ${max}`);
  return value;
}

function positionsArg(args: readonly string[]): Position[] {
  const value = arg(args, '--positions') ?? arg(args, '--position') ?? POSITIONS.join(',');
  const requested = value.split(',').filter(Boolean);
  if (requested.length === 0 || requested.length > POSITIONS.length)
    throw new Error(`--positions must contain 1..${POSITIONS.length} positions`);
  const positions = requested as Position[];
  if (positions.some((position) => !POSITIONS.includes(position)))
    throw new Error(`--positions must use ${POSITIONS.join(', ')}`);
  if (new Set(positions).size !== positions.length)
    throw new Error('--positions must not repeat a position');
  return positions;
}

function per90Stats(
  totals: PositionStatsTotals,
  minutes: number,
): Readonly<{
  group: PositionStatsTotals['group'];
  values: Record<string, number> | null;
}> {
  if (minutes <= 0) return { group: totals.group, values: null };
  const denominator = minutes / 90;
  const values = Object.fromEntries(
    Object.entries(totals)
      .filter(
        (entry): entry is [string, number] => entry[0] !== 'group' && typeof entry[1] === 'number',
      )
      .map(([key, value]) => [key, Number((value / denominator).toFixed(4))]),
  );
  return { group: totals.group, values };
}

function seasonReading(reading: CareerSeasonReading) {
  const result = reading.snapshot.state.seasonHistory.at(-1)?.result;
  if (result === undefined || result.index !== reading.seasonIndex)
    throw new Error(`season reading ${reading.seasonIndex} is missing from the settled history`);
  const { playerStats } = result;
  return {
    index: result.index,
    trainingFocus: reading.trainingFocus,
    baseOvr: result.baseOvr,
    selection: result.selectionSummary,
    appearances: playerStats.appearances,
    minutes: playerStats.minutes,
    possibleMinutes: result.selectionSummary.possibleMinutes,
    rating: {
      ratedMatches: playerStats.ratedMatches,
      ratingSumTenths: playerStats.ratingSumTenths,
      averageTenths:
        playerStats.ratedMatches === 0
          ? null
          : playerStats.ratingSumTenths / playerStats.ratedMatches,
    },
    growth: {
      attributeDeltas: result.attributeDeltas,
    },
    positionStats: {
      group: playerStats.totals.group,
      totals: playerStats.totals,
      per90: per90Stats(playerStats.totals, playerStats.minutes),
    },
  };
}

async function gitOutput(args: readonly string[]): Promise<string | null> {
  try {
    const result = await execFileAsync('git', [...args], {
      cwd: REPOSITORY_ROOT,
      encoding: 'utf8',
    });
    return result.stdout;
  } catch {
    return null;
  }
}

async function sourceProvenance() {
  const generatorPath = resolve(SCRIPT_DIRECTORY, 'legacy-population.ts');
  const diagnosticPath = resolve(SCRIPT_DIRECTORY, 'legacy-training-diagnostics.ts');
  const [generatorSource, diagnosticSource, gitHead, trackedDiff] = await Promise.all([
    readFile(generatorPath, 'utf8'),
    readFile(diagnosticPath, 'utf8'),
    gitOutput(['rev-parse', 'HEAD']),
    gitOutput([
      'diff',
      '--no-ext-diff',
      'HEAD',
      '--',
      'packages/domain',
      'packages/content',
      'tooling/scripts',
    ]),
  ]);
  const artifacts = loadRetirementArtifacts(RULESET_VERSION, CONTENT_PACK_VERSION);
  return {
    gitHead: gitHead?.trim() ?? null,
    trackedDiffSha256: trackedDiff === null ? null : sha256Hex(trackedDiff),
    toolFilesSha256: {
      'tooling/scripts/legacy-population.ts': sha256Hex(generatorSource),
      'tooling/scripts/legacy-training-diagnostics.ts': sha256Hex(diagnosticSource),
    },
    retirementArtifacts: artifacts,
    legacyPolicyChecksum: sha256Hex(
      canonicalize(legacyPolicyForVersion(LEGACY_VERSION) as JsonValue),
    ),
    declaredBundleHash: process.env.LEGACY_POPULATION_BUNDLE_HASH ?? null,
  };
}

function experimentRun(
  position: Position,
  seedIndex: number,
  requestedSeasons: number,
  trainingFocus: DiagnosticFocus,
) {
  const seasonReadings: ReturnType<typeof seasonReading>[] = [];
  const row: PopulationRow = runCareer(position, seedIndex, requestedSeasons, LEGACY_VERSION, {
    rulesetVersion: RULESET_VERSION,
    strategy: STRATEGY,
    trainingFocusOverride: trainingFocus,
    onSeasonSettled: (reading) => seasonReadings.push(seasonReading(reading)),
  });
  return {
    position,
    seedIndex,
    seed: row.seed,
    requestedSeasons: row.requestedSeasons,
    seasons: row.seasons,
    trainingFocus,
    rulesetVersion: RULESET_VERSION,
    contentPackVersion: CONTENT_PACK_VERSION,
    legacyVersion: LEGACY_VERSION,
    strategy: STRATEGY,
    rawFiveAxis: row.componentScores,
    score: row.score,
    endingId: row.endingId,
    archiveHash: row.archiveHash,
    resultHash: row.resultHash,
    seasonReadings,
  };
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const count = boundedInt(argv, '--count', 2, MAX_SEED_INDEX + 1);
  const requestedSeasons = boundedInt(argv, '--seasons', MAX_SEASONS, MAX_SEASONS);
  const positions = positionsArg(argv);
  const replayCount = positions.length * count * FOCUSES.length;
  if (replayCount > MAX_REPLAYS)
    throw new Error(`diagnostic replay count must not exceed ${MAX_REPLAYS}`);
  const outputPath = resolve(arg(argv, '--out') ?? 'artifacts/legacy-training-diagnostics.json');
  const sourceBefore = await sourceProvenance();
  const runs = [];
  for (const position of positions) {
    for (let seedIndex = 0; seedIndex < count; seedIndex += 1) {
      for (const trainingFocus of FOCUSES)
        runs.push(experimentRun(position, seedIndex, requestedSeasons, trainingFocus));
    }
  }
  const sourceAfter = await sourceProvenance();
  if (JSON.stringify(sourceBefore) !== JSON.stringify(sourceAfter))
    throw new Error('source provenance changed during diagnostic replay');
  const payload = {
    kind: 'EXPERIMENT_NOT_REFERENCE_POPULATION',
    source: {
      diagnostic: 'tooling/scripts/legacy-training-diagnostics.ts',
      generator: 'tooling/scripts/legacy-population.ts',
      provenance: 'bounded causal training experiment; never a reference population input',
      ...sourceBefore,
    },
    policy: {
      rulesetVersion: RULESET_VERSION,
      contentPackVersion: CONTENT_PACK_VERSION,
      legacyVersion: LEGACY_VERSION,
      strategy: STRATEGY,
      contractPolicy: 'public opportunity contract selection',
      rolePolicy: 'public opportunity role selection',
      eventPolicy: 'public content-pack event choices',
    },
    experiment: {
      trainingFocuses: FOCUSES,
      positions,
      seedIndices: Array.from({ length: count }, (_, index) => index),
      seedIndexBounds: { min: 0, max: MAX_SEED_INDEX },
      requestedSeasons,
      maximumRequestedSeasons: MAX_SEASONS,
      replayCount,
      maximumReplayCount: MAX_REPLAYS,
      seedPolicy: 'phase5-population:<position>:<zero-based-index>',
    },
    runs,
  };
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
  console.log(JSON.stringify({ kind: payload.kind, outputPath, replayCount }));
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
