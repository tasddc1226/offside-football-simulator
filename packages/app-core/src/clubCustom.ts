// ───────── 클럽 커스텀 저장·동기화 (웹·앱 공용, T-10-009 · 동기화 T-10-010 · 공용 T-11-005) ─────────
// 정본은 이 기기의 저장소(ft_clubs)이고, 프로필 세션이 있으면 서버(/v1/club-custom)와 최신 쓰기
// 우선으로 맞춘다 — 같은 계정으로 로그인한 기기끼리 같은 설정을 쓴다. 세션이 없거나 오프라인이면
// 로컬에만 남고(게임은 그대로), 다음 부팅·다음 변경 때 다시 맞춘다. 에디트 파일(JSON)로도 옮길 수 있다.
// 반응성은 클라이언트가 붙인다 — 넘겨받은 state 객체를 그대로 고친다(웹 $state, 앱 valtio).
import { loadKey, saveKey } from '@offside/game/season';
import { CLUBS } from '@offside/game/data';
import {
  applyClubNames,
  sanitizeClubCustom,
  type ClubCustom,
  type ClubCustomMap,
} from '@offside/game/clubs';
import type { GameState } from '@offside/game/types';
import { CLUB_CUSTOM_IMG_TOTAL_MAX, clubImgTotal } from '@offside/contracts/club-limits';
import { apiFetch } from './api/client.js';

const KEY = 'ft_clubs';
const PUSH_DELAY_MS = 1500;

/** local: 세션 없음(이 기기에만 저장) · syncing: 맞추는 중 · synced: 계정과 같음 · error: 네트워크/서버 오류 ·
 * full: 이미지 합계가 서버 한도를 넘어 보내지 않음(이 기기에는 남는다). */
export type ClubSyncStatus = 'local' | 'syncing' | 'synced' | 'error' | 'full';
/** 설정 화면이 상태마다 보여 주는 안내(웹·앱 공용). */
export const CLUB_SYNC_TEXT: Record<ClubSyncStatus, string> = {
  local: '이 기기에만 저장돼요. 구글 계정으로 로그인하면 다른 기기와 동기화돼요.',
  syncing: '계정과 동기화하는 중…',
  synced: '계정에 저장됐어요. 같은 계정으로 로그인한 기기에서도 쓰여요.',
  error: '동기화하지 못했어요. 이 기기에는 저장됐고, 다음에 다시 시도해요.',
  full: '엠블럼 이미지가 너무 많아 계정과 동기화하지 못해요. 이 기기에는 저장됐어요. 이미지를 몇 개 지우면 다시 동기화돼요.',
};
export interface ClubCustomState {
  map: ClubCustomMap;
  status: ClubSyncStatus;
}
export const initialClubCustomState = (): ClubCustomState => ({ map: {}, status: 'local' });

// 저장 형식: { clubs, updatedAt, dirty }. T-10-009 첫 형식(클럽 맵 그대로)도 읽는다.
interface Stored {
  clubs: ClubCustomMap;
  /** 이 기기에서 마지막으로 바꾼 시각(또는 서버에서 받아 온 값의 시각). 서버와 비교 기준이다. */
  updatedAt: string | null;
  /** 서버에 아직 못 보낸 로컬 변경이 있다. */
  dirty: boolean;
}

function readStored(): Stored {
  const raw = loadKey<unknown>(KEY);
  if (raw && typeof raw === 'object' && 'clubs' in raw) {
    const o = raw as Partial<Stored>;
    return {
      clubs: sanitizeClubCustom(o.clubs),
      updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : null,
      dirty: !!o.dirty,
    };
  }
  const clubs = sanitizeClubCustom(raw);
  return { clubs, updatedAt: null, dirty: Object.keys(clubs).length > 0 };
}

/** game(): 진행 중 커리어(현재 소속 이름을 맞춘다) · save(): 그 커리어를 저장. */
export function createClubCustom(
  clubCustom: ClubCustomState,
  host: { game(): GameState | null; save(): void },
) {
  let meta: Omit<Stored, 'clubs'> = { updatedAt: null, dirty: false };

  /** 부팅 때 한 번 — 저장된 이름을 CLUBS에 반영한다(loadGame이 현재 소속 이름을 CLUBS에서 다시 읽기 전에). */
  function loadClubCustom(): void {
    const s = readStored();
    meta = { updatedAt: s.updatedAt, dirty: s.dirty };
    clubCustom.map = s.clubs;
    applyClubNames(s.clubs);
  }

  function commit(map: ClubCustomMap, next: Omit<Stored, 'clubs'>): boolean {
    const clean = sanitizeClubCustom(map);
    if (!saveKey(KEY, { clubs: clean, ...next })) return false;
    meta = next;
    clubCustom.map = clean;
    applyClubNames(clean);
    // 진행 중인 커리어의 현재 소속은 복사본이라 따로 맞춘다(과거 기록 문구는 그대로 둔다).
    const G = host.game();
    const c = G && CLUBS.find((x) => x.id === G.club.id);
    if (G && c && G.club.name !== c.name) {
      G.club.name = c.name;
      host.save();
    }
    return true;
  }

  /** 유저 변경 — 로컬에 바로 남기고 잠시 뒤 서버로 보낸다. */
  function commitLocal(map: ClubCustomMap): boolean {
    if (!commit(map, { updatedAt: new Date().toISOString(), dirty: true })) return false;
    schedulePush();
    return true;
  }

  function setClubCustom(id: string, patch: ClubCustom): boolean {
    return commitLocal({ ...clubCustom.map, [id]: { ...clubCustom.map[id], ...patch } });
  }
  function resetClubCustom(ids?: string[]): boolean {
    if (!ids) return commitLocal({});
    const next = { ...clubCustom.map };
    for (const id of ids) delete next[id];
    return commitLocal(next);
  }

  const exportClubCustom = (): string => JSON.stringify({ v: 1, clubs: clubCustom.map }, null, 1);
  /** 가져온 파일로 통째로 바꾼다. 적용된 클럽 수를 돌려준다(형식이 틀리면 -1). */
  function importClubCustom(text: string): number {
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return -1;
    }
    const clubs =
      raw && typeof raw === 'object' && 'clubs' in raw ? (raw as { clubs: unknown }).clubs : raw;
    const map = sanitizeClubCustom(clubs);
    return commitLocal(map) ? Object.keys(map).length : -1;
  }

  // ───────── 서버 동기화 ─────────
  type Remote = { clubs: ClubCustomMap; updatedAt: string | null };
  let pushTimer: ReturnType<typeof setTimeout> | null = null;

  function schedulePush() {
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => void push(), PUSH_DELAY_MS);
  }

  /** 서버가 돌려준 값이 로컬보다 새로우면(다른 기기의 변경) 그걸로 바꾼다. */
  function adopt(remote: Remote) {
    if (remote.updatedAt && remote.updatedAt !== meta.updatedAt)
      commit(remote.clubs, { updatedAt: remote.updatedAt, dirty: false });
  }
  function fail(code: string) {
    clubCustom.status = code === 'PROFILE_REQUIRED' ? 'local' : 'error';
  }

  async function push(): Promise<void> {
    pushTimer = null;
    if (!meta.dirty || !meta.updatedAt) return;
    // 서버가 받지 못하는 크기면 보내지 않는다(dirty는 남겨, 이미지를 지우면 다음 변경 때 다시 보낸다).
    if (clubImgTotal(clubCustom.map) > CLUB_CUSTOM_IMG_TOTAL_MAX) {
      clubCustom.status = 'full';
      return;
    }
    const sent = meta.updatedAt;
    clubCustom.status = 'syncing';
    const r = await apiFetch<Remote>('/v1/club-custom', {
      method: 'PUT',
      body: JSON.stringify({ clubs: clubCustom.map, updatedAt: sent }),
    });
    if (!r.ok) return fail(r.error.code);
    // 보내는 사이 또 바뀌었으면 dirty를 남겨 다음 push가 보낸다.
    if (meta.updatedAt === sent) commit(clubCustom.map, { updatedAt: sent, dirty: false });
    adopt(r.data);
    clubCustom.status = 'synced';
  }

  /** 부팅 때(로그인 복귀 포함) 한 번. 세션이 없으면 조용히 로컬 모드로 둔다(프로필을 새로 만들지 않는다). */
  async function syncClubCustom(): Promise<void> {
    clubCustom.status = 'syncing';
    const r = await apiFetch<Remote>('/v1/club-custom', { method: 'GET' });
    if (!r.ok) return fail(r.error.code);
    const remote = r.data;
    const localNewer =
      meta.dirty && meta.updatedAt && (!remote.updatedAt || meta.updatedAt >= remote.updatedAt);
    if (localNewer) return push();
    adopt(remote);
    if (!remote.updatedAt && meta.dirty) return push();
    clubCustom.status = 'synced';
  }

  return {
    loadClubCustom,
    setClubCustom,
    resetClubCustom,
    exportClubCustom,
    importClubCustom,
    syncClubCustom,
  };
}
