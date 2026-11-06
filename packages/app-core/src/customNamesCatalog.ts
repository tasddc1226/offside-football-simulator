// ───────── 바꿀 수 있는 이름 목록 (T-11-647) ─────────
// 설정 → 대회·수상 이름 바꾸기가 보여 주는 이름. 진행 중 커리어에 나온 이름을 먼저, 그 뒤 게임이 주는 대회·상 이름을 묶음별로
// 전부 둔다(받기 전에도 미리 바꿀 수 있게). 이름은 저장된 한국어(tn 키) 그대로다. 설정 화면에서만 쓴다(게임 대회표를 가져온다).
import { CONFEDS } from '@offside/contracts/nations';
import {
  AMATEUR_AWARDS,
  CONT,
  CUPS,
  GALA_AWARDS,
  POTY,
  SUPERCUP,
  TOP_SCORER,
  leagueAwardNames,
} from '@offside/game/comps';
import { federationPoty } from '@offside/game/nation';
import { NATIONAL_TROPHIES } from '@offside/game/national';
import type { GameState } from '@offside/game/types';
import { customLeagues } from './clubCustom.js';

export type CustomNameGroup = 'comp' | 'award' | 'league';
/** 목록 안 묶음 — 화면은 묶음이 바뀌는 자리에 제목을 그린다. */
export type CustomNameSection =
  | 'mine'
  | 'cup'
  | 'super'
  | 'club'
  | 'national'
  | 'leagueTop'
  | 'leagueMore'
  | 'gala'
  | 'confed'
  | 'medal'
  | 'amateur'
  | 'league';
/** 묶음 제목의 사전 키(customNames 사전의 secMine 등). */
export const customNameSectionKey = (sec: CustomNameSection) =>
  `sec${sec.charAt(0).toUpperCase()}${sec.slice(1)}` as `sec${Capitalize<CustomNameSection>}`;
export interface CustomNameItem {
  /** 저장된 원래 이름(tn 키). */
  ko: string;
  /** 진행 중 커리어에 나온 이름. */
  mine: boolean;
  sec: CustomNameSection;
}

const WIN = / 우승$/; // i18n-ignore 저장값(트로피 이름 꼬리)
// i18n-ignore 저장값(대회 이름)
const CLUB_WORLD = 'FIFA 클럽 월드컵';
// i18n-ignore 저장값(대회 이름)
const NATIONAL_EXTRA = ['FIFA 월드컵', '아시안게임', '올림픽'];
const CONFED_LIST = Object.values(CONFEDS);

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
  const leagues = customLeagues();
  const rest: Record<CustomNameGroup, [CustomNameSection, readonly string[]][]> = {
    comp: [
      ['cup', Object.values(CUPS).flat()],
      ['super', Object.values(SUPERCUP)],
      ['club', [...Object.values(CONT).map((c) => c.name), CLUB_WORLD]],
      [
        'national',
        [NATIONAL_EXTRA[0]!, ...CONFED_LIST.map((c) => c.cup), ...NATIONAL_EXTRA.slice(1)],
      ],
    ],
    award: [
      ['leagueTop', [...Object.values(TOP_SCORER), ...Object.values(POTY)]],
      ['leagueMore', leagues.flatMap(leagueAwardNames)],
      ['gala', GALA_AWARDS],
      [
        'confed',
        [
          ...CONFED_LIST.flatMap((c) => (c.potyAbroad ? [c.poty, c.potyAbroad] : [c.poty])),
          federationPoty({ nation: G?.nation }),
        ],
      ],
      ['medal', [...NATIONAL_TROPHIES].filter((t) => !WIN.test(t))],
      ['amateur', AMATEUR_AWARDS],
    ],
    league: [['league', leagues.map((l) => l.name)]],
  };
  const out = {} as Record<CustomNameGroup, CustomNameItem[]>;
  for (const g of ['comp', 'award', 'league'] as const) {
    const seen = new Set<string>();
    out[g] = [];
    const add = (ko: string, sec: CustomNameSection) => {
      if (!ko || seen.has(ko)) return;
      seen.add(ko);
      out[g].push({ ko, mine: sec === 'mine', sec });
    };
    for (const ko of mine[g]) add(ko, 'mine');
    for (const [sec, list] of rest[g]) for (const ko of list) add(ko, sec);
  }
  return out;
}
