import { loadContentPack, loadRuleset, buildAnnualContentContext } from '@offside/content';
import {
  AnnualRunResponseSchema,
  AnnualDecisionViewSchema,
  CareerStateSchema,
  GetCareerResponseSchema,
  type AnnualRunResponse,
  type AnnualDecisionView,
  type GetCareerResponse,
  type PutCareerBody,
} from '@offside/contracts';
import {
  canonicalize,
  simulate,
  verifySnapshot,
  startAnnualRun,
  nextAnnualAction,
  type AnnualCheckpoint,
  type AnnualPolicy,
  type AnnualDecision,
  type DomainSnapshot,
  type Command,
  type JsonValue,
} from '@offside/domain';
import { and, desc, eq } from 'drizzle-orm';
import type { Db } from './db/client.js';
import { annualRuns } from './db/schema.js';
import { getCareer, type CareerRecord } from './db/repos/careers.js';
import { getLatestSnapshot, getSnapshotByRevision } from './db/repos/snapshots.js';
import { sha256Hex } from './db/hash.js';
import { AppError } from './errors.js';
import type { SessionContext } from './env.js';
import { buildRetirementRows } from './sync/retirement.js';

export const ANNUAL_CHUNK_COMMANDS = 4;
export const ANNUAL_MAX_COMMANDS = 240;
export const isAnnualPair = (ruleset: string, pack: string) =>
  ruleset === '3.5.0' && pack === '0.14.0';
export const annualVersionReserved = (ruleset: string, pack: string) =>
  ruleset === '3.5.0' || pack === '0.14.0';
type Run = typeof annualRuns.$inferSelect;
type Recorded = { command: Command; snapshot: DomainSnapshot };
type Access = { d1: D1Database; db: Db; session: SessionContext };
const liveSession = `EXISTS (SELECT 1 FROM sessions s INNER JOIN profiles p ON p.id=s.profile_id WHERE s.id=? AND s.profile_id=? AND s.revoked_at IS NULL AND s.expires_at>? AND p.deleted_at IS NULL)`;
const stamp = () => new Date().toISOString();
function conflict(message = '진행 상태가 바뀌었습니다. 저장된 상태를 다시 불러와 주세요.'): never {
  throw new AppError({ code: 'CAREER_REVISION_CONFLICT', status: 409, message });
}
function unavailable(message: string): never {
  throw new AppError({ code: 'VALIDATION_FAILED', status: 422, message });
}
function liveArgs(session: SessionContext, now: string) {
  return [session.id, session.profileId, now];
}
export function requireAnnualKey(key: string | undefined): string {
  if (!key || !/^[A-Za-z0-9_-]{8,128}$/.test(key))
    unavailable('유효한 Idempotency-Key가 필요합니다.');
  return key;
}
async function owned(access: Access, id: string): Promise<CareerRecord> {
  const career = await getCareer(access.db, id);
  if (!career || career.ownerProfileId !== access.session.profileId)
    throw new AppError({ code: 'CAREER_NOT_FOUND', message: '커리어를 찾을 수 없습니다.' });
  if (
    career.authority !== 'SERVER_ANNUAL' ||
    !isAnnualPair(career.rulesetVersion, career.contentPackVersion)
  )
    unavailable('이 커리어는 연간 서버 진행 대상이 아닙니다.');
  return career;
}
async function snapshotFor(
  access: Access,
  career: CareerRecord,
  revision = career.revision,
): Promise<DomainSnapshot> {
  const row =
    revision === career.revision
      ? await getLatestSnapshot(access.db, career.id)
      : await getSnapshotByRevision(access.db, career.id, revision);
  if (!row || row.revision !== revision) conflict();
  // JSON has no present-undefined fields; the runtime schema validates the persisted value.
  const state = CareerStateSchema.parse(JSON.parse(row.state)) as DomainSnapshot['state'];
  const snapshot: DomainSnapshot = {
    revision: row.revision,
    checkpoint: row.checkpoint,
    state,
    stateHash: row.stateHash,
    rulesetVersion: row.rulesetVersion,
    contentPackVersion: row.contentPackVersion,
  };
  if (!verifySnapshot(snapshot).ok) unavailable('저장된 진행 기록을 확인할 수 없습니다.');
  return snapshot;
}
function wireSnapshot(snapshot: DomainSnapshot, now: string) {
  return {
    ...snapshot,
    id: `${snapshot.state.careerId}:${snapshot.revision}`,
    careerId: snapshot.state.careerId,
    state: canonicalize(snapshot.state as unknown as JsonValue),
    rulesetVersion: snapshot.state.rulesetVersion,
    contentPackVersion: snapshot.state.contentPackVersion,
    rngState: snapshot.state.rngState,
    createdAt: now,
  };
}
function execute(snapshot: DomainSnapshot | null, command: Command, id: string): DomainSnapshot {
  const rulesetVersion = snapshot?.state.rulesetVersion ?? '3.5.0';
  const contentPackVersion = snapshot?.state.contentPackVersion ?? '0.14.0';
  const result = simulate({
    snapshot,
    command: {
      ...command,
      commandId: `${id}:${(snapshot?.revision ?? 0) + 1}`,
      expectedRevision: snapshot?.revision ?? 0,
    },
    ruleset: loadRuleset(rulesetVersion),
    rulesetVersion,
    contentPackVersion,
  });
  if (!result.ok) throw new AppError({ code: result.error.code, message: result.error.message });
  return result.snapshot;
}
function publicDecision(decision: AnnualDecision, snapshot: DomainSnapshot): AnnualDecisionView {
  const pending = snapshot.state.pending;
  return AnnualDecisionViewSchema.parse({
    ...decision,
    choices: decision.choices.map(({ id, label, risk }) => {
      const offer =
        pending?.kind === 'OFFERS' || pending?.kind === 'CONTRACT'
          ? pending.offers.find((entry) => entry.id === id)
          : undefined;
      return {
        id,
        label,
        ...(risk ? { risk } : {}),
        ...(offer
          ? {
              detail: `${offer.lengthSeasons}시즌 · 주급 ${offer.wageMinorPerWeek} · 약속 역할 ${offer.rolePromise}`,
            }
          : {}),
      };
    }),
  });
}
function view(run: Run, snapshot: DomainSnapshot, includeSnapshot: boolean): AnnualRunResponse {
  const checkpoint = JSON.parse(run.checkpointJson) as AnnualCheckpoint;
  return AnnualRunResponseSchema.parse({
    run: {
      id: run.id,
      careerId: run.careerId,
      revision: run.revision,
      careerRevision: run.careerRevision,
      status: run.status,
      targetSeasonIndex: checkpoint.targetSeasonIndex,
      completedCommands: run.commandCount,
      currentStep: snapshot.state.currentStep,
      policy: checkpoint.policy,
      decision: run.decisionJson === null ? null : JSON.parse(run.decisionJson),
      report: run.reportJson === null ? null : JSON.parse(run.reportJson),
    },
    ...(includeSnapshot ? { snapshot: wireSnapshot(snapshot, run.updatedAt) } : {}),
  });
}
async function replay(
  access: Access,
  keyHash: string,
  requestHash: string,
): Promise<unknown | null> {
  const now = stamp();
  const row = await access.d1
    .prepare(
      `SELECT r.request_hash,r.response_json FROM annual_requests r INNER JOIN careers c ON c.id=r.career_id WHERE r.request_key_hash=? AND c.owner_profile_id=? AND ${liveSession}`,
    )
    .bind(keyHash, access.session.profileId, ...liveArgs(access.session, now))
    .first<{ request_hash: string; response_json: string }>();
  if (!row) return null;
  if (row.request_hash !== requestHash) conflict('같은 요청 키로 다른 선택을 보낼 수 없습니다.');
  return JSON.parse(row.response_json);
}
function snapshotStatement(
  d1: D1Database,
  snapshot: DomainSnapshot,
  now: string,
  guard: string,
  guardArgs: unknown[],
) {
  const s = wireSnapshot(snapshot, now);
  return d1
    .prepare(
      `INSERT INTO snapshots(id,career_id,revision,checkpoint,state,state_hash,ruleset_version,content_pack_version,rng_state_json,created_at) SELECT ?,?,?,?,?,?,?,?,?,? WHERE ${guard}`,
    )
    .bind(
      s.id,
      s.careerId,
      s.revision,
      s.checkpoint,
      s.state,
      s.stateHash,
      s.rulesetVersion,
      s.contentPackVersion,
      JSON.stringify(s.rngState),
      now,
      ...guardArgs,
    );
}
function commandStatements(
  d1: D1Database,
  records: Recorded[],
  now: string,
  guard: string,
  guardArgs: unknown[],
) {
  return records.map(({ command, snapshot }) =>
    d1
      .prepare(
        `INSERT INTO command_log(career_id,revision,command_id,command_type,payload_json,result_hash,created_at) SELECT ?,?,?,?,?,?,? WHERE ${guard}`,
      )
      .bind(
        snapshot.state.careerId,
        snapshot.revision,
        `${snapshot.state.careerId}:${snapshot.revision}`,
        command.type,
        JSON.stringify(command.payload),
        snapshot.stateHash,
        now,
        ...guardArgs,
      ),
  );
}

/** Initial creation accepts a draft, never a client seed, version, snapshot or command. */
export async function createAnnualCareer(
  access: Access,
  input: {
    expectedProfileId: string;
    draft: import('@offside/contracts').PlayerDraft;
    simulationMode?: 'FAST' | 'CHAPTER' | undefined;
  },
  seasonId: string,
  key: string,
): Promise<GetCareerResponse> {
  if (input.expectedProfileId !== access.session.profileId)
    conflict('프로필이 변경되었습니다. 새 선수 만들기를 다시 시작해 주세요.');
  const keyHash = await sha256Hex(JSON.stringify(['ANNUAL_CREATE', access.session.profileId, key]));
  const requestHash = await sha256Hex(JSON.stringify(input));
  const previous = await replay(access, keyHash, requestHash);
  if (previous) return GetCareerResponseSchema.parse(previous);
  const season = await access.d1
    .prepare('SELECT * FROM service_seasons WHERE id=?')
    .bind(seasonId)
    .first<{ status: string; ruleset_version: string; content_pack_version: string }>();
  if (
    !season ||
    !['ACTIVE', 'PRESEASON'].includes(season.status) ||
    !isAnnualPair(season.ruleset_version, season.content_pack_version)
  )
    unavailable('서버 연간 커리어를 지원하는 서비스 시즌이 아직 열리지 않았습니다.');
  const id = crypto.randomUUID(),
    now = stamp();
  const commands: Command[] = [
    {
      type: 'CREATE_CAREER',
      payload: {
        careerId: id,
        seed: crypto.randomUUID(),
        simulationMode: input.simulationMode ?? 'FAST',
        rulesetVersion: season.ruleset_version,
        contentPackVersion: season.content_pack_version,
      },
    },
    { type: 'UPDATE_PLAYER_DRAFT', payload: { draft: input.draft } },
    { type: 'CONFIRM_PLAYER', payload: {} },
  ];
  let snapshot: DomainSnapshot | null = null;
  const records = commands.map((command) => {
    snapshot = execute(snapshot, command, id);
    return { command, snapshot };
  });
  const final = records[records.length - 1]!.snapshot;
  const response = GetCareerResponseSchema.parse({
    authority: 'SERVER_ANNUAL',
    createdServiceSeasonId: seasonId,
    snapshot: wireSnapshot(final, now),
    commands: records.map(({ command, snapshot: s }) => ({
      careerId: id,
      revision: s.revision,
      commandId: `${id}:${s.revision}`,
      commandType: command.type,
      payload: command.payload,
      resultHash: s.stateHash,
      createdAt: now,
    })),
  });
  const guard = 'EXISTS (SELECT 1 FROM careers WHERE id=? AND owner_profile_id=?)',
    guardArgs = [id, access.session.profileId];
  try {
    const results = await access.d1.batch([
      access.d1
        .prepare(
          `INSERT INTO careers(id,authority,owner_profile_id,status,revision,created_service_season_id,ruleset_version,content_pack_version,verification_status,last_synced_at,created_at,updated_at) SELECT ?,'SERVER_ANNUAL',?,'ACTIVE',?,?,?,?, 'VERIFIED',?,?,? WHERE ${liveSession} AND EXISTS(SELECT 1 FROM service_seasons WHERE id=? AND status IN ('ACTIVE','PRESEASON') AND ruleset_version=? AND content_pack_version=?)`,
        )
        .bind(
          id,
          access.session.profileId,
          final.revision,
          seasonId,
          season.ruleset_version,
          season.content_pack_version,
          now,
          now,
          now,
          ...liveArgs(access.session, stamp()),
          seasonId,
          season.ruleset_version,
          season.content_pack_version,
        ),
      snapshotStatement(access.d1, final, now, guard, guardArgs),
      ...commandStatements(access.d1, records, now, guard, guardArgs),
      access.d1
        .prepare(
          `INSERT INTO annual_requests(id,career_id,request_key_hash,request_hash,response_json,created_at) SELECT ?,?,?,?,?,? WHERE ${guard}`,
        )
        .bind(
          crypto.randomUUID(),
          id,
          keyHash,
          requestHash,
          JSON.stringify(response),
          now,
          ...guardArgs,
        ),
    ]);
    if (results[0]?.meta.changes !== 1) conflict();
  } catch (error) {
    const saved = await replay(access, keyHash, requestHash);
    if (saved) return GetCareerResponseSchema.parse(saved);
    throw error;
  }
  return response;
}

export async function getAnnualRun(
  access: Access,
  id: string,
  runId?: string,
): Promise<AnnualRunResponse | null> {
  const career = await owned(access, id);
  const [run] = await access.db
    .select()
    .from(annualRuns)
    .where(
      runId
        ? and(eq(annualRuns.careerId, id), eq(annualRuns.id, runId))
        : eq(annualRuns.careerId, id),
    )
    .orderBy(desc(annualRuns.createdAt))
    .limit(1);
  return run ? view(run, await snapshotFor(access, career, run.careerRevision), false) : null;
}

/** Article-derived annual starts use the immutable source seed/build, not active-manifest seed. */
export async function persistAnnualChallenge(
  access: Access,
  started: GetCareerResponse,
  articleId: string,
  keyHash: string,
  requestHash: string,
): Promise<void> {
  const s = started.snapshot,
    id = s.careerId,
    now = stamp();
  const state = CareerStateSchema.parse(JSON.parse(s.state)) as DomainSnapshot['state'];
  const snapshot: DomainSnapshot = { ...s, state };
  if (!isAnnualPair(s.rulesetVersion, s.contentPackVersion) || !verifySnapshot(snapshot).ok)
    unavailable('도전의 서버 버전을 확인할 수 없습니다.');
  const guard = 'EXISTS(SELECT 1 FROM careers WHERE id=? AND owner_profile_id=?)',
    args = [id, access.session.profileId];
  const results = await access.d1.batch([
    access.d1
      .prepare(
        `INSERT INTO careers(id,authority,owner_profile_id,status,revision,created_service_season_id,ruleset_version,content_pack_version,verification_status,last_synced_at,created_at,updated_at) SELECT ?,'SERVER_ANNUAL',?,'ACTIVE',?,?,?,?,'VERIFIED',?,?,? WHERE ${liveSession} AND EXISTS(SELECT 1 FROM career_publications WHERE id=?) AND EXISTS(SELECT 1 FROM service_seasons WHERE id=? AND status IN ('ACTIVE','PRESEASON'))`,
      )
      .bind(
        id,
        access.session.profileId,
        s.revision,
        started.createdServiceSeasonId,
        s.rulesetVersion,
        s.contentPackVersion,
        now,
        now,
        now,
        ...liveArgs(access.session, now),
        articleId,
        started.createdServiceSeasonId,
      ),
    snapshotStatement(access.d1, snapshot, now, guard, args),
    ...started.commands.map((command) =>
      access.d1
        .prepare(
          `INSERT INTO command_log(career_id,revision,command_id,command_type,payload_json,result_hash,created_at) SELECT ?,?,?,?,?,?,? WHERE ${guard}`,
        )
        .bind(
          id,
          command.revision,
          command.commandId,
          command.commandType,
          JSON.stringify(command.payload),
          command.resultHash,
          command.createdAt,
          ...args,
        ),
    ),
    access.d1
      .prepare(
        `INSERT INTO career_challenge_admissions(key_hash,career_id,request_hash,response_json) SELECT ?,?,?,? WHERE ${guard}`,
      )
      .bind(keyHash, id, requestHash, JSON.stringify(started), ...args),
  ]);
  if (results[0]?.meta.changes !== 1) conflict();
}

export async function startServerAnnualRun(
  access: Access,
  id: string,
  input: { expectedCareerRevision: number; policy?: AnnualPolicy | undefined },
  key: string,
): Promise<AnnualRunResponse> {
  const career = await owned(access, id);
  const keyHash = await sha256Hex(JSON.stringify(['ANNUAL_START', id, key])),
    requestHash = await sha256Hex(JSON.stringify(input));
  const prior = await replay(access, keyHash, requestHash);
  if (prior) return AnnualRunResponseSchema.parse(prior);
  if (career.revision !== input.expectedCareerRevision) conflict();
  if (career.status !== 'ACTIVE') unavailable('활동 중인 커리어만 1년을 진행할 수 있습니다.');
  const [existing] = await access.db
    .select()
    .from(annualRuns)
    .where(eq(annualRuns.careerId, id))
    .orderBy(desc(annualRuns.createdAt))
    .limit(1);
  if (existing && existing.status !== 'COMPLETED')
    conflict('이미 진행 중인 해가 있습니다. 이어서 진행해 주세요.');
  const snapshot = await snapshotFor(access, career),
    now = stamp();
  const checkpoint = startAnnualRun(snapshot, loadRuleset(career.rulesetVersion), {
    serviceSeasonId: career.createdServiceSeasonId,
    ...(input.policy ? { policy: input.policy } : {}),
  });
  const run: Run = {
    id: crypto.randomUUID(),
    careerId: id,
    startRevision: career.revision,
    revision: 0,
    careerRevision: career.revision,
    status: 'RUNNING',
    checkpointJson: JSON.stringify(checkpoint),
    startSnapshotJson: JSON.stringify(snapshot),
    decisionJson: null,
    reportJson: null,
    commandCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  const response = view(run, snapshot, true);
  try {
    const results = await access.d1.batch([
      access.d1
        .prepare(
          `INSERT INTO annual_runs(id,career_id,start_revision,revision,career_revision,status,checkpoint_json,start_snapshot_json,command_count,created_at,updated_at) SELECT ?,?,?,0,?,'RUNNING',?,?,0,?,? FROM careers c WHERE c.id=? AND c.owner_profile_id=? AND c.authority='SERVER_ANNUAL' AND c.status='ACTIVE' AND c.revision=? AND ${liveSession} AND NOT EXISTS(SELECT 1 FROM annual_runs WHERE career_id=? AND status!='COMPLETED')`,
        )
        .bind(
          run.id,
          id,
          career.revision,
          career.revision,
          run.checkpointJson,
          run.startSnapshotJson,
          now,
          now,
          id,
          access.session.profileId,
          career.revision,
          ...liveArgs(access.session, stamp()),
          id,
        ),
      access.d1
        .prepare(
          `INSERT INTO annual_requests(id,career_id,run_id,request_key_hash,request_hash,response_json,created_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM annual_runs WHERE id=?)`,
        )
        .bind(
          crypto.randomUUID(),
          id,
          run.id,
          keyHash,
          requestHash,
          JSON.stringify(response),
          now,
          run.id,
        ),
    ]);
    if (results[0]?.meta.changes !== 1) conflict();
  } catch (error) {
    const saved = await replay(access, keyHash, requestHash);
    if (saved) return AnnualRunResponseSchema.parse(saved);
    throw error;
  }
  return response;
}

/** Requests perform bounded synchronous work; no closed-tab/background completion promise. */
export async function advanceServerAnnualRun(
  access: Access,
  id: string,
  runId: string,
  input: { expectedJobRevision: number; decisionKey?: string; choiceId?: string },
  key: string,
): Promise<AnnualRunResponse> {
  const career = await owned(access, id);
  const keyHash = await sha256Hex(JSON.stringify(['ANNUAL_ACTION', id, runId, key])),
    requestHash = await sha256Hex(JSON.stringify(input));
  const prior = await replay(access, keyHash, requestHash);
  if (prior) return AnnualRunResponseSchema.parse(prior);
  const [run] = await access.db
    .select()
    .from(annualRuns)
    .where(and(eq(annualRuns.id, runId), eq(annualRuns.careerId, id)));
  if (!run)
    throw new AppError({ code: 'CAREER_NOT_FOUND', message: '연간 진행을 찾을 수 없습니다.' });
  if (run.revision !== input.expectedJobRevision || run.careerRevision !== career.revision)
    conflict();
  if (run.status === 'COMPLETED') return view(run, await snapshotFor(access, career), true);
  if (career.status !== 'ACTIVE') unavailable('활동 중인 커리어만 진행할 수 있습니다.');
  let snapshot = await snapshotFor(access, career);
  const ruleset = loadRuleset(career.rulesetVersion),
    pack = loadContentPack(career.contentPackVersion),
    checkpoint = JSON.parse(run.checkpointJson) as AnnualCheckpoint;
  const records: Recorded[] = [];
  const act = () =>
    nextAnnualAction(
      snapshot,
      ruleset,
      checkpoint,
      buildAnnualContentContext(pack, snapshot.state),
    );
  const apply = (command: Command) => {
    if (run.commandCount + records.length >= ANNUAL_MAX_COMMANDS)
      unavailable('이 해의 진행 안전 한도에 도달했습니다. 저장된 진행은 보존됩니다.');
    snapshot = execute(snapshot, command, id);
    records.push({ command, snapshot });
  };
  if (input.decisionKey !== undefined) {
    const action = act();
    if (
      run.status !== 'WAITING_DECISION' ||
      action.status !== 'WAITING_DECISION' ||
      action.decision.key !== input.decisionKey
    )
      conflict('이 선택은 더 이상 유효하지 않습니다.');
    const choice = action.decision.choices.find((entry) => entry.id === input.choiceId);
    if (!choice) unavailable('허용되지 않은 선택입니다.');
    apply(choice.command);
  } else if (run.status === 'WAITING_DECISION') conflict('중요한 선택을 먼저 결정해 주세요.');
  let action = act();
  while (action.status === 'COMMAND' && records.length < ANNUAL_CHUNK_COMMANDS) {
    if (run.commandCount + records.length >= ANNUAL_MAX_COMMANDS)
      unavailable('이 해의 진행 안전 한도에 도달했습니다. 저장된 진행은 보존됩니다.');
    apply(action.command);
    action = act();
  }
  if (action.status === 'ERROR') unavailable(`연간 진행을 확인할 수 없습니다: ${action.code}`);
  const now = stamp(),
    next: Run = {
      ...run,
      revision: run.revision + 1,
      careerRevision: snapshot.revision,
      commandCount: run.commandCount + records.length,
      status:
        action.status === 'COMPLETED'
          ? 'COMPLETED'
          : action.status === 'WAITING_DECISION'
            ? 'WAITING_DECISION'
            : 'RUNNING',
      decisionJson:
        action.status === 'WAITING_DECISION'
          ? JSON.stringify(publicDecision(action.decision, snapshot))
          : null,
      reportJson: action.status === 'COMPLETED' ? JSON.stringify(action.report) : null,
      updatedAt: now,
    };
  const response = view(next, snapshot, true),
    receiptId = crypto.randomUUID();
  const guard = 'EXISTS(SELECT 1 FROM annual_requests WHERE id=?)',
    guardArgs = [receiptId];
  const statements = [
    access.d1
      .prepare(
        `INSERT INTO annual_requests(id,career_id,run_id,from_revision,request_key_hash,request_hash,response_json,created_at) SELECT ?,?,?,?,?,?,?,? FROM careers c INNER JOIN annual_runs j ON j.career_id=c.id WHERE c.id=? AND c.owner_profile_id=? AND c.authority='SERVER_ANNUAL' AND c.status='ACTIVE' AND c.revision=? AND j.id=? AND j.revision=? AND j.career_revision=? AND ${liveSession}`,
      )
      .bind(
        receiptId,
        id,
        runId,
        run.revision,
        keyHash,
        requestHash,
        JSON.stringify(response),
        now,
        id,
        access.session.profileId,
        career.revision,
        runId,
        run.revision,
        career.revision,
        ...liveArgs(access.session, stamp()),
      ),
    access.d1
      .prepare(
        `UPDATE careers SET revision=?,status=?,verification_status='VERIFIED',last_synced_at=?,updated_at=? WHERE id=? AND ${guard}`,
      )
      .bind(snapshot.revision, snapshot.state.status, now, now, id, ...guardArgs),
    access.d1
      .prepare(
        `UPDATE annual_runs SET revision=?,career_revision=?,status=?,decision_json=?,report_json=?,command_count=?,updated_at=? WHERE id=? AND ${guard}`,
      )
      .bind(
        next.revision,
        next.careerRevision,
        next.status,
        next.decisionJson,
        next.reportJson,
        next.commandCount,
        now,
        runId,
        ...guardArgs,
      ),
    ...(records.length
      ? [
          snapshotStatement(access.d1, snapshot, now, guard, guardArgs),
          ...commandStatements(access.d1, records, now, guard, guardArgs),
        ]
      : []),
  ];
  if (snapshot.state.status === 'RETIRED') {
    const wire = wireSnapshot(snapshot, now);
    const body = {
      baseRevision: career.revision,
      createdServiceSeasonId: career.createdServiceSeasonId,
      rulesetVersion: career.rulesetVersion,
      contentPackVersion: career.contentPackVersion,
      snapshot: wire,
      commands: [],
      retirementReferencePopulationId: null,
      retirementLegacyVersion: '1.2.0',
    } as PutCareerBody;
    const archive = buildRetirementRows(id, career.createdServiceSeasonId, body, now);
    statements.push(
      access.d1
        .prepare(
          `INSERT INTO career_archives(career_id,retirement_revision,archive_hash,archive_json,legacy_version,legacy_json,created_at) SELECT ?,?,?,?,?,?,? WHERE ${guard}`,
        )
        .bind(
          archive.careerId,
          archive.retirementRevision,
          archive.archiveHash,
          archive.archiveJson,
          archive.legacyVersion,
          archive.legacyJson,
          now,
          ...guardArgs,
        ),
    );
  }
  try {
    const results = await access.d1.batch(statements);
    if (results[0]?.meta.changes !== 1) conflict();
  } catch (error) {
    const saved = await replay(access, keyHash, requestHash);
    if (saved) return AnnualRunResponseSchema.parse(saved);
    throw error;
  }
  return response;
}
