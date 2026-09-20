import { needsDevelopment, type DevelopmentPlan } from '../../packages/domain/src/development.ts';
// T-7-017 D-79: UI·브라우저·서버 없이 도메인 simulate()를 직접 호출해 커리어 N개를 seed별로
// 재생하는 헤드리스 CLI. 명령 실행·pending 정책은 tooling/scripts/legacy-population.ts와
// legacy-population-choices.ts의 선례(Phase 5 모집단 생성기)를 따르되, 이 파일은 그 파일들을
// import하지 않고 별도로 구현한다(그 파일들은 코드 해시로 고정된 대상이라 수정 금지).
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';

// `pnpm --filter @offside/scripts` runs with cwd == tooling/scripts, but the CLI's public
// examples write `--out`(상대 경로) relative to the repo root. Resolve relative `--out` against
// the repo root regardless of the caller's cwd so `pnpm sim:career --out tooling/sim-out/x` from
// either the root script or `tooling/scripts` directly lands in the same place.
const REPO_ROOT = resolve(new URL('../..', import.meta.url).pathname);
function resolveOut(out: string): string {
  return isAbsolute(out) ? out : resolve(REPO_ROOT, out);
}

// T-7-020: Node crypto의 SHA-256을 도메인에 주입한다(값은 순수 구현과 동일해야 한다 — hash.ts
// JSDoc·hash.test.ts가 그 동등성 검증 책임을 진다). `--pure-hash`로 끌 수 있다(동등성 검증·회귀용).
const NODE_SHA256_PROVIDER: Sha256Provider = (input) => createHash('sha256').update(input, 'utf8').digest('hex');

function applyHashProvider(pureHash: boolean): void {
  setSha256Provider(pureHash ? null : NODE_SHA256_PROVIDER);
}

import { loadRetirementArtifacts } from '../../packages/content/src/retirement-artifacts.ts';
import { loadRuleset } from '../../packages/content/src/rulesets/load-ruleset.ts';
import { RULESET_VERSIONS } from '../../packages/content/src/rulesets/load-ruleset.ts';
import {
  loadContentPack,
  PACK_VERSIONS,
  type ContentPack,
} from '../../packages/content/src/packs/load-content-pack.ts';
import { createCareerArchiveCore } from '../../packages/domain/src/legacy/archive.ts';
import { createLegacyResult, type LegacyVersion } from '../../packages/domain/src/legacy/result.ts';
import {
  retirementDecisionRequired,
  retirementContinuationOptions,
  RETIREMENT_POLICY,
} from '../../packages/domain/src/legacy/career-retirement.ts';
import { careerEventChoices } from '../../packages/domain/src/legacy/career-event.ts';
import {
  commandForPending,
  chooseDeterministicIndex,
  advancePayload,
} from './legacy-population-choices.ts';
import { simulate, type Command } from '../../packages/domain/src/simulate.ts';
import { canonicalize, type JsonValue } from '../../packages/domain/src/canonical.ts';
import { setSha256Provider, type Sha256Provider } from '../../packages/domain/src/hash.ts';
import {
  statGroupOf,
  type DomainSnapshot,
  type StatGroup,
  type Offer,
} from '../../packages/domain/src/types.ts';
import type { Ruleset } from '../../packages/content/src/schema/ruleset.ts';

// ---------------------------------------------------------------------------
// CLI 타입
// ---------------------------------------------------------------------------

export type Policy = 'first' | 'random' | 'opportunity';
export type PositionArg = 'GK' | 'DF' | 'MF' | 'FW' | 'all';
export type Mode = 'CHAPTER' | 'FAST';
const POSITIONS = ['GK', 'DF', 'MF', 'FW'] as const satisfies readonly StatGroup[];

export type CareerSimOptions = {
  rulesetVersion: string;
  contentPackVersion: string;
  seeds: number;
  seedPrefix: string;
  seasons: number;
  toRetirement: boolean;
  policy: Policy;
  position: PositionArg;
  archetypeId?: string;
  backgroundId?: string;
  mode: Mode;
  jobs: number;
  out: string;
  verify: boolean;
  /** T-7-020: true면 Node crypto 주입을 끄고 도메인 순수 SHA-256 구현으로 돌린다(동등성 검증·회귀용). */
  pureHash?: boolean;
  /** T-7-022: 보수적 offline PUT/state 크기 계측. 기본 CSV와 hot path는 변경하지 않는다. */
  measureStorage?: boolean;
  /** 내부용: 자식 프로세스가 담당할 seed 범위(0-based, end exclusive). 생략하면 0..seeds. */
  rangeStart?: number;
  rangeEnd?: number;
};

export type CareerSimError = { code: string; message: string };

export type CareerRow = Record<string, string | number>;
export type SeasonRow = Record<string, string | number>;
export type FailureRow = Record<string, string | number>;

export type CareerSimBatch = {
  careers: CareerRow[];
  seasons: SeasonRow[];
  failures: FailureRow[];
  /** 내부용: 커리어별 소요 ms(CSV에는 나가지 않는다, summary.json의 msPerCareer 산출용). */
  msValues: number[];
};

export type CareerSimSuccess = {
  ok: true;
  batch: CareerSimBatch;
  summary: Record<string, unknown>;
  elapsedMs: number;
};

export type CareerSimResult = CareerSimSuccess | { ok: false; error: CareerSimError };

// ---------------------------------------------------------------------------
// CSV 헤더 (브리프 고정 컬럼 순서)
// ---------------------------------------------------------------------------

export const CAREERS_CSV_HEADER = [
  'seed', 'index', 'position', 'primaryPosition', 'archetypeId', 'backgroundId', 'mode', 'policy',
  'truePotential', 'baseOvrStart', 'peakOvr', 'peakOvrAge', 'finalOvr', 'seasons', 'retiredAge',
  'status', 'finalChoice', 'retireReason', 'clubs', 'firstTier', 'bestTier', 'seasonsInTier1',
  'seasonsInTier2', 'seasonsInTier3', 'totalApps', 'totalMinutes', 'totalGoals', 'totalAssists',
  'avgRatingTenths', 'injuries', 'severeInjuries', 'contracts', 'peakWageMinorPerWeek',
  'totalIncomeMinor', 'nationalCallUps', 'captainSeasons', 'legacyScore', 'legacyBandId',
  'legacyEndingId', 'commands', 'stateHash',
] as const;

export const CAREERS_STORAGE_CSV_HEADER = [
  ...CAREERS_CSV_HEADER.slice(0, -1),
  'peakStateBytes', 'peakPutBodyBytes', 'season20ActiveStateBytes',
  'season20ActivePutBodyBytes', 'stateHash',
] as const;

export const SEASONS_CSV_HEADER = [
  'seed', 'index', 'seasonIndex', 'age', 'teamId', 'teamName', 'leagueTier', 'contractKind',
  'squadRoleAtStart', 'squadRoleAtEnd', 'finalRank', 'apps', 'started', 'minutes',
  'possibleMinutes', 'goals', 'assists', 'avgRatingTenths', 'injuries', 'ovrBefore', 'ovrAfter',
  'formAfter', 'fitnessAfter', 'moraleAfter', 'managerTrustAfter', 'wageMinorPerWeek',
  'promiseFulfilled', 'captaincyAtEnd',
] as const;

export const FAILURES_CSV_HEADER = [
  'seed', 'index', 'seasonIndex', 'commandIndex', 'pendingKind', 'commandType', 'errorCode',
  'message',
] as const;

// runParallel이 shard의 CSV를 다시 읽어 합칠 때(parseCsv), 시뮬레이션 직후의 행과 같은 타입으로
// 되돌리기 위한 컬럼별 숫자 목록. 숫자처럼 보이더라도 원본이 문자열인 컬럼(예: seed는
// `${seedPrefix}:${position}:${index}` 형태, leagueTier·firstTier·bestTier는 String()으로 감싼
// 값, stateHash는 16진 해시)은 여기 넣지 않는다 — regex로 "숫자처럼 보이면 변환"하면
// leagueTier="2" 같은 값이 Number(2)가 되어 buildSummary의 문자열 비교(`tier === '2'`)가 항상
// 거짓이 된다(--jobs 1 vs --jobs 3 summary.json 불일치의 원인).
const CAREERS_NUMERIC_COLUMNS = new Set<string>([
  'index', 'truePotential', 'baseOvrStart', 'peakOvr', 'peakOvrAge', 'finalOvr', 'seasons',
  'retiredAge', 'clubs', 'seasonsInTier1', 'seasonsInTier2', 'seasonsInTier3', 'totalApps',
  'totalMinutes', 'totalGoals', 'totalAssists', 'avgRatingTenths', 'injuries', 'severeInjuries',
  'contracts', 'peakWageMinorPerWeek', 'totalIncomeMinor', 'nationalCallUps', 'captainSeasons',
  'legacyScore', 'commands', 'peakStateBytes', 'peakPutBodyBytes', 'season20ActiveStateBytes',
  'season20ActivePutBodyBytes',
]);

const SEASONS_NUMERIC_COLUMNS = new Set<string>([
  'index', 'seasonIndex', 'age', 'finalRank', 'apps', 'started', 'minutes',
  'possibleMinutes', 'avgRatingTenths', 'injuries', 'ovrBefore', 'ovrAfter', 'formAfter',
  'fitnessAfter', 'moraleAfter', 'managerTrustAfter', 'wageMinorPerWeek',
]);

const FAILURES_NUMERIC_COLUMNS = new Set<string>(['index', 'seasonIndex', 'commandIndex']);

const COMMAND_BUDGET = 5000;

// ---------------------------------------------------------------------------
// 명령 실행
// ---------------------------------------------------------------------------

class SimStepError extends Error {
  commandType: string;
  errorCode: string;
  pendingKind: string;
  constructor(commandType: string, errorCode: string, message: string, pendingKind: string) {
    super(message);
    this.commandType = commandType;
    this.errorCode = errorCode;
    this.pendingKind = pendingKind;
  }
}

type Runtime = { ruleset: Ruleset; rulesetVersion: string; contentPackVersion: string };

function doCommand(
  snapshot: DomainSnapshot | null,
  type: Command['type'],
  payload: unknown,
  id: string,
  runtime: Runtime,
): DomainSnapshot {
  const result = simulate({
    snapshot,
    command: {
      type,
      payload,
      commandId: id,
      expectedRevision: snapshot?.revision ?? 0,
    } as Command & { commandId: string; expectedRevision: number },
    ruleset: runtime.ruleset,
    rulesetVersion: runtime.rulesetVersion,
    contentPackVersion: runtime.contentPackVersion,
  });
  if (!result.ok) {
    throw new SimStepError(
      type,
      result.error.code,
      result.error.message,
      snapshot?.state.pending?.kind ?? 'NONE',
    );
  }
  return result.snapshot;
}

// ---------------------------------------------------------------------------
// pending 정책 ("first" 전용 — random/opportunity는 legacy-population-choices의
// commandForPending을 그대로 쓴다)
// ---------------------------------------------------------------------------

function firstCommandForPending(
  state: DomainSnapshot['state'],
  pack: ContentPack,
): Command | undefined {
  const pending = state.pending;
  if (pending === null) return undefined;
  if (pending.kind === 'EVENT' || pending.kind === 'INJURY' || pending.kind === 'NATIONAL_TEAM') {
    const definition = pack.eventsById.get(pending.eventId);
    if (definition === undefined || definition.version !== pending.version) return undefined;
    if (
      (pending.kind === 'INJURY' && definition.presentation !== 'INJURY') ||
      (pending.kind === 'EVENT' && definition.presentation === 'INJURY') ||
      (pending.kind === 'NATIONAL_TEAM' && definition.presentation !== 'NATIONAL_TEAM')
    )
      return undefined;
    const choice = definition.choices.find(
      (candidate) =>
        (pending.kind !== 'INJURY' || candidate.rehabPlan !== undefined) &&
        (pending.kind !== 'NATIONAL_TEAM' || candidate.callUp !== undefined),
    );
    if (choice === undefined) return undefined;
    return {
      type: 'RESOLVE_EVENT',
      payload: {
        eventId: definition.id,
        definitionVersion: definition.version,
        choiceId: choice.id,
        outcomes: choice.outcomes.map(({ id, kind, weight, effects, addTags, removeTags }) => ({
          id,
          kind,
          weight,
          effects,
          ...(addTags === undefined ? {} : { addTags }),
          ...(removeTags === undefined ? {} : { removeTags }),
        })),
        ...(pending.kind === 'INJURY' ? { rehabPlan: choice.rehabPlan } : {}),
        ...(pending.kind === 'NATIONAL_TEAM' ? { callUp: choice.callUp } : {}),
      },
    } as Command;
  }
  if (pending.kind === 'CHAPTER') {
    const definition = pack.chaptersById.get(pending.chapterId);
    if (definition === undefined || definition.version !== pending.version) return undefined;
    const decision = definition.decisions[pending.resolved.length];
    if (decision === undefined) return undefined;
    const option = decision.options[0];
    if (option === undefined) return undefined;
    return {
      type: 'RESOLVE_CHAPTER',
      payload: {
        chapterId: definition.id,
        definitionVersion: definition.version,
        decisionId: decision.id,
        optionId: option.id,
        outcomes: option.outcomes.map(
          ({ id, kind, weight, effects, ratingDeltaTenths, addTags, removeTags }) => ({
            id,
            kind,
            weight,
            effects,
            ratingDeltaTenths,
            ...(addTags === undefined ? {} : { addTags }),
            ...(removeTags === undefined ? {} : { removeTags }),
          }),
        ),
      },
    } as Command;
  }
  return undefined;
}

function opportunityOffer(
  offers: readonly Offer[],
  currentTeamId: string | undefined,
): Offer | undefined {
  const ranked = [...offers].sort(
    (a, b) =>
      (a.competitorSummary?.rank ?? 99) - (b.competitorSummary?.rank ?? 99) ||
      b.tacticalFitEstimate - a.tacticalFitEstimate ||
      Number(b.teamId === currentTeamId) - Number(a.teamId === currentTeamId),
  );
  const best = ranked[0];
  const stay = offers.find((offer) => offer.teamId === currentTeamId);
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
  options: CareerSimOptions,
  pack: ContentPack,
  runtime: Runtime,
): DomainSnapshot {
  const policy = options.policy;
  const state = snapshot.state;
  const pending = state.pending;
  const seed = state.careerId;
  if (pending === null) throw new SimStepError('CLOSE_PENDING', 'NO_PENDING', 'pending이 없다', 'NONE');

  const registered =
    policy === 'first' ? firstCommandForPending(state, pack) : commandForPending(state, pack, seed);
  if (registered !== undefined) return doCommand(snapshot, registered.type, registered.payload, id, runtime);

  if (pending.kind === 'OFFERS' || pending.kind === 'CONTRACT') {
    // D-79 후속 수정: --to-retirement는 "심사가 걸려도 이어갈 수 있으면 이어간다"는 뜻이다.
    // 심사가 걸렸는데 마지막 계약 옵션(LAST_CONTRACT·LOWER_LEAGUE)이 있으면 그걸 받아 이어가고,
    // 없으면 기존 제안 처리로 넘어간다(그 뒤 시즌 경계에서 RETIRE된다).
    if (options.toRetirement && retirementDecisionRequired(state, runtime.ruleset.retirementRules ?? RETIREMENT_POLICY)) {
      const continuation = retirementContinuationOptions(state, runtime.ruleset.retirementRules)[0];
      if (continuation !== undefined) {
        return doCommand(
          snapshot,
          'RETIRE',
          { choice: continuation.choice, offerId: continuation.offerId },
          id,
          runtime,
        );
      }
    }
    const offers = pending.offers.filter(
      (offer) =>
        offer.negotiationState !== 'WITHDRAWN' &&
        (offer.validUntilRevision === null || offer.validUntilRevision >= snapshot.revision + 1),
    );
    let offer: (typeof offers)[number] | undefined;
    if (policy === 'first') {
      offer = offers[0];
    } else if (policy === 'opportunity') {
      offer = opportunityOffer(offers, state.contract?.teamId);
    } else {
      const index = chooseDeterministicIndex(
        seed,
        `market:${state.seasonHistory.length}:${state.currentStep}`,
        offers.length + 1,
      );
      offer = offers[index] ?? (state.contract === null ? offers[0] : undefined);
    }
    return offer === undefined
      ? doCommand(snapshot, 'REJECT_OFFER', { offerId: null }, id, runtime)
      : doCommand(snapshot, 'ACCEPT_OFFER', { offerId: offer.id }, id, runtime);
  }

  if (pending.kind === 'ROLE_PROPOSAL') {
    const crossesGroup =
      pending.proposal.type === 'POSITION_CHANGE' &&
      statGroupOf(pending.proposal.to) !== statGroupOf(state.player.profile!.primaryPosition);
    let accept: boolean;
    if (policy === 'first') accept = true;
    else if (pending.proposal.type === 'KEEP') accept = true;
    else if (crossesGroup) accept = false;
    else if (policy === 'opportunity') accept = true;
    else accept = chooseDeterministicIndex(seed, `role:${snapshot.revision}`, 2) === 0;
    return doCommand(snapshot, 'RESOLVE_ROLE', { decision: accept ? 'ACCEPT' : 'DECLINE' }, id, runtime);
  }

  if (pending.kind === 'LOAN_RETURN') {
    const decision =
      policy === 'random'
        ? pending.options[
            chooseDeterministicIndex(seed, `loan:${snapshot.revision}`, pending.options.length)
          ]!
        : pending.options[0]!;
    return doCommand(snapshot, 'LOAN_RETURN', { decision }, id, runtime);
  }

  if (pending.kind === 'SETTLEMENT') return snapshot;
  throw new SimStepError('CLOSE_PENDING', 'UNHANDLED_PENDING', `unhandled pending ${pending.kind}`, pending.kind);
}

// ---------------------------------------------------------------------------
// 커리어 1개 시뮬레이션
// ---------------------------------------------------------------------------

type TierMap = Map<number, { teamId: string; teamName: string; leagueTier: string; kind: string }>;

function buildTierMap(state: DomainSnapshot['state']): TierMap {
  const map: TierMap = new Map();
  for (const stint of state.clubHistory) {
    const from = stint.fromSeasonIndex;
    const to = stint.toSeasonIndex ?? state.seasonHistory.length + 1;
    for (let s = from; s <= to; s += 1) {
      map.set(s, {
        teamId: stint.teamId,
        teamName: stint.teamName,
        leagueTier: String(stint.leagueTier),
        kind: stint.kind,
      });
    }
  }
  return map;
}

function groupGoalsAssists(totals: { group: StatGroup } & Record<string, unknown>): {
  goals: string;
  assists: string;
} {
  if (totals.group === 'FW')
    return { goals: String(totals.goals as number), assists: String(totals.assists as number) };
  if (totals.group === 'MF') return { goals: '', assists: String(totals.assists as number) };
  return { goals: '', assists: '' };
}

function runOneCareer(
  position: StatGroup,
  index: number,
  options: CareerSimOptions,
  runtime: Runtime,
  pack: ContentPack,
  legacyVersion: LegacyVersion,
  artifacts: { rulesetVersion: string; rulesetChecksum: string; contentPackVersion: string; contentPackChecksum: string },
): { career: CareerRow; seasons: SeasonRow[]; failure?: FailureRow; ms: number } {
  const seed = `${options.seedPrefix}:${position}:${index}`;
  const careerId = `career-sim-${position}-${index}`;
  const startedAt = Date.now();
  let commands = 0;
  let lastSeasonIndex = 0;
  let peakStateBytes = 0;
  let peakPutBodyBytes = 0;
  let season20ActiveStateBytes = 0;
  let season20ActivePutBodyBytes = 0;
  let createdServiceSeasonId: string | null = null;
  // 성능/저장 예산 계측은 가장 보수적인 오프라인 큐를 모델링한다. 즉 markSynced 없이 revision 0부터
  // 현재 명령까지 모두 쌓인 EngineClient.buildSyncBody와 같은 JSON shape를 매 명령 뒤 측정한다.
  const syncCommands: Array<{
    revision: number;
    commandId: string;
    commandType: Command['type'];
    payload: unknown;
    resultHash: string;
  }> = [];
  const seasonRows: SeasonRow[] = [];
  const wageAtSeasonStart = new Map<number, number>();

  const command = (
    snapshot: DomainSnapshot | null,
    type: Command['type'],
    payload: unknown,
    id: string,
  ): DomainSnapshot => {
    commands += 1;
    const next = doCommand(snapshot, type, payload, id, runtime);
    if (type === 'START_SEASON' && createdServiceSeasonId === null) {
      createdServiceSeasonId = (payload as { serviceSeasonId: string }).serviceSeasonId;
    }
    if (options.measureStorage === true) {
      syncCommands.push({
        revision: next.revision,
        commandId: id,
        commandType: type,
        payload,
        resultHash: next.stateHash,
      });
      const state = canonicalize(next.state as unknown as JsonValue);
      const stateBytes = Buffer.byteLength(state, 'utf8');
      const putBodyBytes = Buffer.byteLength(JSON.stringify({
        baseRevision: 0,
        snapshot: {
          revision: next.revision,
          checkpoint: next.checkpoint,
          state,
          stateHash: next.stateHash,
          rulesetVersion: next.rulesetVersion,
          contentPackVersion: next.contentPackVersion,
          rngState: { s: [...next.state.rngState.s], draws: next.state.rngState.draws },
        },
        commands: syncCommands,
        createdServiceSeasonId,
        rulesetVersion: runtime.rulesetVersion,
        contentPackVersion: runtime.contentPackVersion,
      }), 'utf8');
      peakStateBytes = Math.max(peakStateBytes, stateBytes);
      peakPutBodyBytes = Math.max(peakPutBodyBytes, putBodyBytes);
      if (next.state.season !== null && next.state.seasonHistory.length === 19) {
        season20ActiveStateBytes = Math.max(season20ActiveStateBytes, stateBytes);
        season20ActivePutBodyBytes = Math.max(season20ActivePutBodyBytes, putBodyBytes);
      }
    }
    return next;
  };

  try {
    const archetypes = runtime.ruleset.archetypes.filter((a) => statGroupOf(a.position) === position);
    const archetype =
      (options.archetypeId !== undefined
        ? archetypes.find((a) => a.id === options.archetypeId)
        : undefined) ?? archetypes[chooseDeterministicIndex(seed, 'archetype', archetypes.length)]!;
    const background =
      (options.backgroundId !== undefined
        ? runtime.ruleset.backgrounds.find((b) => b.id === options.backgroundId)
        : undefined) ??
      runtime.ruleset.backgrounds[
        chooseDeterministicIndex(seed, 'background', runtime.ruleset.backgrounds.length)
      ]!;

    let snapshot = command(
      null,
      'CREATE_CAREER',
      {
        careerId,
        seed,
        simulationMode: options.mode,
        rulesetVersion: runtime.rulesetVersion,
        contentPackVersion: runtime.contentPackVersion,
      },
      `${seed}-create`,
    );
    snapshot = command(
      snapshot,
      'UPDATE_PLAYER_DRAFT',
      {
        draft: {
          name: `표본 ${position} ${index}`,
          gender: chooseDeterministicIndex(seed, 'gender', 2) === 0 ? 'MALE' : 'FEMALE',
          nationalityCode: 'KR',
          preferredFoot: (['LEFT', 'RIGHT', 'BOTH'] as const)[chooseDeterministicIndex(seed, 'foot', 3)],
        },
      },
      `${seed}-draft-1`,
    );
    snapshot = command(
      snapshot,
      'UPDATE_PLAYER_DRAFT',
      { draft: { position: archetype.position, archetypeId: archetype.id, backgroundId: background.id } },
      `${seed}-draft-2`,
    );
    snapshot = command(snapshot, 'CONFIRM_PLAYER', {}, `${seed}-confirm`);
    const baseOvrStart = snapshot.state.player.profile!.baseOvr;
    const truePotential = snapshot.state.player.profile!.truePotential;

    let status = 'ACTIVE';
    let finalChoice = '';
    let retireReason = '';
    let peakWage = 0;
    let step = 0;

    for (;;) {
      if (commands >= COMMAND_BUDGET) {
        status = 'COMMAND_LIMIT';
        break;
      }
      const state = snapshot.state;
      if (state.contract?.wageMinorPerWeek !== undefined) {
        peakWage = Math.max(peakWage, state.contract.wageMinorPerWeek);
      }
      if (state.status !== 'ACTIVE') {
        status = state.status;
        break;
      }
      if (needsDevelopment(state, runtime.ruleset)) {
        const drill = (['CONTROL','ENGINE','VISION'] as const)[chooseDeterministicIndex(seed, `drill:${step}`, 3)]!;
        const load: DevelopmentPlan['load'] = state.state.fitness < 55 || state.health.episodes.some(e => e.status === 'REHAB' || e.status === 'ACTIVE') ? 'RECOVERY' : (['BALANCED','PUSH'] as const)[chooseDeterministicIndex(seed, `load:${step}`, 2)]!;
        const partner = (['COACH','CAPTAIN','RIVAL'] as const)[chooseDeterministicIndex(seed, `partner:${step}`, 3)]!;
        snapshot = command(snapshot, 'DEVELOP', { drill, load, partner }, `${seed}-development-${step}`); step += 1; continue;
      }
      if (state.pending !== null) {
        if (state.pending.kind === 'SETTLEMENT') {
          snapshot = command(snapshot, 'SETTLE_SEASON', {}, `${seed}-settle-${step}`);
          lastSeasonIndex = snapshot.state.seasonHistory.length;
          step += 1;
          continue;
        }
        const hadLastChance = state.retirement?.lastChanceConsumed === true;
        snapshot = closePending(snapshot, `${seed}-resolve-${step}`, options, pack, runtime);
        if (!hadLastChance && snapshot.state.retirement?.lastChanceConsumed === true) {
          retireReason = 'CONTINUED';
        }
        commands += 1;
        step += 1;
        continue;
      }
      if (state.contract !== null && state.season === null) {
        // 은퇴 심사(REVIEW)가 걸리면 --to-retirement 여부와 무관하게 시즌 경계에서 강제 RETIRE된다
        // (packages/domain/src/simulate.ts의 startSeason이 RETIREMENT_DECISION_REQUIRED로 거부한다).
        // 시즌 상한(CAP)으로 강제 은퇴시키는 것은 이 도구의 인공물일 뿐 도메인 관찰이 아니다.
        const reviewRequired = retirementDecisionRequired(state, runtime.ruleset.retirementRules ?? RETIREMENT_POLICY);
        const atSeasonCap = state.seasonHistory.length >= options.seasons;
        if (reviewRequired || atSeasonCap) {
          snapshot = command(snapshot, 'RETIRE', { choice: 'RETIRE' }, `${seed}-retire`);
          finalChoice = 'RETIRE';
          retireReason = reviewRequired ? 'REVIEW' : 'CAP';
          continue;
        }
        for (let decision = 0; decision < 3; decision += 1) {
          const choices = careerEventChoices(snapshot.state, runtime.ruleset.retirementRules ?? RETIREMENT_POLICY);
          const eligible = choices.filter(
            (choice) =>
              choice !== 'MENTOR' ||
              chooseDeterministicIndex(seed, `mentor:${snapshot.state.seasonHistory.length}`, 2) === 0,
          );
          if (eligible.length === 0) break;
          const choice = eligible.includes('INTERNATIONAL')
            ? 'INTERNATIONAL'
            : eligible[
                chooseDeterministicIndex(
                  seed,
                  `career-event:${snapshot.state.seasonHistory.length}:${decision}`,
                  eligible.length,
                )
              ]!;
          snapshot = command(
            snapshot,
            'CAREER_EVENT',
            { choice },
            `${seed}-career-event-${snapshot.state.seasonHistory.length}-${decision}`,
          );
        }
        const nextSeasonIndex = snapshot.state.seasonHistory.length + 1;
        wageAtSeasonStart.set(nextSeasonIndex, snapshot.state.contract?.wageMinorPerWeek ?? 0);
        snapshot = command(
          snapshot,
          'START_SEASON',
          {
            simulationMode: options.mode,
            serviceSeasonId: `${careerId}-${nextSeasonIndex}`,
            legacyLedger: true,
          },
          `${seed}-${nextSeasonIndex}-start`,
        );
        continue;
      }
      snapshot = command(
        snapshot,
        'ADVANCE',
        advancePayload(snapshot.state, pack),
        `${seed}-advance-${step}`,
      );
      step += 1;
    }

    const finalSnapshot = snapshot;
    const finalState = finalSnapshot.state;
    const tierMap = buildTierMap(finalState);
    let legacyScore = 0;
    let legacyBandId = '';
    let legacyEndingId = '';
    if (finalState.status === 'RETIRED') {
      const context = {
        binding: {
          careerId: finalState.careerId,
          createdServiceSeasonId: `${careerId}-1`,
          rulesetVersion: runtime.rulesetVersion,
          contentPackVersion: runtime.contentPackVersion,
        },
        artifacts,
      };
      const archive = createCareerArchiveCore(finalSnapshot, context);
      const result = createLegacyResult(archive, context, undefined, legacyVersion);
      legacyScore = result.totalScore;
      legacyBandId = result.bandId;
      legacyEndingId = result.endingId;
    }

    let peakOvr = baseOvrStart;
    let peakOvrAge = finalState.age;
    let finalOvr = baseOvrStart;
    let totalApps = 0;
    let totalMinutes = 0;
    let totalGoals = 0;
    let totalAssists = 0;
    let ratingSum = 0;
    let ratedMatches = 0;
    let totalIncomeMinor = 0;
    let captainSeasons = 0;
    let seasonsInTier1 = 0;
    let seasonsInTier2 = 0;
    let seasonsInTier3 = 0;

    for (const season of finalState.seasonHistory) {
      const r = season.result;
      if (r.baseOvr.after >= peakOvr) {
        peakOvr = r.baseOvr.after;
        peakOvrAge = r.legacy?.ageAtStart ?? peakOvrAge;
      }
      finalOvr = r.baseOvr.after;
      totalApps += r.playerStats.appearances.total;
      totalMinutes += r.selectionSummary.minutes;
      const ga = groupGoalsAssists(r.playerStats.totals as { group: StatGroup } & Record<string, unknown>);
      totalGoals += ga.goals === '' ? 0 : Number(ga.goals);
      totalAssists += ga.assists === '' ? 0 : Number(ga.assists);
      ratingSum += r.playerStats.ratingSumTenths;
      ratedMatches += r.playerStats.ratedMatches;
      totalIncomeMinor += r.legacy?.incomeMinor ?? 0;
      if (r.captaincyAtEnd === 'CAPTAIN') captainSeasons += 1;
      const tier = tierMap.get(r.index)?.leagueTier;
      if (tier === '1') seasonsInTier1 += 1;
      else if (tier === '2') seasonsInTier2 += 1;
      else if (tier === '3') seasonsInTier3 += 1;

      const tierInfo = tierMap.get(r.index);
      seasonRows.push({
        seed,
        index,
        seasonIndex: r.index,
        age: r.legacy?.ageAtStart ?? '',
        teamId: r.teamId,
        teamName: tierInfo?.teamName ?? '',
        leagueTier: tierInfo?.leagueTier ?? '',
        contractKind: tierInfo?.kind ?? '',
        squadRoleAtStart: r.selectionSummary.squadRoleAtStart,
        squadRoleAtEnd: r.selectionSummary.squadRoleAtEnd,
        finalRank: r.selectionSummary.finalRank,
        apps: r.playerStats.appearances.total,
        started: r.playerStats.appearances.started,
        minutes: r.selectionSummary.minutes,
        possibleMinutes: r.selectionSummary.possibleMinutes,
        goals: ga.goals,
        assists: ga.assists,
        avgRatingTenths:
          r.playerStats.ratedMatches > 0
            ? Math.round(r.playerStats.ratingSumTenths / r.playerStats.ratedMatches)
            : '',
        injuries: r.playerStats.injuries,
        ovrBefore: r.baseOvr.before,
        ovrAfter: r.baseOvr.after,
        formAfter: r.stateDeltas.form.after,
        fitnessAfter: r.stateDeltas.fitness.after,
        moraleAfter: r.stateDeltas.morale.after,
        managerTrustAfter: r.stateDeltas.managerTrust.after,
        wageMinorPerWeek: wageAtSeasonStart.get(r.index) ?? '',
        promiseFulfilled: r.promiseFulfilment.fulfilled ? 'true' : 'false',
        captaincyAtEnd: r.captaincyAtEnd,
      });
    }

    const tiers = finalState.clubHistory.map((stint) => stint.leagueTier).filter((t) => typeof t === 'number');
    const firstTier = finalState.clubHistory[0]?.leagueTier ?? '';
    const bestTier = tiers.length > 0 ? Math.min(...(tiers as number[])) : '';

    const career: CareerRow = {
      seed,
      index,
      position,
      primaryPosition: finalState.player.profile?.primaryPosition ?? '',
      archetypeId: archetype.id,
      backgroundId: background.id,
      mode: options.mode,
      policy: options.policy,
      truePotential,
      baseOvrStart,
      peakOvr,
      peakOvrAge,
      finalOvr,
      seasons: lastSeasonIndex,
      retiredAge: finalState.status === 'RETIRED' ? finalState.age : '',
      status,
      finalChoice,
      retireReason,
      clubs: finalState.clubHistory.length,
      firstTier: String(firstTier),
      bestTier: String(bestTier),
      seasonsInTier1,
      seasonsInTier2,
      seasonsInTier3,
      totalApps,
      totalMinutes,
      totalGoals,
      totalAssists,
      avgRatingTenths: ratedMatches > 0 ? Math.round(ratingSum / ratedMatches) : '',
      injuries: finalState.health.episodes.length,
      severeInjuries: finalState.health.episodes.filter((e) => e.severity === 'MAJOR').length,
      contracts: finalState.clubHistory.length,
      peakWageMinorPerWeek: peakWage,
      totalIncomeMinor,
      nationalCallUps: finalState.nationalTeam.callUps.length,
      captainSeasons,
      legacyScore,
      legacyBandId,
      legacyEndingId,
      commands,
      ...(options.measureStorage === true ? {
        peakStateBytes,
        peakPutBodyBytes,
        season20ActiveStateBytes,
        season20ActivePutBodyBytes,
      } : {}),
      stateHash: finalSnapshot.stateHash,
    };
    return { career, seasons: seasonRows, ms: Date.now() - startedAt };
  } catch (error) {
    const info = error instanceof SimStepError ? error : undefined;
    const career: CareerRow = {
      seed,
      index,
      position,
      primaryPosition: '',
      archetypeId: options.archetypeId ?? '',
      backgroundId: options.backgroundId ?? '',
      mode: options.mode,
      policy: options.policy,
      truePotential: '',
      baseOvrStart: '',
      peakOvr: '',
      peakOvrAge: '',
      finalOvr: '',
      seasons: lastSeasonIndex,
      retiredAge: '',
      status: 'FAILED',
      finalChoice: '',
      retireReason: '',
      clubs: '',
      firstTier: '',
      bestTier: '',
      seasonsInTier1: '',
      seasonsInTier2: '',
      seasonsInTier3: '',
      totalApps: '',
      totalMinutes: '',
      totalGoals: '',
      totalAssists: '',
      avgRatingTenths: '',
      injuries: '',
      severeInjuries: '',
      contracts: '',
      peakWageMinorPerWeek: '',
      totalIncomeMinor: '',
      nationalCallUps: '',
      captainSeasons: '',
      legacyScore: '',
      legacyBandId: '',
      legacyEndingId: '',
      commands,
      ...(options.measureStorage === true ? {
        peakStateBytes,
        peakPutBodyBytes,
        season20ActiveStateBytes,
        season20ActivePutBodyBytes,
      } : {}),
      stateHash: '',
    };
    const failure: FailureRow = {
      seed,
      index,
      seasonIndex: lastSeasonIndex,
      commandIndex: commands,
      pendingKind: info?.pendingKind ?? '',
      commandType: info?.commandType ?? '',
      errorCode: info?.errorCode ?? 'UNKNOWN',
      message: error instanceof Error ? error.message : String(error),
    };
    return { career, seasons: seasonRows, failure, ms: Date.now() - startedAt };
  }
}

// ---------------------------------------------------------------------------
// 배치 실행(단일 프로세스, seed 범위 [rangeStart,rangeEnd))
// ---------------------------------------------------------------------------

export function simulateRange(options: CareerSimOptions): CareerSimBatch {
  const runtime: Runtime = {
    ruleset: loadRuleset(options.rulesetVersion),
    rulesetVersion: options.rulesetVersion,
    contentPackVersion: options.contentPackVersion,
  };
  const pack = loadContentPack(options.contentPackVersion);
  const rawArtifacts = loadRetirementArtifacts(options.rulesetVersion, options.contentPackVersion);
  const legacyVersion: LegacyVersion = rawArtifacts.legacyVersion ?? '1.0.0';
  const artifacts = {
    rulesetVersion: rawArtifacts.rulesetVersion,
    rulesetChecksum: rawArtifacts.rulesetChecksum,
    contentPackVersion: rawArtifacts.contentPackVersion,
    contentPackChecksum: rawArtifacts.contentPackChecksum,
  };
  const start = options.rangeStart ?? 0;
  const end = options.rangeEnd ?? options.seeds;
  const careers: CareerRow[] = [];
  const seasons: SeasonRow[] = [];
  const failures: FailureRow[] = [];
  const msValues: number[] = [];
  for (let index = start; index < end; index += 1) {
    const position: StatGroup =
      options.position === 'all' ? POSITIONS[index % 4]! : (options.position as StatGroup);
    const { career, seasons: seasonRows, failure, ms } = runOneCareer(
      position,
      index,
      options,
      runtime,
      pack,
      legacyVersion,
      artifacts,
    );
    careers.push(career);
    seasons.push(...seasonRows);
    if (failure !== undefined) failures.push(failure);
    msValues.push(ms);
    if ((index + 1) % 10 === 0) process.stderr.write(`career-sim: ${index + 1}/${end} (범위 ${start}-${end})\n`);
  }
  return { careers, seasons, failures, msValues };
}

// ---------------------------------------------------------------------------
// CSV/요약
// ---------------------------------------------------------------------------

function csvEscape(value: string | number): string {
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(header: readonly string[], rows: readonly Record<string, string | number>[]): string {
  const lines = [header.join(',')];
  for (const row of rows) lines.push(header.map((key) => csvEscape(row[key] ?? '')).join(','));
  return `${lines.join('\n')}\n`;
}

function quantile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return Math.round(sorted[rank]! * 100) / 100;
}

function numericStats(values: readonly number[]): { mean: number; p10: number; p50: number; p90: number } {
  if (values.length === 0) return { mean: 0, p10: 0, p50: 0, p90: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const mean = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
  return { mean, p10: quantile(sorted, 0.1), p50: quantile(sorted, 0.5), p90: quantile(sorted, 0.9) };
}

// 시즌 상한(CAP)으로 강제 은퇴시킨 커리어가 상한 나이에 뭉치는 것은 도구의 인공물이지 도메인
// 관찰이 아니다 — retiredAge 통계는 실제 은퇴 심사(REVIEW)로 은퇴한 커리어만 대상으로 한다.
function retiredAgeStats(careers: readonly CareerRow[]): { mean: number | null; p10: number | null; p50: number | null; p90: number | null; n: number } {
  const ages = careers
    .filter((c) => c.retireReason === 'REVIEW')
    .map((c) => c.retiredAge)
    .filter((v): v is number => typeof v === 'number');
  if (ages.length === 0) return { mean: null, p10: null, p50: null, p90: null, n: 0 };
  const stats = numericStats(ages);
  return { ...stats, n: ages.length };
}

function computeGroupSummary(careers: readonly CareerRow[]) {
  const numeric = (key: string) =>
    careers.map((c) => c[key]).filter((v): v is number => typeof v === 'number');
  const peakOvr = numericStats(numeric('peakOvr'));
  const finalOvr = numericStats(numeric('finalOvr'));
  const retiredAge = retiredAgeStats(careers);
  const seasons = numericStats(numeric('seasons'));
  const totalInjuries = numeric('injuries').reduce((a, b) => a + b, 0);
  const totalSeasons = numeric('seasons').reduce((a, b) => a + b, 0);
  const injuriesPerSeason = totalSeasons > 0 ? Math.round((totalInjuries / totalSeasons) * 100) / 100 : 0;
  const tier1Reach = careers.filter((c) => Number(c.seasonsInTier1) > 0).length;
  const tier1ReachRate = careers.length > 0 ? Math.round((tier1Reach / careers.length) * 10000) / 10000 : 0;
  const legacyBand: Record<string, number> = {};
  for (const c of careers) {
    const band = String(c.legacyBandId || '');
    if (band === '') continue;
    legacyBand[band] = (legacyBand[band] ?? 0) + 1;
  }
  return { peakOvr, finalOvr, retiredAge, seasons, injuriesPerSeason, tier1ReachRate, legacyBand };
}

export function buildSummary(
  options: CareerSimOptions,
  batch: CareerSimBatch,
  startedAt: string,
  elapsedMs: number,
): Record<string, unknown> {
  const { careers } = batch;
  const failedCount = careers.filter((c) => c.status === 'FAILED').length;
  const overall = computeGroupSummary(careers);
  const byPosition: Record<string, unknown> = {};
  for (const position of POSITIONS) {
    byPosition[position] = computeGroupSummary(careers.filter((c) => c.position === position));
  }
  const ovrByAge: Record<string, { mean: number; p50: number; n: number }> = {};
  const byAge = new Map<number, number[]>();
  for (const season of batch.seasons) {
    const age = season.age;
    const ovrAfter = season.ovrAfter;
    if (typeof age !== 'number' || typeof ovrAfter !== 'number') continue;
    const list = byAge.get(age) ?? [];
    list.push(ovrAfter);
    byAge.set(age, list);
  }
  for (const [age, values] of byAge) {
    const sorted = [...values].sort((a, b) => a - b);
    ovrByAge[String(age)] = {
      mean: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100,
      p50: quantile(sorted, 0.5),
      n: values.length,
    };
  }
  const tierBySeasonIndex: Record<string, { 1: number; 2: number; 3: number }> = {};
  for (const season of batch.seasons) {
    const seasonIndex = season.seasonIndex;
    if (typeof seasonIndex !== 'number') continue;
    const key = String(seasonIndex);
    const bucket = tierBySeasonIndex[key] ?? { 1: 0, 2: 0, 3: 0 };
    const tier = season.leagueTier;
    if (tier === '1') bucket[1] += 1;
    else if (tier === '2') bucket[2] += 1;
    else if (tier === '3') bucket[3] += 1;
    tierBySeasonIndex[key] = bucket;
  }
  const tier1ReachBySeason: Record<string, number> = {};
  for (const seasonMark of [5, 10]) {
    const reached = careers.filter((c) => {
      const s = Number(c.seasons);
      return s >= seasonMark && Number(c.seasonsInTier1) > 0;
    }).length;
    tier1ReachBySeason[String(seasonMark)] =
      careers.length > 0 ? Math.round((reached / careers.length) * 10000) / 10000 : 0;
  }
  const msStats = numericStats(batch.msValues);
  return {
    runtime: {
      rulesetVersion: options.rulesetVersion,
      contentPackVersion: options.contentPackVersion,
      policy: options.policy,
      mode: options.mode,
      seeds: options.seeds,
      seasonsCap: options.seasons,
      toRetirement: options.toRetirement,
      jobs: options.jobs,
      hashProvider: options.pureHash === true ? 'pure' : 'node-crypto',
      startedAt,
      elapsedMs,
      msPerCareer: { mean: msStats.mean, p50: msStats.p50, p90: msStats.p90 },
    },
    careers: { count: careers.length, failed: failedCount },
    overall: { ...overall, tier1ReachBySeason },
    byPosition,
    ovrByAge,
    tierBySeasonIndex,
  };
}

// ---------------------------------------------------------------------------
// 진입점: runCareerSim (프로세스를 죽이지 않는 순수 함수 — 오류는 반환값으로만)
// ---------------------------------------------------------------------------

export async function runCareerSim(rawOptions: CareerSimOptions): Promise<CareerSimResult> {
  const options: CareerSimOptions = { ...rawOptions, out: resolveOut(rawOptions.out) };
  // T-7-020: 이 프로세스에서 실행되는 모든 시뮬레이션(자식 프로세스는 각자 main()을 거쳐 다시
  // 이 함수를 호출한다)에 Node crypto SHA-256을 주입한다. `--pure-hash`면 순수 구현을 쓴다.
  applyHashProvider(options.pureHash === true);
  const startedAt = new Date().toISOString();
  const started = Date.now();
  try {
    if (!(RULESET_VERSIONS as readonly string[]).includes(options.rulesetVersion))
      return { ok: false, error: { code: 'UNKNOWN_RULESET', message: `알 수 없는 --ruleset: ${options.rulesetVersion}` } };
    if (!(PACK_VERSIONS as readonly string[]).includes(options.contentPackVersion))
      return { ok: false, error: { code: 'UNKNOWN_PACK', message: `알 수 없는 --pack: ${options.contentPackVersion}` } };
    // 팩·룰셋 호환성은 loadRetirementArtifacts가 검증한다(비호환이면 예외).
    loadRetirementArtifacts(options.rulesetVersion, options.contentPackVersion);
  } catch (error) {
    return {
      ok: false,
      error: {
        code: 'INCOMPATIBLE_VERSIONS',
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }

  let batch: CareerSimBatch;
  if (options.jobs > 1 && options.rangeStart === undefined) {
    batch = await runParallel(options);
  } else {
    batch = simulateRange(options);
  }

  if (options.verify) {
    const verifyOptions: CareerSimOptions = { ...options, seeds: 3, jobs: 1, rangeStart: 0, rangeEnd: 3 };
    const first = simulateRange(verifyOptions);
    const second = simulateRange(verifyOptions);
    const firstHashes = first.careers.map((c) => c.stateHash).join(',');
    const secondHashes = second.careers.map((c) => c.stateHash).join(',');
    if (firstHashes !== secondHashes) {
      return {
        ok: false,
        error: { code: 'NONDETERMINISTIC', message: `--verify 실패: ${firstHashes} !== ${secondHashes}` },
      };
    }

    // T-7-020: seed 1개(범위 [0,1))를 순수 구현과 Node crypto 주입 각각으로 돌려 stateHash가
    // 같은지 확인한다(같은 프로세스에서 provider를 켰다 끄면 된다). 끝나면 options.pureHash에
    // 맞는 상태로 되돌린다.
    const singleSeedOptions: CareerSimOptions = { ...options, seeds: 1, jobs: 1, rangeStart: 0, rangeEnd: 1 };
    applyHashProvider(true);
    const pureRun = simulateRange(singleSeedOptions);
    applyHashProvider(false);
    const injectedRun = simulateRange(singleSeedOptions);
    applyHashProvider(options.pureHash === true);
    const pureHash = pureRun.careers[0]?.stateHash;
    const injectedHash = injectedRun.careers[0]?.stateHash;
    if (pureHash !== injectedHash) {
      return {
        ok: false,
        error: {
          code: 'NONDETERMINISTIC',
          message: `--verify 실패: 순수 해시(${String(pureHash)}) !== 주입 해시(${String(injectedHash)})`,
        },
      };
    }
  }

  const elapsedMs = Date.now() - started;
  const summary = buildSummary(options, batch, startedAt, elapsedMs);

  await mkdir(options.out, { recursive: true });
  const careersHeader = options.measureStorage === true ? CAREERS_STORAGE_CSV_HEADER : CAREERS_CSV_HEADER;
  await writeFile(resolve(options.out, 'careers.csv'), toCsv(careersHeader, batch.careers), 'utf8');
  await writeFile(resolve(options.out, 'seasons.csv'), toCsv(SEASONS_CSV_HEADER, batch.seasons), 'utf8');
  await writeFile(resolve(options.out, 'failures.csv'), toCsv(FAILURES_CSV_HEADER, batch.failures), 'utf8');
  await writeFile(resolve(options.out, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  // 병렬 실행(runParallel)이 shard의 careers.csv(ms 컬럼 없음)만으로는 msPerCareer를 다시 계산할
  // 수 없어, 자식 프로세스(--range-start 지정)일 때만 원시 ms 배열을 내부용 파일로 남긴다.
  // partDir 전체가 병합 뒤 삭제되므로 최종 --out 디렉터리에는 남지 않는다.
  if (options.rangeStart !== undefined) {
    await writeFile(resolve(options.out, 'ms.json'), JSON.stringify(batch.msValues), 'utf8');
  }

  return { ok: true, batch, summary, elapsedMs };
}

// ---------------------------------------------------------------------------
// 병렬 실행: 자기 자신을 자식 프로세스로 띄워 seed 범위를 나눈다.
// ---------------------------------------------------------------------------

// legacy-population-node.mjs 선례: tsx의 .bin 셔밈은 셸 스크립트(node가 아니다) — 실행 파일로
// 직접 spawn해 자신의 셔뱅이 인터프리터를 고르게 한다(`process.execPath`로 감싸면 셔뱅 스크립트를
// node가 JS로 파싱해 SyntaxError가 난다).
function runChild(tsxBin: string, args: string[]): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(tsxBin, args, { stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code) => (code === 0 ? resolvePromise() : reject(new Error(`child exited with ${code}`))));
  });
}

async function runParallel(options: CareerSimOptions): Promise<CareerSimBatch> {
  const tsxBin = resolve(REPO_ROOT, 'node_modules/.pnpm/node_modules/.bin/tsx');
  const script = resolve(REPO_ROOT, 'tooling/scripts/career-sim.ts');
  const jobs = Math.max(1, Math.min(options.jobs, options.seeds));
  const partDir = resolve(options.out, '.parts');
  await mkdir(partDir, { recursive: true });
  const ranges: Array<{ start: number; end: number; dir: string }> = [];
  for (let shard = 0; shard < jobs; shard += 1) {
    const start = Math.floor((options.seeds * shard) / jobs);
    const end = Math.floor((options.seeds * (shard + 1)) / jobs);
    if (end <= start) continue;
    ranges.push({ start, end, dir: resolve(partDir, `part-${shard}`) });
  }
  const results = await Promise.allSettled(
    ranges.map(({ start, end, dir }) =>
      runChild(tsxBin, [
        script,
        '--ruleset', options.rulesetVersion,
        '--pack', options.contentPackVersion,
        '--seeds', String(options.seeds),
        '--seed-prefix', options.seedPrefix,
        '--seasons', String(options.seasons),
        ...(options.toRetirement ? ['--to-retirement'] : []),
        '--policy', options.policy,
        '--position', options.position,
        ...(options.archetypeId !== undefined ? ['--archetype', options.archetypeId] : []),
        ...(options.backgroundId !== undefined ? ['--background', options.backgroundId] : []),
        '--mode', options.mode,
        ...(options.pureHash === true ? ['--pure-hash'] : []),
        ...(options.measureStorage === true ? ['--measure-storage'] : []),
        '--jobs', '1',
        '--out', dir,
        '--range-start', String(start),
        '--range-end', String(end),
      ]),
    ),
  );
  const careers: CareerRow[] = [];
  const seasons: SeasonRow[] = [];
  const failures: FailureRow[] = [];
  const msValues: number[] = [];
  let anyFailed = false;
  for (let i = 0; i < results.length; i += 1) {
    const outcome = results[i]!;
    const dir = ranges[i]!.dir;
    if (outcome.status === 'rejected') {
      anyFailed = true;
      process.stderr.write(`career-sim: 자식 프로세스 실패(${dir}): ${String(outcome.reason)}\n`);
    }
    try {
      const partSummary = JSON.parse(await readFile(resolve(dir, 'summary.json'), 'utf8')) as {
        careers: { count: number };
      };
      void partSummary;
      const [careersCsv, seasonsCsv, failuresCsv, msJson] = await Promise.all([
        readFile(resolve(dir, 'careers.csv'), 'utf8'),
        readFile(resolve(dir, 'seasons.csv'), 'utf8'),
        readFile(resolve(dir, 'failures.csv'), 'utf8'),
        readFile(resolve(dir, 'ms.json'), 'utf8'),
      ]);
      const careersHeader = options.measureStorage === true ? CAREERS_STORAGE_CSV_HEADER : CAREERS_CSV_HEADER;
      careers.push(...parseCsv(careersCsv, careersHeader, CAREERS_NUMERIC_COLUMNS));
      seasons.push(...parseCsv(seasonsCsv, SEASONS_CSV_HEADER, SEASONS_NUMERIC_COLUMNS));
      failures.push(...parseCsv(failuresCsv, FAILURES_CSV_HEADER, FAILURES_NUMERIC_COLUMNS));
      msValues.push(...(JSON.parse(msJson) as number[]));
    } catch {
      anyFailed = true;
    }
  }
  careers.sort((a, b) => Number(a.index) - Number(b.index) || String(a.position).localeCompare(String(b.position)));
  await rm(partDir, { recursive: true, force: true });
  if (anyFailed && careers.length === 0) throw new Error('모든 자식 프로세스가 실패했다');
  return { careers, seasons, failures, msValues };
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

function parseCsv(
  text: string,
  header: readonly string[],
  numericColumns: ReadonlySet<string>,
): Record<string, string | number>[] {
  const lines = text.split('\n').filter((l) => l.length > 0);
  const rows: Record<string, string | number>[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cells = parseCsvLine(lines[i]!);
    const row: Record<string, string | number> = {};
    header.forEach((key, idx) => {
      const raw = cells[idx] ?? '';
      // 빈칸은 빈칸으로 유지한다(goals/assists 등 GK·DF 포지션에서 의도적으로 빈 문자열).
      row[key] = raw !== '' && numericColumns.has(key) ? Number(raw) : raw;
    });
    rows.push(row);
  }
  return rows;
}

// ---------------------------------------------------------------------------
// argv 파싱 + CLI
// ---------------------------------------------------------------------------

function argValue(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index < 0 ? undefined : argv[index + 1];
}

const HELP_TEXT = `career-sim: 헤드리스 커리어 일괄 시뮬레이션 CLI (T-7-017, D-79)

사용법:
  pnpm sim:career --out <dir> [옵션...]

옵션:
  --ruleset <version>       기본 1.5.0
  --pack <version>          기본 0.6.0
  --seeds <n>               커리어 수, 기본 20
  --seed-prefix <text>      기본 career-sim
  --seasons <n>             시즌 상한, 기본 20
  --to-retirement           시즌 경계에서 은퇴 조건이면 RETIRE
  --policy first|random|opportunity  기본 opportunity
  --position GK|DF|MF|FW|all         기본 all
  --archetype <id>          고정 archetype(선택)
  --background <id>         고정 background(선택)
  --mode CHAPTER|FAST        기본 CHAPTER
  --jobs <n>                자식 프로세스 수, 기본 1
  --out <dir>               결과 디렉터리(필수)
  --verify                  seed 3개를 두 번 돌려 결정론 확인
  --pure-hash               T-7-020: Node crypto 주입을 끄고 도메인 순수 SHA-256 구현으로 돌린다
  --measure-storage         T-7-022: state와 보수적 offline PUT 크기를 추가 계측한다
  --help                    이 도움말
`;

export function parseArgs(argv: string[]): CareerSimOptions | { help: true } {
  if (argv.includes('--help')) return { help: true };
  const rangeStartArg = argValue(argv, '--range-start');
  const rangeEndArg = argValue(argv, '--range-end');
  const archetypeId = argValue(argv, '--archetype');
  const backgroundId = argValue(argv, '--background');
  return {
    rulesetVersion: argValue(argv, '--ruleset') ?? '1.5.0',
    contentPackVersion: argValue(argv, '--pack') ?? '0.6.0',
    seeds: Number(argValue(argv, '--seeds') ?? '20'),
    seedPrefix: argValue(argv, '--seed-prefix') ?? 'career-sim',
    seasons: Number(argValue(argv, '--seasons') ?? '20'),
    toRetirement: argv.includes('--to-retirement'),
    policy: (argValue(argv, '--policy') ?? 'opportunity') as Policy,
    position: (argValue(argv, '--position') ?? 'all') as PositionArg,
    mode: (argValue(argv, '--mode') ?? 'CHAPTER') as Mode,
    jobs: Number(argValue(argv, '--jobs') ?? '1'),
    out: argValue(argv, '--out') ?? '',
    verify: argv.includes('--verify'),
    pureHash: argv.includes('--pure-hash'),
    measureStorage: argv.includes('--measure-storage'),
    ...(archetypeId !== undefined ? { archetypeId } : {}),
    ...(backgroundId !== undefined ? { backgroundId } : {}),
    ...(rangeStartArg !== undefined ? { rangeStart: Number(rangeStartArg) } : {}),
    ...(rangeEndArg !== undefined ? { rangeEnd: Number(rangeEndArg) } : {}),
  };
}

export async function main(argv = process.argv.slice(2)): Promise<number> {
  const parsed = parseArgs(argv);
  if ('help' in parsed) {
    process.stdout.write(HELP_TEXT);
    return 0;
  }
  if (parsed.out === '') {
    process.stderr.write('career-sim: --out은 필수다.\n');
    return 1;
  }
  if (!['first', 'random', 'opportunity'].includes(parsed.policy)) {
    process.stderr.write('career-sim: --policy는 first|random|opportunity 중 하나다.\n');
    return 1;
  }
  if (!['GK', 'DF', 'MF', 'FW', 'all'].includes(parsed.position)) {
    process.stderr.write('career-sim: --position은 GK|DF|MF|FW|all 중 하나다.\n');
    return 1;
  }
  const result = await runCareerSim(parsed);
  if (!result.ok) {
    process.stderr.write(`career-sim: ${result.error.code}: ${result.error.message}\n`);
    return result.error.code === 'NONDETERMINISTIC' ? 2 : 1;
  }
  const failedCount = result.batch.careers.filter((c) => c.status === 'FAILED').length;
  const overall = result.summary.overall as Record<string, unknown>;
  process.stdout.write(`career-sim: 커리어 ${result.batch.careers.length}개, 실패 ${failedCount}개\n`);
  process.stdout.write(`career-sim: 소요 시간 ${result.elapsedMs}ms\n`);
  process.stdout.write(`career-sim: peakOvr ${JSON.stringify(overall.peakOvr)}\n`);
  process.stdout.write(`career-sim: finalOvr ${JSON.stringify(overall.finalOvr)}\n`);
  process.stdout.write(`career-sim: retiredAge ${JSON.stringify(overall.retiredAge)}\n`);
  process.stdout.write(`career-sim: seasons ${JSON.stringify(overall.seasons)}\n`);
  process.stdout.write(`career-sim: injuriesPerSeason ${overall.injuriesPerSeason}\n`);
  process.stdout.write(`career-sim: tier1ReachRate ${overall.tier1ReachRate}\n`);
  process.stdout.write(`career-sim: legacyBand ${JSON.stringify(overall.legacyBand)}\n`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const code = await main();
  process.exit(code);
}
