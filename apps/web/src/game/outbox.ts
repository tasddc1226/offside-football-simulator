// ───────── 플레이 데이터 업로드 아웃박스 (T-9-009) ─────────
// 커리어 요약 + 시즌 이벤트 로그를 서버(D1)에 올리는 네트워킹 코드를 게임 로직에서 분리한 작은
// 모듈이다. `@offside/contracts`는 타입만 가져온다(런타임 zod 값 import 없음 — type-only import는
// 컴파일 시 제거돼 번들 비용이 없다). ui.ts에서 동적 import로만 불러 메인 청크를 무겁게 하지 않는다.
// 실패는 절대 게임 루프로 throw하지 않는다 — 실패해도 게임은 그대로 진행돼야 한다(fire-and-forget).
import type { CareerSeasonPayload, PutCareerSeasonBody, PutRetirementBody } from '@offside/contracts';
import { resolveApiBaseUrl } from '../api/base-url.js';
import { clearApiCache, noteSession } from '../api/client.js';
import type { CareerRecord } from './types.js';
import { OWNER_CONFLICT_EVENT } from './syncEvents.js';

const OUTBOX_KEY = 'ft_outbox';
const OUTBOX_CAP = 100;

export type OutboxItem =
  | { kind: 'season'; careerId: string; year: number; body: PutCareerSeasonBody }
  | { kind: 'retirement'; careerId: string; body: PutRetirementBody };

/** 시즌 한 줄(`CareerRecord`) → 업로드 페이로드. T-10-006부터 시즌 상세(무실점·리그 기록·A매치·
 * 대회별·커리어 하이)도 함께 보낸다. 대회 기록은 진행 상태 필드(alive/pts/played 등)를 뺀다. */
export function seasonPayload(rec: CareerRecord): CareerSeasonPayload {
  return {
    age: rec.age,
    club: rec.club,
    league: rec.league,
    apps: rec.apps,
    goals: rec.goals,
    assists: rec.assists,
    rating: rec.rating,
    rank: rec.rank,
    ovr: rec.ovr,
    honors: rec.honors,
    mil: !!rec.mil,
    cs: rec.cs,
    lgApps: rec.lgApps ?? rec.apps,
    lgGoals: rec.lgGoals ?? rec.goals,
    caps: rec.caps ?? 0,
    comps: (rec.comps ?? []).map((c) => ({ type: c.type, name: c.name, stage: c.stage, apps: c.apps, g: c.g, a: c.a })),
    ch: rec.ch ?? [],
  };
}

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
    if (res.ok) noteSession(true);
    return res.ok;
  } catch {
    return false;
  }
}

type SendResult = 'ok' | 'retry' | 'drop' | 'conflict';

async function sendItem(item: OutboxItem): Promise<SendResult> {
  try {
    const res = await fetch(`${apiBaseUrl()}${pathFor(item)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item.body),
      credentials: 'include',
      keepalive: true,
    });
    if (res.ok) {
      // 은퇴가 올라가면 명예의 전당 · 내 선수 메모가 낡는다(T-10-015).
      if (item.kind === 'retirement') clearApiCache();
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
      return 'retry';
    }
    return 'drop';
  } catch {
    return 'retry';
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
      if (result === 'retry') {
        blocked.add(item.careerId);
        continue;
      }
      settled.add(JSON.stringify(item));
      if (result === 'conflict') conflicts.push(item);
      else if (result === 'drop') console.warn('[outbox] 4xx 응답으로 항목을 버립니다', item.kind, item.careerId);
    }
    // T-10-034: 시작할 때 읽은 목록으로 큐를 덮어쓰면 전송 중에 enqueue된 항목이 지워진다 — 지금 큐에서
    // 이번 회차에 끝낸(보냄·버림·충돌) 항목만 뺀다.
    saveOutbox(loadOutbox().filter((i) => !settled.has(JSON.stringify(i))));
    if (conflicts.length) globalThis.dispatchEvent?.(new CustomEvent(OWNER_CONFLICT_EVENT, { detail: conflicts }));
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
