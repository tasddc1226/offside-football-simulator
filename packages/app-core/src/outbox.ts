// ───────── 플레이 데이터 업로드 아웃박스 (T-9-009) ─────────
// 커리어 요약 + 시즌 이벤트 로그를 서버(D1)에 올리는 네트워킹 코드를 게임 로직에서 분리한 작은
// 모듈이다. `@offside/contracts`는 타입만 가져온다(런타임 zod 값 import 없음 — type-only import는
// 컴파일 시 제거돼 번들 비용이 없다). 웹은 동적 import로만 불러 메인 청크를 무겁게 하지 않는다.
// 실패는 절대 게임 루프로 throw하지 않는다 — 실패해도 게임은 그대로 진행돼야 한다(fire-and-forget).
// T-11-002 웹·앱 공용. 서버 주소·인증(웹 쿠키 / 앱 Bearer)·UI 알림은 configureOutbox로 클라이언트가 넣는다.
import type {
  PutCareerSeasonBody,
  PutRetirementBody,
  RetiredNumberMiss,
  RetiredNumberResult,
} from '@offside/contracts';
import { loadKey, saveKey } from '@offside/game/storage';
import { OUTBOX_KEY, markAchDirty } from './achDirty.js';
import { apiAuth, apiBaseUrl, clearApiCache, fetchWithTimeout, noteSession } from './api/client.js';
import { retiredNumberProgressSynced } from './api/retiredNumberProgress.js';
import { loadOutbox, saveOutbox, persistUpload, type OutboxItem } from './outboxStore.js';
export type { OutboxItem } from './outboxStore.js';

/** T-11-182 못 보낸 항목이 남으면 앱이 켜져 있는 동안 이 간격으로 다시 보낸다(마지막 값에서 멈춘다). */
const RETRY_MS = [30_000, 60_000, 120_000, 300_000] as const;
/** T-11-301 업로드 요청 하나가 응답 없이 매달릴 수 있는 최대 시간(시즌 이벤트 로그는 수십 KB라 API 기본값보다 길다). */
const UPLOAD_TIMEOUT_MS = 20_000;
/** T-11-301 한 회차가 이보다 오래 돌면 매달린 것으로 보고 다음 flush가 새 회차를 연다(앱 복귀 flush가 실제로 다시 보낸다). */
const STALE_RUN_MS = 60_000;

/**
 * T-10-076 영구결번 심사 결과 이벤트. result가 null이면 자격 없음.
 * T-11-029 serviceSeason은 서버가 정한 선수의 시즌(0 = 프리시즌, 휴식기에 올라왔으면 null, 옛 응답엔 없다).
 */
export type RetiredNumberEvent = {
  careerId: string;
  result: RetiredNumberResult | null;
  serviceSeason?: number | null;
  title?: string | null;
  /** T-11-180 결번을 못 받은 이유(기준의 절반 이상일 때만, 옛 응답엔 없다). */
  miss?: RetiredNumberMiss;
};

/** 클라이언트가 넣는 UI 알림(서버 주소·인증은 api/client의 configureApi를 따른다). */
export interface OutboxHost {
  /** T-10-013 다른 계정 소유라 서버가 거절한 항목. */
  onConflict?(items: OutboxItem[]): void;
  /** T-10-076 은퇴 응답의 영구결번 심사 결과. */
  onRetiredNumber?(ev: RetiredNumberEvent): void;
}
let host: OutboxHost = {};
export function configureOutbox(h: OutboxHost): void {
  host = h;
}

/* T-11-182 은퇴 기록이 서버에 올라간 뒤 알릴 곳(구단주 화면이 넣을 수 있는 선수 목록을 다시 받는다). */
const retiredListeners = new Set<() => void>();
/** 한 회차에 은퇴 기록이 하나라도 올라가면 fn을 한 번 부른다(여러 건이어도 다시 받기는 한 번). 해제 함수를 돌려준다. */
export function onRetirementSynced(fn: () => void): () => void {
  retiredListeners.add(fn);
  return () => void retiredListeners.delete(fn);
}

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
    const res = await fetchWithTimeout(`${apiBaseUrl()}/v1/profile`, {
      method: 'GET',
      ...apiAuth(),
    });
    profileReady = res.ok;
    if (res.ok) noteSession(true);
    return res.ok;
  } catch {
    return false;
  }
}

/** T-10-076 은퇴 응답의 영구결번 심사 결과를 UI에 알린다(배포 전 서버 응답엔 필드가 없어 알리지 않는다). */
async function announceRetiredNumber(careerId: string, res: Response): Promise<void> {
  const body = (await res.json().catch(() => null)) as {
    data?: {
      retiredNumber?: RetiredNumberResult | null;
      retiredNumberMiss?: RetiredNumberMiss;
      serviceSeason?: number | null;
      title?: string | null;
    };
  } | null;
  const result = body?.data?.retiredNumber;
  if (result === undefined) return;
  const serviceSeason = body?.data?.serviceSeason;
  host.onRetiredNumber?.({
    careerId,
    result,
    ...(serviceSeason !== undefined ? { serviceSeason } : {}),
    ...(body?.data?.title !== undefined ? { title: body.data.title } : {}),
    ...(body?.data?.retiredNumberMiss ? { miss: body.data.retiredNumberMiss } : {}),
  });
}

/** retry: 이 커리어만 다음 회차로 미룬다(5xx). abort: 이번 회차를 멈춘다(오프라인·세션 만료 — 뒤 항목도 같은 결과다). */
type SendResult = 'ok' | 'retry' | 'abort' | 'drop' | 'conflict';

async function sendItem(item: OutboxItem): Promise<SendResult> {
  try {
    const { headers, ...auth } = apiAuth();
    const body = JSON.stringify(item.body);
    const res = await fetchWithTimeout(
      `${apiBaseUrl()}${pathFor(item)}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(item.kind === 'season' && item.revision
            ? { 'X-Upload-Revision': String(item.revision) }
            : {}),
          ...headers,
        },
        body,
        ...auth,
        // Browsers reject keepalive bodies above 64 KiB. The durable queue survives closure.
        // Three UTF-8 bytes per UTF-16 code unit is a safe upper bound, including surrogate pairs.
        // Avoid requiring TextEncoder in older native JS runtimes.
        keepalive: body.length <= 20_000,
      },
      UPLOAD_TIMEOUT_MS,
    );
    if (res.ok) {
      // 은퇴가 올라가면 명예의 전당 · 내 선수 메모가 낡는다(T-10-015).
      if (item.kind === 'retirement') {
        clearApiCache();
        markAchDirty(); // T-11-034 은퇴로 오른 업적을 다음 화면에서 알린다.
        await announceRetiredNumber(item.careerId, res);
      }
      return 'ok';
    }
    // T-10-013: 다른 계정 소유 커리어. 버리되 UI에 알린다(이 계정으로 이어서 기록할지 고르게).
    if (res.status === 409) {
      const body = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
      if (body?.error?.code === 'CAREER_OWNER_MISMATCH') return 'conflict';
    }
    // 4xx(검증 실패·409 소유권 충돌 포함)는 재시도해도 같은 결과이므로 버린다. 429(업로드 한도)는 시간이 지나면 풀리므로 큐에 남긴다.
    // T-11-182 한도는 한 시간 창이라 짧은 간격으로 다시 보내 봐야 또 막힌다 — 다음 재시도를 가장 긴 간격으로 미룬다.
    if (res.status === 429) retryStep = RETRY_MS.length - 1;
    if (res.status >= 500 || res.status === 429) return 'retry';
    // 세션 만료: 다음 flush에서 프로필을 다시 확인하고 재시도한다(버리지 않는다).
    if (res.status === 401) {
      profileReady = false;
      return 'abort';
    }
    return 'drop';
  } catch {
    // 브라우저가 오프라인이라고 알려 주면 뒤 항목도 같다 — 회차를 멈춘다. 그 밖의 예외(한 항목에서만 나는
    // 오류일 수 있다)와 시간 초과는 그 커리어만 미뤄 다른 커리어의 업로드를 막지 않는다.
    return (globalThis.navigator as { onLine?: boolean } | undefined)?.onLine === false
      ? 'abort'
      : 'retry';
  }
}

let running: Promise<void> | null = null;
let runningSince = 0;
let runId = 0;
let again = false;

/** 큐를 순서대로 전송한다. 네트워크 오류·5xx는 큐에 남겨 다음 flush에서 재시도하고, 4xx는 버리고
 * 경고만 남긴다. 진행 중에 다시 부르면(전송 중 새 항목 enqueue 등) 지금 회차가 끝난 뒤 한 번 더
 * 돌리고, 호출한 쪽은 그 회차까지 끝나기를 기다린다.
 * T-11-301 회차가 STALE_RUN_MS보다 오래 돌고 있으면 매달린 것으로 보고 새 회차를 연다 — 요청마다 시간 상한이
 * 있어도 런타임이 abort를 무시하면 영원히 끝나지 않을 수 있고, 그 약속에 묶이면 앱을 완전히 다시 켤 때까지
 * 시즌·은퇴 기록이 하나도 안 올라갔다. 옛 회차가 나중에 끝나도 새 회차의 상태를 건드리지 않는다. */
export function flushOutbox(): Promise<void> {
  if (running && Date.now() - runningSince < STALE_RUN_MS) {
    again = true;
    return running;
  }
  const id = ++runId;
  runningSince = Date.now();
  const run = (async () => {
    const syncedSeasons = new Set<string>();
    try {
      do {
        again = false;
        await flushOnce(syncedSeasons);
      } while (again && runId === id);
    } finally {
      if (runId === id) running = null;
    }
    for (const careerId of syncedSeasons) retiredNumberProgressSynced(careerId);
    if (runId === id) scheduleRetry();
  })();
  running = run;
  return run;
}

/** T-11-301 사용자가 "다시 올리기"를 눌렀을 때. 기다리던 재시도 타이머를 지우고 바로 한 회차 돈다.
 * 돌고 있는 회차가 있으면 그 회차를 기다리고, 매달린 회차는 flushOutbox가 새로 연다. */
export function retryOutboxNow(): Promise<void> {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  retryStep = 0;
  return flushOutbox();
}

/* T-11-182 다시 보내는 때가 앱 시작·복귀뿐이라, 한도(429)·5xx·끊김으로 남은 은퇴 기록이 다시 켤 때까지
 * 서버에 없어 구단주 화면에서 선수가 안 보였다. 큐가 남으면 간격을 늘려 가며 다시 보내고, 비면 처음 간격으로 돌린다. */
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryStep = 0;
function scheduleRetry(): void {
  if (!loadOutbox().length) {
    retryStep = 0;
    return;
  }
  if (retryTimer) return;
  const base = RETRY_MS[Math.min(retryStep++, RETRY_MS.length - 1)]!;
  const ms = Math.round(base * (1 + Math.random() * 0.2));
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void flushOutbox();
  }, ms);
}

async function flushOnce(syncedSeasons: Set<string>): Promise<void> {
  try {
    const items = loadOutbox();
    if (!items.length) return;
    // Retry the durable write before attempting delivery. A reload must not lose a new item.
    if (!saveOutbox(items)) return;
    const profileOk = await ensureProfile();
    if (!profileOk) return; // 세션 확인 실패 — 큐는 그대로 두고 다음 기회에 다시 시도한다.

    const settled = new Set<string>();
    const conflicts: OutboxItem[] = [];
    let retired = false;
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
      if (result === 'drop') {
        const rejected = loadKey<OutboxItem[]>(`${OUTBOX_KEY}:rejected`) ?? [];
        if (!rejected.some((i) => JSON.stringify(i) === JSON.stringify(item))) rejected.push(item);
        if (!saveKey(`${OUTBOX_KEY}:rejected`, rejected)) continue;
      }
      settled.add(JSON.stringify(item));
      if (result === 'conflict') {
        const conflict = { ...item };
        delete conflict.revision;
        conflicts.push(conflict);
      } else if (result === 'ok' && item.kind === 'retirement') retired = true;
      else if (result === 'ok' && item.kind === 'season') syncedSeasons.add(item.careerId);
      else if (result === 'drop')
        console.warn('[outbox] validation failed; record quarantined', item.kind, item.careerId);
    }
    // T-10-034: 시작할 때 읽은 목록으로 큐를 덮어쓰면 전송 중에 enqueue된 항목이 지워진다 — 지금 큐에서
    // 이번 회차에 끝낸(보냄·버림·충돌) 항목만 뺀다.
    saveOutbox(loadOutbox().filter((i) => !settled.has(JSON.stringify(i))));
    if (conflicts.length) host.onConflict?.(conflicts);
    // 큐에서 뺀 뒤에 알린다 — 받는 쪽이 pendingRetirementIds를 다시 읽어도 이미 빠져 있다.
    if (retired) for (const fn of retiredListeners) fn();
  } catch (err) {
    console.error('[outbox] flush 실패', err);
  }
}

function enqueue(item: OutboxItem): boolean {
  const saved = persistUpload(item);
  void flushOutbox();
  return saved;
}

/** T-10-013. 아직 서버에 못 보낸 은퇴 기록의 커리어 ID(명예의 전당 '내 선수'가 계정 목록에 잠깐 더한다). */
export function pendingRetirementIds(): Set<string> {
  return new Set(loadOutbox().flatMap((i) => (i.kind === 'retirement' ? [i.careerId] : [])));
}

export function enqueueSeason(careerId: string, year: number, body: PutCareerSeasonBody): boolean {
  return enqueue({ kind: 'season', careerId, year, body });
}

export function enqueueRetirement(careerId: string, body: PutRetirementBody): boolean {
  return enqueue({ kind: 'retirement', careerId, body });
}
