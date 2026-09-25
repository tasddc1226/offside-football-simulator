// 확률 도감(T-10-012) 발견 기록. 커리어를 바꿔도 남도록 기기에 따로 저장한다(ft_dex, 이벤트 id 목록).
// 스토리·특별 이벤트는 여기 기록돼야 도감에서 열린다.
import { EVENTS } from '../game/events-data.js';
import { loadKey, saveKey } from '../game/season.js';
import { appState } from './state.svelte.js';

const KEY = 'ft_dex';
let seen: Set<string> | null = null;

/** 처음 쓸 때 진행 중인 커리어에서 이미 겪은 이벤트를 옮겨 온다(도감 도입 전 기록). */
function backfill(): string[] {
  const G = appState.G;
  if (!G) return [];
  const ids = Object.keys(G.flags.evSeen ?? {});
  for (const [story, st] of Object.entries(G.story ?? {})) {
    for (const e of EVENTS) if (e.story === story && (e.stage ?? 0) <= st.stage) ids.push(e.id);
  }
  return ids;
}

export function dexSeen(): Set<string> {
  if (!seen) {
    const raw = loadKey<unknown>(KEY);
    seen = new Set(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : backfill());
    if (!Array.isArray(raw) && seen.size) saveKey(KEY, [...seen]);
  }
  return seen;
}

/** 처음 겪은 이벤트면 기록하고 true. */
export function markDexSeen(id: string): boolean {
  const s = dexSeen();
  if (s.has(id)) return false;
  s.add(id);
  saveKey(KEY, [...s]);
  return true;
}
