// ───────── 플레이 데이터 업로드 아웃박스 (T-9-009) ─────────
// 커리어 요약 + 시즌 이벤트 로그를 서버(D1)에 올리는 네트워킹 코드를 게임 로직에서 분리한 작은
// 모듈이다. `@offside/contracts`는 타입만 가져온다(런타임 zod 값 import 없음 — type-only import는
// 컴파일 시 제거돼 번들 비용이 없다). ui.ts에서 동적 import로만 불러 메인 청크를 무겁게 하지 않는다.
// 실패는 절대 게임 루프로 throw하지 않는다 — 실패해도 게임은 그대로 진행돼야 한다(fire-and-forget).
import type { PutCareerSeasonBody, PutRetirementBody } from '@offside/contracts';
import { resolveApiBaseUrl } from '../api/base-url.js';

const OUTBOX_KEY = 'ft_outbox';
const OUTBOX_CAP = 100;

export type OutboxItem =
  | { kind: 'season'; careerId: string; year: number; body: PutCareerSeasonBody }
  | { kind: 'retirement'; careerId: string; body: PutRetirementBody };

function apiBaseUrl(): string {
  return resolveApiBaseUrl(
    import.meta.env.VITE_API_BASE_URL as string | undefined,
    typeof window === 'undefined' ? undefined : window.location.hostname,
  );
}

function loadOutbox(): OutboxItem[] {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    return raw ? (JSON.parse(raw) as OutboxItem[]) : [];
  } catch {
    return [];
  }
}

function saveOutbox(items: OutboxItem[]): void {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
  } catch {
    /* 저장 실패(쿼터 등)는 무시한다 — 다음 enqueue에서 다시 시도된다. */
  }
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
    const res = await fetch(`${apiBaseUrl()}/v1/profile`, { method: 'GET', credentials: 'include' });
    profileReady = res.ok;
    return res.ok;
  } catch {
    return false;
  }
}

type SendResult = 'ok' | 'retry' | 'drop';

async function sendItem(item: OutboxItem): Promise<SendResult> {
  try {
    const res = await fetch(`${apiBaseUrl()}${pathFor(item)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item.body),
      credentials: 'include',
      keepalive: true,
    });
    if (res.ok) return 'ok';
    // 4xx(검증 실패·409 소유권 충돌 포함)는 재시도해도 같은 결과이므로 버린다.
    if (res.status >= 500) return 'retry';
    // 세션 만료: 다음 flush에서 프로필을 다시 확인하고 재시도한다(버리지 않는다).
    if (res.status === 401) {
      profileReady = false;
      return 'retry';
    }
    return 'drop';
  } catch {
    return 'retry';
  }
}

let flushing = false;

/** 큐를 순서대로 전송한다. 네트워크 오류·5xx는 큐에 남겨 다음 flush에서 재시도하고, 4xx는 버리고
 * 경고만 남긴다. 동시 호출은 무시한다(이미 진행 중이면 조용히 리턴). */
export async function flushOutbox(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    const items = loadOutbox();
    if (!items.length) return;
    const profileOk = await ensureProfile();
    if (!profileOk) return; // 세션 확인 실패 — 큐는 그대로 두고 다음 기회에 다시 시도한다.

    const remaining: OutboxItem[] = [];
    for (const item of items) {
      const result = await sendItem(item);
      if (result === 'ok') continue;
      if (result === 'retry') {
        remaining.push(item);
        continue;
      }
      console.warn('[outbox] 4xx 응답으로 항목을 버립니다', item.kind, item.careerId);
    }
    saveOutbox(remaining);
  } catch (err) {
    console.error('[outbox] flush 실패', err);
  } finally {
    flushing = false;
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

export function enqueueSeason(careerId: string, year: number, body: PutCareerSeasonBody): void {
  enqueue({ kind: 'season', careerId, year, body });
}

export function enqueueRetirement(careerId: string, body: PutRetirementBody): void {
  enqueue({ kind: 'retirement', careerId, body });
}
