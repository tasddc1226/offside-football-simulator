// ───────── 로컬 명예의 전당 (T-11-126) ─────────
// 첫 화면이 쓰는 은퇴 기록 읽기만 둔 가벼운 모듈. season.ts에 두면 홈이 시즌 엔진 전체를 첫 번들로 끌어온다.
import { SAVE_VERSION } from './data.js';
import { controlPoints } from '@offside/contracts/hof-rules';
import { legendTermsOf } from './legend.js';
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

/**
 * T-11-170 T-11-168에서 AM·CM의 경기 장악 가중이 0.5씩 줄었다(AM 0.5 → 0, CM 0.7 → 0.2). 서버는 배포 전 은퇴 기록을
 * round(옛 점수 − 0.5 × 경기 장악)으로 다시 매겼으니 이 기기 기록도 같은 식으로 맞춘다. 옛 공식 점수(새 공식 항의 합 +
 * 0.5 × 경기 장악)와 같을 때만 고쳐, 새 공식으로 은퇴한 기록과 이미 고친 기록은 그대로다.
 */
const RESCORE_DPOS = new Set(['AM', 'CM']);
export function rescoreHofEntry(h: HofEntry): HofEntry {
  if (!h.detail || !h.dpos || !RESCORE_DPOS.has(h.dpos)) return h;
  const cut = 0.5 * controlPoints(h.detail.career);
  const raw = Object.values(legendTermsOf(h.detail)).reduce((t, v) => t + v, 0);
  if (h.score !== Math.round(raw + cut)) return h;
  const score = Math.round(h.score - cut);
  return score === h.score ? h : { ...h, score };
}

export function loadHOF(): HofEntry[] {
  const hof = loadKey<HofEntry[]>('ft_hof') || loadKey<HofEntry[]>('sl_hof') || [];
  // T-10-107 예전에 겹쳐 저장된 같은 커리어는 하나만(점수 순이라 앞의 것).
  const seen = new Set<string>();
  const source = loadKey<GameState>('ft_save');
  return hof
    .filter((h) => !h.id || (!seen.has(h.id) && !!seen.add(h.id)))
    .map((h) => rescoreHofEntry(migrateHofEntry(h, source)));
}
/** 이 기기에 남은 은퇴 선수 이름(커리어 id → 이름). 서버엔 이름 공개를 끈 선수의 이름이 없어 화면이 이것으로 채운다. */
export const localCareerNames = (): Map<string, string> =>
  new Map(loadHOF().flatMap((h) => (h.id ? [[h.id, h.name] as const] : [])));
