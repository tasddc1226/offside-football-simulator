// ───────── 클럽 커스텀 저장·반응형 상태 (T-10-009) ─────────
// 이 기기의 localStorage(ft_clubs)에만 남는다 — 서버·다른 기기와 공유하지 않는다. 가져오기/내보내기
// JSON으로 다른 기기나 다른 유저에게 옮길 수 있다(에디트 파일처럼).
import { loadKey, saveKey } from '../game/season.js';
import { CLUBS } from '../game/data.js';
import { applyClubNames, sanitizeClubCustom, type ClubCustom, type ClubCustomMap } from '../game/clubs.js';
import { appState } from './state.svelte.js';
import { save } from './helpers.js';

const KEY = 'ft_clubs';

export const clubCustom = $state<{ map: ClubCustomMap }>({ map: {} });

/** 부팅 때 한 번 — 저장된 이름을 CLUBS에 반영한다(loadGame이 현재 소속 이름을 CLUBS에서 다시 읽기 전에). */
export function loadClubCustom(): void {
  clubCustom.map = sanitizeClubCustom(loadKey<unknown>(KEY));
  applyClubNames(clubCustom.map);
}

function commit(map: ClubCustomMap): boolean {
  const clean = sanitizeClubCustom(map);
  if (!saveKey(KEY, clean)) return false;
  clubCustom.map = clean;
  applyClubNames(clean);
  // 진행 중인 커리어의 현재 소속은 복사본이라 따로 맞춘다(과거 기록 문구는 그대로 둔다).
  const G = appState.G;
  const c = G && CLUBS.find((x) => x.id === G.club.id);
  if (G && c && G.club.name !== c.name) {
    G.club.name = c.name;
    save();
  }
  return true;
}

export function setClubCustom(id: string, patch: ClubCustom): boolean {
  const next: ClubCustom = { ...clubCustom.map[id], ...patch };
  return commit({ ...clubCustom.map, [id]: next });
}
export function resetClubCustom(ids?: string[]): boolean {
  if (!ids) return commit({});
  const next = { ...clubCustom.map };
  for (const id of ids) delete next[id];
  return commit(next);
}

export const exportClubCustom = (): string => JSON.stringify({ v: 1, clubs: clubCustom.map }, null, 1);
/** 가져온 파일로 통째로 바꾼다. 적용된 클럽 수를 돌려준다(형식이 틀리면 -1). */
export function importClubCustom(text: string): number {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return -1;
  }
  const clubs = raw && typeof raw === 'object' && 'clubs' in raw ? (raw as { clubs: unknown }).clubs : raw;
  const map = sanitizeClubCustom(clubs);
  return commit(map) ? Object.keys(map).length : -1;
}
