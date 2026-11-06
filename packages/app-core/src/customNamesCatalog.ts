// ───────── 바꿀 수 있는 이름 목록 (T-11-647) ─────────
// 설정 → 대회·수상 이름 바꾸기가 보여 주는 이름. 진행 중 커리어에 나온 이름을 먼저, 그 밖의 리그·국내 컵·대륙 대회·
// 리그 개인상을 뒤에 둔다. 이름은 저장된 한국어(tn 키) 그대로다. 설정 화면에서만 쓴다(게임 대회표를 가져온다).
import { CONT, CUPS, POTY, TOP_SCORER } from '@offside/game/comps';
import type { GameState } from '@offside/game/types';
import { customLeagues } from './clubCustom.js';

export type CustomNameGroup = 'comp' | 'award' | 'league';
export interface CustomNameItem {
  /** 저장된 원래 이름(tn 키). */
  ko: string;
  /** 진행 중 커리어에 나온 이름. */
  mine: boolean;
}

const WIN = / 우승$/; // i18n-ignore 저장값(트로피 이름 꼬리)

/** 그룹별 이름 — 내 커리어에 나온 이름 먼저, 같은 이름은 한 번. */
export function customNameCatalog(G: GameState | null): Record<CustomNameGroup, CustomNameItem[]> {
  const mine: Record<CustomNameGroup, string[]> = { comp: [], award: [], league: [] };
  if (G) {
    for (const r of G.career ?? []) {
      if (r.league) mine.league.push(r.league);
      for (const c of r.comps ?? []) mine.comp.push(c.name);
    }
    for (const t of G.trophies ?? []) {
      if (WIN.test(t.t)) mine.comp.push(t.t.replace(WIN, ''));
      else mine.award.push(t.t);
    }
    for (const a of G.awards ?? []) mine.award.push(a.t);
  }
  const rest: Record<CustomNameGroup, string[]> = {
    comp: [...Object.values(CUPS).flat(), ...Object.values(CONT).map((c) => c.name)],
    award: [...Object.values(TOP_SCORER), ...Object.values(POTY)],
    league: customLeagues().map((l) => l.name),
  };
  const out = {} as Record<CustomNameGroup, CustomNameItem[]>;
  for (const g of ['comp', 'award', 'league'] as const) {
    const seen = new Set<string>();
    out[g] = [];
    for (const [list, isMine] of [
      [mine[g], true],
      [rest[g], false],
    ] as const)
      for (const ko of list)
        if (ko && !seen.has(ko)) {
          seen.add(ko);
          out[g].push({ ko, mine: isMine });
        }
  }
  return out;
}
