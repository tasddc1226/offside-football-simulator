// ───────── 로컬 명예의 전당 (T-11-126) ─────────
// 첫 화면이 쓰는 은퇴 기록 읽기만 둔 가벼운 모듈. season.ts에 두면 홈이 시즌 엔진 전체를 첫 번들로 끌어온다.
import { SAVE_VERSION } from './data.js';
import { loadKey } from './storage.js';
import type { GameState, HofEntry } from './types.js';
import { NATION_BY_CODE } from '@offside/contracts/nations';

/** 이 기기에 남기는 은퇴 선수 수(점수 순). */
export const HOF_LOCAL_MAX = 30;

/** 옛 은퇴 기록은 같은 cid의 은퇴 저장본에 명시된 국적만 보완한다. 원본·칭호·스냅샷은 바꾸지 않는다. */
export function migrateHofEntry(h: HofEntry, source: GameState | null): HofEntry {
  if (
    h.nation !== undefined ||
    !h.id ||
    source?.v !== SAVE_VERSION ||
    !source.retired ||
    h.id !== source.cid ||
    !source.nation ||
    !NATION_BY_CODE.has(source.nation)
  )
    return h;
  return { ...h, nation: source.nation };
}

export function loadHOF(): HofEntry[] {
  const hof = loadKey<HofEntry[]>('ft_hof') || loadKey<HofEntry[]>('sl_hof') || [];
  // T-10-107 예전에 겹쳐 저장된 같은 커리어는 하나만(점수 순이라 앞의 것).
  const seen = new Set<string>();
  const source = loadKey<GameState>('ft_save');
  return hof
    .filter((h) => !h.id || (!seen.has(h.id) && !!seen.add(h.id)))
    .map((h) => migrateHofEntry(h, source));
}
/** 이 기기에 남은 은퇴 선수 이름(커리어 id → 이름). 서버엔 이름 공개를 끈 선수의 이름이 없어 화면이 이것으로 채운다. */
export const localCareerNames = (): Map<string, string> =>
  new Map(loadHOF().flatMap((h) => (h.id ? [[h.id, h.name] as const] : [])));
