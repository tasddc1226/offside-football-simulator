import { SnapshotStateEnvelopeSchema, getCareerStateInvariantIssues, type CareerSnapshot } from '@offside/contracts';
import {
  assertLeagueLedgerInvariant,
  canonicalize,
  hashState,
  verifySnapshot,
  type CareerState,
  type DomainSnapshot,
  type JsonValue,
} from '@offside/domain';

export function encodeSnapshot(domain: DomainSnapshot, meta: { careerId: string; createdAt: string }): CareerSnapshot {
  const rngState = domain.state.rngState;
  return {
    id: `${meta.careerId}:${domain.revision}`,
    careerId: meta.careerId,
    revision: domain.revision,
    checkpoint: domain.checkpoint,
    state: canonicalize(domain.state as unknown as JsonValue),
    stateHash: domain.stateHash,
    rulesetVersion: domain.rulesetVersion,
    contentPackVersion: domain.contentPackVersion,
    rngState: { s: [...rngState.s] as [number, number, number, number], draws: rngState.draws },
    createdAt: meta.createdAt,
  };
}

export type DecodeFailure =
  | 'PARSE_FAILED'
  | 'INVALID_STATE'
  | 'STATE_HASH_MISMATCH'
  | 'RNG_STATE_MISMATCH'
  | 'REVISION_MISMATCH'
  | 'VERSION_MISMATCH'
  | 'CAREER_ID_MISMATCH';

export type DecodeResult = { ok: true; snapshot: DomainSnapshot } | { ok: false; reason: DecodeFailure };

type RngStateShape = { s: readonly [number, number, number, number]; draws: number };

function isRngStateShape(value: unknown): value is RngStateShape {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { s?: unknown; draws?: unknown };
  return (
    Array.isArray(candidate.s) &&
    candidate.s.length === 4 &&
    candidate.s.every((n) => typeof n === 'number') &&
    typeof candidate.draws === 'number'
  );
}

function rngStatesEqual(a: RngStateShape, b: RngStateShape): boolean {
  return a.draws === b.draws && a.s[0] === b.s[0] && a.s[1] === b.s[1] && a.s[2] === b.s[2] && a.s[3] === b.s[3];
}

/**
 * 순서: `id`가 `careerId:revision` 형태인지 → JSON.parse → 최상위 형태(schemaVersion 1,
 * careerId 문자열, revision 없음) → hashState(state) === stateHash → state.careerId ===
 * snapshot.careerId → 버전 2종 일치 → rngState 깊은 동일 → verifySnapshot(domain) ok.
 * 손상된 입력에 대해 throw하지 않고 항상 `DecodeResult`를 돌려준다.
 */
export function decodeSnapshot(snapshot: CareerSnapshot): DecodeResult {
  if (snapshot.id !== `${snapshot.careerId}:${snapshot.revision}`) {
    return { ok: false, reason: 'REVISION_MISMATCH' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(snapshot.state);
  } catch {
    return { ok: false, reason: 'PARSE_FAILED' };
  }

  const envelope = SnapshotStateEnvelopeSchema.safeParse(parsed);
  if (!envelope.success) {
    return { ok: false, reason: 'INVALID_STATE' };
  }

  const state = parsed as CareerState;
  if (getCareerStateInvariantIssues(parsed).length > 0) {
    return { ok: false, reason: 'INVALID_STATE' };
  }
  if (
    (state.rulesetVersion === '1.7.0' || state.rulesetVersion === '1.7.1') &&
    state.season?.leagueLedger !== undefined
  ) {
    try {
      // 저장된 roster snapshot만으로 복원되는 canonical fixture ordinal·whole-round 형태는
      // ruleset registry가 없는 decode/import 경계에서도 검증할 수 있다.
      assertLeagueLedgerInvariant(state.season.leagueLedger);
    } catch {
      return { ok: false, reason: 'INVALID_STATE' };
    }
  }

  let computedHash: string;
  try {
    computedHash = hashState(state);
  } catch {
    return { ok: false, reason: 'INVALID_STATE' };
  }
  if (computedHash !== snapshot.stateHash) {
    return { ok: false, reason: 'STATE_HASH_MISMATCH' };
  }

  if (state.careerId !== snapshot.careerId) {
    return { ok: false, reason: 'CAREER_ID_MISMATCH' };
  }

  if (state.rulesetVersion !== snapshot.rulesetVersion || state.contentPackVersion !== snapshot.contentPackVersion) {
    return { ok: false, reason: 'VERSION_MISMATCH' };
  }

  const stateRngState: unknown = state.rngState;
  if (!isRngStateShape(stateRngState) || !rngStatesEqual(stateRngState, snapshot.rngState)) {
    return { ok: false, reason: 'RNG_STATE_MISMATCH' };
  }

  const domainSnapshot: DomainSnapshot = {
    revision: snapshot.revision,
    checkpoint: snapshot.checkpoint,
    state,
    stateHash: snapshot.stateHash,
    rulesetVersion: snapshot.rulesetVersion,
    contentPackVersion: snapshot.contentPackVersion,
  };

  const verification = verifySnapshot(domainSnapshot);
  if (!verification.ok) {
    if (verification.reason === 'STATE_HASH_MISMATCH') return { ok: false, reason: 'STATE_HASH_MISMATCH' };
    if (verification.reason === 'VERSION_MISMATCH') return { ok: false, reason: 'VERSION_MISMATCH' };
    return { ok: false, reason: 'INVALID_STATE' };
  }

  return { ok: true, snapshot: domainSnapshot };
}
