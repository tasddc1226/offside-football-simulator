// ───────── 플레이 데이터 업로드 아웃박스 (T-9-009) ─────────
// 커리어 요약 + 시즌 이벤트 로그를 서버(D1)에 올리는 네트워킹 코드를 게임 로직에서 분리한 작은
// 모듈이다. `@offside/contracts`는 타입만 가져온다(런타임 zod 값 import 없음 — type-only import는
// 컴파일 시 제거돼 번들 비용이 없다). 웹은 동적 import로만 불러 메인 청크를 무겁게 하지 않는다.
// 실패는 절대 게임 루프로 throw하지 않는다 — 실패해도 게임은 그대로 진행돼야 한다(fire-and-forget).
// T-11-002 웹·앱 공용. 서버 주소·인증(웹 쿠키 / 앱 Bearer)·UI 알림은 configureOutbox로 클라이언트가 넣는다.
import type {
  PutCareerSeasonBody,
  PutRetirementBody,
  RetiredNumberResult,
} from '@offside/contracts';
import { loadKey, saveKey } from '@offside/game/season';

const OUTBOX_KEY = 'ft_outbox';
const OUTBOX_CAP = 100;

/** T-10-076 영구결번 심사 결과 이벤트. result가 null이면 자격 없음. */
export type RetiredNumberEvent = { careerId: string; result: RetiredNumberResult | null };

export type OutboxItem =
  | { kind: 'season'; careerId: string; year: number; body: PutCareerSeasonBody }
  | { kind: 'retirement'; careerId: string; body: PutRetirementBody };

/** 클라이언트가 넣는 전송 설정과 UI 알림. */
export interface OutboxHost {
  baseUrl(): string;
  /** 요청마다 붙일 인증 — 웹은 `{ credentials: 'include' }`(세션 쿠키), 앱은 Authorization 헤더. */
  auth(): { credentials?: 'include' | 'omit' | 'same-origin'; headers?: Record<string, string> };
  /** 세션이 확인됐다(웹: 로그인 힌트를 남긴다). */
  onSession?(): void;
  /** 은퇴가 올라갔다 — 명예의 전당·내 선수 캐시가 낡는다(T-10-015). */
  onRetirementSent?(): void;
  /** T-10-013 다른 계정 소유라 서버가 거절한 항목. */
  onConflict?(items: OutboxItem[]): void;
  /** T-10-076 은퇴 응답의 영구결번 심사 결과. */
  onRetiredNumber?(ev: RetiredNumberEvent): void;
}
let host: OutboxHost = {
  baseUrl: () => 'http://localhost:8787',
  auth: () => ({ credentials: 'include' }),
};
export function configureOutbox(h: OutboxHost): void {
  host = h;
}

const loadOutbox = (): OutboxItem[] => loadKey<OutboxItem[]>(OUTBOX_KEY) ?? [];
/* 저장 실패(쿼터 등)는 무시한다 — 다음 enqueue에서 다시 시도된다. */
const saveOutbox = (items: OutboxItem[]): void => void saveKey(OUTBOX_KEY, items);

function pathFor(item: OutboxItem): string {
  return item.kind === 'season'
    ? `/v1/careers/${item.careerId}/seasons/${item.year}`
    : `/v1/careers/${item.careerId}/retirement`;
}

/** GET /v1/profile을 먼저 호출해 세션·익명 프로필이 있는지 확인한다(account.ts와 같은 흐름 — 실패해도
 * throw하지 않는다). 쿠키가 없으면 이 호출이 새로 발급한다. */
let profileReady = false;

async function ensureProfile(): Promise<boolean> {
  // 페이지당 한 번만 확인한다 — 세션이 한번 확인되면 이후 flush는 추가 GET 없이 보낸다.
  if (profileReady) return true;
  try {
    const res = await fetch(`${host.baseUrl()}/v1/profile`, { method: 'GET', ...host.auth() });
    profileReady = res.ok;
    if (res.ok) host.onSession?.();
    return res.ok;
  } catch {
    return false;
  }
}

/** T-10-076 은퇴 응답의 영구결번 심사 결과를 UI에 알린다(배포 전 서버 응답엔 필드가 없어 알리지 않는다). */
async function announceRetiredNumber(careerId: string, res: Response): Promise<void> {
  const body = (await res.json().catch(() => null)) as {
    data?: { retiredNumber?: RetiredNumberResult | null };
  } | null;
  const result = body?.data?.retiredNumber;
  if (result === undefined) return;
  host.onRetiredNumber?.({ careerId, result });
}

/** retry: 이 커리어만 다음 회차로 미룬다(5xx). abort: 이번 회차를 멈춘다(오프라인·세션 만료 — 뒤 항목도 같은 결과다). */
type SendResult = 'ok' | 'retry' | 'abort' | 'drop' | 'conflict';

async function sendItem(item: OutboxItem): Promise<SendResult> {
  try {
    const { headers, ...auth } = host.auth();
    const res = await fetch(`${host.baseUrl()}${pathFor(item)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(item.body),
      ...auth,
      keepalive: true,
    });
    if (res.ok) {
      // 은퇴가 올라가면 명예의 전당 · 내 선수 메모가 낡는다(T-10-015).
      if (item.kind === 'retirement') {
        host.onRetirementSent?.();
        await announceRetiredNumber(item.careerId, res);
      }
      return 'ok';
    }
    // T-10-013: 다른 계정 소유 커리어. 버리되 UI에 알린다(이 계정으로 이어서 기록할지 고르게).
    if (res.status === 409) {
      const body = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
      if (body?.error?.code === 'CAREER_OWNER_MISMATCH') return 'conflict';
    }
    // 4xx(검증 실패·409 소유권 충돌 포함)는 재시도해도 같은 결과이므로 버린다.
    if (res.status >= 500) return 'retry';
    // 세션 만료: 다음 flush에서 프로필을 다시 확인하고 재시도한다(버리지 않는다).
    if (res.status === 401) {
      profileReady = false;
      return 'abort';
    }
    return 'drop';
  } catch {
    // 브라우저가 오프라인이라고 알려 주면 뒤 항목도 같다 — 회차를 멈춘다. 그 밖의 예외(한 항목에서만 나는
    // 오류일 수 있다)는 그 커리어만 미뤄 다른 커리어의 업로드를 막지 않는다.
    return (globalThis.navigator as { onLine?: boolean } | undefined)?.onLine === false
      ? 'abort'
      : 'retry';
  }
}

let running: Promise<void> | null = null;
let again = false;

/** 큐를 순서대로 전송한다. 네트워크 오류·5xx는 큐에 남겨 다음 flush에서 재시도하고, 4xx는 버리고
 * 경고만 남긴다. 진행 중에 다시 부르면(전송 중 새 항목 enqueue 등) 지금 회차가 끝난 뒤 한 번 더
 * 돌리고, 호출한 쪽은 그 회차까지 끝나기를 기다린다. */
export function flushOutbox(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        again = false;
        await flushOnce();
      } while (again);
    } finally {
      running = null;
    }
  })();
  return running;
}

async function flushOnce(): Promise<void> {
  try {
    const items = loadOutbox();
    if (!items.length) return;
    const profileOk = await ensureProfile();
    if (!profileOk) return; // 세션 확인 실패 — 큐는 그대로 두고 다음 기회에 다시 시도한다.

    const settled = new Set<string>();
    const conflicts: OutboxItem[] = [];
    // T-10-045: 한 커리어의 항목은 순서대로만 보낸다. 첫 시즌 PUT이 재시도 대상인데 은퇴를 이어서 보내면
    // 서버에 커리어가 아직 없어 400(CAREER_NOT_FOUND)으로 버려진다 — 그 커리어의 뒤 항목은 다음 회차로 미룬다.
    const blocked = new Set<string>();
    for (const item of items) {
      if (blocked.has(item.careerId)) continue;
      const result = await sendItem(item);
      if (result === 'abort') break;
      if (result === 'retry') {
        blocked.add(item.careerId);
        continue;
      }
      settled.add(JSON.stringify(item));
      if (result === 'conflict') conflicts.push(item);
      else if (result === 'drop')
        console.warn('[outbox] 4xx 응답으로 항목을 버립니다', item.kind, item.careerId);
    }
    // T-10-034: 시작할 때 읽은 목록으로 큐를 덮어쓰면 전송 중에 enqueue된 항목이 지워진다 — 지금 큐에서
    // 이번 회차에 끝낸(보냄·버림·충돌) 항목만 뺀다.
    saveOutbox(loadOutbox().filter((i) => !settled.has(JSON.stringify(i))));
    if (conflicts.length) host.onConflict?.(conflicts);
  } catch (err) {
    console.error('[outbox] flush 실패', err);
  }
}

function enqueue(item: OutboxItem): void {
  try {
    const items = loadOutbox();
    items.push(item);
    while (items.length > OUTBOX_CAP) items.shift();
    saveOutbox(items);
  } catch (err) {
    console.error('[outbox] enqueue 실패', err);
    return;
  }
  void flushOutbox();
}

/** T-10-013. 아직 서버에 못 보낸 은퇴 기록의 커리어 ID(명예의 전당 '내 선수'가 계정 목록에 잠깐 더한다). */
export function pendingRetirementIds(): Set<string> {
  return new Set(loadOutbox().flatMap((i) => (i.kind === 'retirement' ? [i.careerId] : [])));
}

export function enqueueSeason(careerId: string, year: number, body: PutCareerSeasonBody): void {
  enqueue({ kind: 'season', careerId, year, body });
}

export function enqueueRetirement(careerId: string, body: PutRetirementBody): void {
  enqueue({ kind: 'retirement', careerId, body });
}
