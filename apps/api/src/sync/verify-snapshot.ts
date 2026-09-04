import { SnapshotStateEnvelopeSchema, getCareerStateInvariantIssues, type PutCareerBody } from '@offside/contracts';
import { sha256Hex } from '../db/hash.js';

const CAREER_STATUSES = ['DRAFT', 'ACTIVE', 'RETIRED', 'ARCHIVED'] as const;
type CareerStatus = (typeof CAREER_STATUSES)[number];

export type VerifyFailureReason =
  | 'STATE_HASH_MISMATCH'
  | 'STATE_INVALID'
  | 'CAREER_ID_MISMATCH'
  | 'RNG_STATE_MISMATCH'
  | 'VERSION_FIELD_MISMATCH'
  | 'RESULT_HASH_MISMATCH'
  | 'STATE_INVARIANT_VIOLATION';

export type VerifySnapshotResult =
  | { ok: true; status: CareerStatus }
  | { ok: false; reason: VerifyFailureReason };

/** 순서·키가 다를 수 있는 JSON 값끼리의 구조적 동등성 비교. */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const aRecord = a as Record<string, unknown>;
    const bRecord = b as Record<string, unknown>;
    const aKeys = Object.keys(aRecord).sort();
    const bKeys = Object.keys(bRecord).sort();
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((key, index) => key === bKeys[index] && deepEqual(aRecord[key], bRecord[key]));
  }
  return false;
}

function isCareerStatus(value: unknown): value is CareerStatus {
  return typeof value === 'string' && (CAREER_STATUSES as readonly string[]).includes(value);
}

/**
 * 설계 결정 5: 서버 측 무결성 검사(리플레이 아님). `packages/domain`의 `simulate`를 호출하지 않는다
 * (ADR-003). WebCrypto `sha256Hex`로 stateHash를 재계산하고, 파싱한 state의 최상위 필드가 요청 본문의
 * 다른 필드와 일치하는지만 본다.
 */
export async function verifyIncomingSnapshot(body: PutCareerBody, careerId: string): Promise<VerifySnapshotResult> {
  const { snapshot, commands } = body;

  const computedHash = await sha256Hex(snapshot.state);
  if (computedHash !== snapshot.stateHash) {
    return { ok: false, reason: 'STATE_HASH_MISMATCH' };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(snapshot.state);
  } catch {
    return { ok: false, reason: 'STATE_INVALID' };
  }

  const envelope = SnapshotStateEnvelopeSchema.safeParse(parsedJson);
  if (!envelope.success) {
    return { ok: false, reason: 'STATE_INVALID' };
  }
  const parsed = envelope.data as Record<string, unknown>;

  if (parsed.careerId !== careerId) {
    return { ok: false, reason: 'CAREER_ID_MISMATCH' };
  }

  if (!deepEqual(parsed.rngState, snapshot.rngState)) {
    return { ok: false, reason: 'RNG_STATE_MISMATCH' };
  }

  if (parsed.rulesetVersion !== body.rulesetVersion || parsed.contentPackVersion !== body.contentPackVersion) {
    return { ok: false, reason: 'VERSION_FIELD_MISMATCH' };
  }

  if (!isCareerStatus(parsed.status)) {
    return { ok: false, reason: 'STATE_INVALID' };
  }

  // SnapshotStateEnvelopeSchema는 미래 additive 필드를 보존하기 위해 느슨하게 두되, 계약·임대·소속
  // 이력 사이의 교차 불변식은 저장 전에 좁은 경계에서 검사한다. domain simulate/replay는 호출하지 않는다.
  if (getCareerStateInvariantIssues(parsed).length > 0) {
    return { ok: false, reason: 'STATE_INVARIANT_VIOLATION' };
  }

  if (commands.length > 0) {
    const lastCommand = commands[commands.length - 1]!;
    if (lastCommand.resultHash !== snapshot.stateHash) {
      return { ok: false, reason: 'RESULT_HASH_MISMATCH' };
    }
  }

  return { ok: true, status: parsed.status };
}
