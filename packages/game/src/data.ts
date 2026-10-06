// ───────── 정적 데이터: 리그 · 클럽 · 포지션 · 유형 · 특성 ─────────
import { CLUB_NAMES, clubIdOf, LEAGUE_BASE, type LeagueBase } from '@offside/contracts/club-names';
import { DETAILS_OF, type DetailPos } from '@offside/contracts/positions';
import { gDataText as L } from './i18n/ko/gData.js';
import { gAttrLabelText } from './i18n/ko/gAttrLabel.js';
import { gGkLabelText } from './i18n/ko/gGkLabel.js';

/** 세이브(ft_save) 형식 버전. 다른 값이면 저장본을 버리고 새로 시작한다(ui/boot.ts). 형식 변환은 save.ts migrateSave. */
export const SAVE_VERSION = 1;

export interface League extends LeagueBase {
  avg: number;
  spread: number;
  matches: number;
}
// 리그 id·이름·등급·자금력은 @offside/contracts/club-names(서버가 영구결번 등급·은퇴 가치에 쓴다, T-10-076·100).
const LEAGUE_STATS: Record<string, Pick<League, 'avg' | 'spread' | 'matches'>> = {
  hs: { avg: 46, spread: 5, matches: 20 },
  uni: { avg: 52, spread: 5, matches: 20 },
  k3: { avg: 51, spread: 5, matches: 28 },
  k2: { avg: 57, spread: 5, matches: 36 },
  k1: { avg: 63, spread: 6, matches: 38 },
  j1: { avg: 65, spread: 6, matches: 38 },
  // T-10-016 MLS: 전력은 J1보다 조금 위(자금력은 에레디비시 위 — club-names LEAGUE_BASE).
  mls: { avg: 66, spread: 7, matches: 34 },
  ere: { avg: 68, spread: 7, matches: 34 },
  l1: { avg: 71, spread: 7, matches: 34 },
  bl: { avg: 74, spread: 7, matches: 34 },
  sa: { avg: 74, spread: 7, matches: 38 },
  ll: { avg: 76, spread: 8, matches: 38 },
  pl: { avg: 78, spread: 7, matches: 38 },
};
export const LEAGUES: League[] = LEAGUE_BASE.map((l) => ({ ...l, ...LEAGUE_STATS[l.id]! }));

// 리그별 클럽 이름은 @offside/contracts/club-names(서버가 옛 기록의 구단을 이름으로 찾는다, T-10-076).
/** 리그 안 전력 편차: 1위 +9 ~ 꼴찌 -6을 팀 수에 맞춰 고르게 나눈다(6팀이면 9,6,3,0,-3,-6 — 예전 고정값과 같다). */
const clubOffset = (i: number, n: number) => (n > 1 ? Math.round(9 - (15 * i) / (n - 1)) : 0);
export interface Club {
  id: string;
  name: string;
  leagueId: string;
  str: number;
  /** T-10-009. 기본(별칭) 이름 — 유저가 이름을 바꿔도 되돌릴 수 있게 남긴다. */
  baseName?: string;
}
/** T-10-066. 기록에 남기는 클럽 참조 — 이름(표시용)과 id(엠블럼·같은 클럽 판정). 옛 기록에는 id가 없다. */
export interface ClubRef {
  club: string;
  clubId?: string | undefined;
}
export const clubRef = (c: Pick<Club, 'id' | 'name'>): Required<ClubRef> => ({
  club: c.name,
  clubId: c.id,
});
/** 같은 클럽인가 — 둘 다 id가 있으면 id로(구단명이 바뀌어도 같은 클럽), 아니면 이름으로 본다. */
export const sameClub = (a: ClubRef, b: ClubRef): boolean =>
  a.clubId && b.clubId ? a.clubId === b.clubId : a.club === b.club;
export const CLUBS: Club[] = [];
for (const L of LEAGUES) {
  const names = CLUB_NAMES[L.id] ?? [];
  names.forEach((name, i) =>
    CLUBS.push({
      id: clubIdOf(L.id, i),
      name,
      baseName: name,
      leagueId: L.id,
      str: L.avg + clubOffset(i, names.length),
    }),
  );
}

export const ATTR_KEYS = ['pac', 'sho', 'pas', 'dri', 'def', 'phy'] as const;
export type AttrKey = (typeof ATTR_KEYS)[number];
/** 능력치 이름. 키가 AttrKey인 네임스페이스 객체라 읽을 때 지금 언어로 나온다. */
export const ATTR_LABEL: Record<AttrKey, string> = gAttrLabelText;
export const GK_LABEL: Record<AttrKey, string> = gGkLabelText;

export type Pos = 'FW' | 'MF' | 'DF' | 'GK';
/** 골키퍼는 같은 여섯 능력치를 다른 이름으로 부른다. */
export const attrLabels = (pos: Pos): Record<AttrKey, string> =>
  pos === 'GK' ? GK_LABEL : ATTR_LABEL;
export interface PosDef {
  label: string;
  /** 선수 생성 화면의 한 줄 설명. */
  blurb: string;
  base: Record<AttrKey, number>;
  w: Partial<Record<AttrKey, number>>;
  goal: number;
  assist: number;
  atk: Partial<Record<AttrKey, number>>;
}
export const POS: Record<Pos, PosDef> = {
  FW: {
    get label() {
      return L.posFW;
    },
    get blurb() {
      return L.posFWBlurb;
    },
    base: { pac: 50, sho: 52, pas: 42, dri: 48, def: 28, phy: 46 },
    w: { sho: 0.34, pac: 0.2, dri: 0.24, phy: 0.1, pas: 0.1, def: 0.02 },
    goal: 0.34,
    assist: 0.13,
    atk: { sho: 0.6, dri: 0.25, pac: 0.15 },
  },
  MF: {
    get label() {
      return L.posMF;
    },
    get blurb() {
      return L.posMFBlurb;
    },
    base: { pac: 46, sho: 42, pas: 52, dri: 48, def: 40, phy: 44 },
    w: { pas: 0.32, dri: 0.2, sho: 0.12, def: 0.14, phy: 0.1, pac: 0.12 },
    goal: 0.14,
    assist: 0.19,
    atk: { sho: 0.45, dri: 0.3, pas: 0.25 },
  },
  DF: {
    get label() {
      return L.posDF;
    },
    get blurb() {
      return L.posDFBlurb;
    },
    base: { pac: 44, sho: 30, pas: 42, dri: 38, def: 54, phy: 52 },
    w: { def: 0.42, phy: 0.22, pac: 0.16, pas: 0.14, dri: 0.04, sho: 0.02 },
    goal: 0.05,
    assist: 0.06,
    atk: { sho: 0.3, phy: 0.5, pac: 0.2 },
  },
  GK: {
    get label() {
      return L.posGK;
    },
    get blurb() {
      return L.posGKBlurb;
    },
    base: { pac: 48, sho: 30, pas: 38, dri: 40, def: 54, phy: 48 },
    w: { def: 0.45, pac: 0.25, phy: 0.15, pas: 0.1, dri: 0.05, sho: 0 },
    goal: 0,
    assist: 0.008,
    atk: { sho: 1 },
  },
};

// ───────── 세부 포지션 (T-10-091) ─────────
// 시즌 1부터 만든 선수는 큰 포지션 안에서 세부 포지션을 고른다(옛 버전의 8종). 세부 포지션은
// (1) OVR·성장 가중을 정하는 역할(attributes ROLES) (2) 시작 분포 보정(mod, 순합 ≈ 0 — 시작 OVR은 같다)
// (3) 득점·도움 기대값 배수를 바꾼다. 레전드 점수 가중은 hof-rules LEGEND_W_DETAIL이 세부 포지션별로 맞춘다.
export { DETAILS_OF, type DetailPos };
export interface DetailPosDef {
  label: string;
  /** 선수 생성 화면의 한 줄 설명. */
  blurb: string;
  /** attributes.ts ROLES 키. */
  role: string;
  mod: Partial<Record<AttrKey, number>>;
  /** 이 세부 포지션을 고르면 처음 켜 두는 주력 능력치. */
  focus: AttrKey[];
  goal: number;
  assist: number;
}
export const DPOS: Record<DetailPos, DetailPosDef> = {
  ST: {
    get label() {
      return L.dposST;
    },
    get blurb() {
      return L.dposSTBlurb;
    },
    role: 'ST',
    mod: {},
    focus: ['sho', 'dri'],
    goal: 1.05,
    assist: 0.85,
  },
  W: {
    get label() {
      return L.dposW;
    },
    get blurb() {
      return L.dposWBlurb;
    },
    role: 'RW',
    mod: { pac: 4, dri: 3, sho: -3, phy: -4 },
    focus: ['pac', 'dri'],
    goal: 0.85,
    assist: 1.35,
  },
  AM: {
    get label() {
      return L.dposAM;
    },
    get blurb() {
      return L.dposAMBlurb;
    },
    role: 'CAM',
    mod: { sho: 3, dri: 2, def: -4, phy: -1 },
    focus: ['pas', 'dri'],
    goal: 1.1,
    assist: 1.05,
  },
  CM: {
    get label() {
      return L.dposCM;
    },
    get blurb() {
      return L.dposCMBlurb;
    },
    role: 'CM',
    mod: {},
    focus: ['pas', 'phy'],
    goal: 1,
    assist: 1,
  },
  DM: {
    get label() {
      return L.dposDM;
    },
    get blurb() {
      return L.dposDMBlurb;
    },
    role: 'CDM',
    mod: { def: 6, phy: 2, sho: -5, dri: -3 },
    focus: ['def', 'pas'],
    goal: 0.8,
    assist: 1.0,
  },
  CB: {
    get label() {
      return L.dposCB;
    },
    get blurb() {
      return L.dposCBBlurb;
    },
    role: 'CB',
    mod: { phy: 2, def: 1, pac: -2, pas: -2 },
    focus: ['def', 'phy'],
    goal: 1.2,
    assist: 0.6,
  },
  FB: {
    get label() {
      return L.dposFB;
    },
    get blurb() {
      return L.dposFBBlurb;
    },
    role: 'RB',
    mod: { pac: 5, pas: 3, def: -2, phy: -4 },
    focus: ['pac', 'def'],
    goal: 0.8,
    assist: 1.4,
  },
  GK: {
    get label() {
      return L.dposGK;
    },
    get blurb() {
      return L.dposGKBlurb;
    },
    role: 'GK',
    mod: {},
    focus: ['def', 'pac'],
    goal: 1,
    assist: 1,
  },
};
/** 경기 득점·도움 기대값(포지션 기본값 × 세부 포지션 배수). */
export const scoreRate = (s: {
  pos: Pos;
  dpos?: DetailPos | undefined;
}): { goal: number; assist: number } => {
  const P = POS[s.pos],
    D = s.dpos ? DPOS[s.dpos] : null;
  return { goal: P.goal * (D?.goal ?? 1), assist: P.assist * (D?.assist ?? 1) };
};
/** 포지션 표시 이름(세부 포지션이 있으면 그 이름). */
export const posLabel = (s: { pos: Pos; dpos?: DetailPos | null | undefined }): string =>
  s.dpos ? DPOS[s.dpos].label : POS[s.pos].label;
/** 포지션 영어 약어(명예의 전당). 언어와 상관없이 같다. 세부 포지션이 없는 프리시즌 선수는 큰 포지션(FW·MF·DF·GK). */
const DPOS_ABBR: Record<DetailPos, string> = {
  GK: 'GK',
  CB: 'CB',
  FB: 'FB',
  DM: 'CDM',
  CM: 'CM',
  AM: 'CAM',
  W: 'WG',
  ST: 'ST',
};
export const posAbbr = (s: { pos: Pos; dpos?: DetailPos | null | undefined }): string =>
  s.dpos ? DPOS_ABBR[s.dpos] : s.pos;

export interface TypeDef {
  id: string;
  name: string;
  desc: string;
  mod: Partial<Record<AttrKey, number>>;
}
export const TYPES: Record<Pos, TypeDef[]> = {
  FW: [
    {
      id: 'poacher',
      get name() {
        return L.typePoacher;
      },
      get desc() {
        return L.typePoacherDesc;
      },
      mod: { sho: 8, dri: 1, def: -5, pas: -2 },
    },
    {
      id: 'speed',
      get name() {
        return L.typeSpeed;
      },
      get desc() {
        return L.typeSpeedDesc;
      },
      mod: { pac: 8, dri: 2, phy: -5 },
    },
    {
      id: 'target',
      get name() {
        return L.typeTarget;
      },
      get desc() {
        return L.typeTargetDesc;
      },
      mod: { phy: 8, sho: 3, pac: -6 },
    },
  ],
  MF: [
    {
      id: 'maker',
      get name() {
        return L.typeMaker;
      },
      get desc() {
        return L.typeMakerDesc;
      },
      mod: { pas: 8, dri: 2, phy: -5 },
    },
    {
      id: 'b2b',
      get name() {
        return L.typeB2b;
      },
      get desc() {
        return L.typeB2bDesc;
      },
      mod: { phy: 5, def: 5, dri: -3 },
    },
    {
      id: 'winger',
      get name() {
        return L.typeWinger;
      },
      get desc() {
        return L.typeWingerDesc;
      },
      mod: { dri: 6, pac: 5, def: -6 },
    },
  ],
  DF: [
    {
      id: 'stopper',
      get name() {
        return L.typeStopper;
      },
      get desc() {
        return L.typeStopperDesc;
      },
      mod: { def: 6, phy: 5, pas: -5 },
    },
    {
      id: 'fullback',
      get name() {
        return L.typeFullback;
      },
      get desc() {
        return L.typeFullbackDesc;
      },
      mod: { pac: 7, pas: 3, phy: -4 },
    },
    {
      id: 'libero',
      get name() {
        return L.typeLibero;
      },
      get desc() {
        return L.typeLiberoDesc;
      },
      mod: { pas: 7, def: 2, pac: -5 },
    },
  ],
  GK: [
    {
      id: 'shot',
      get name() {
        return L.typeShot;
      },
      get desc() {
        return L.typeShotDesc;
      },
      mod: { def: 6, pac: 4, pas: -5 },
    },
    {
      id: 'sweeper',
      get name() {
        return L.typeSweeper;
      },
      get desc() {
        return L.typeSweeperDesc;
      },
      mod: { pas: 8, pac: 2, phy: -5 },
    },
    {
      id: 'wall',
      get name() {
        return L.typeWall;
      },
      get desc() {
        return L.typeWallDesc;
      },
      mod: { phy: 8, def: 3, pac: -6 },
    },
  ],
};

// ───────── 주력 능력치 (T-10-008) ─────────
// 선수 생성 때 유형 대신 "키우고 싶은 능력치" FOCUS_PICK개를 고른다. 초기 분포는 주력 능력치에
// +FOCUS_UP씩 얹고, 그 포지션에서 OVR 가중치가 가장 낮은 비주력 능력치 두 개에서 FOCUS_DOWN만큼
// 뺀다(순합 +5 — 기존 유형 mod 순합 2~7과 같은 폭). 성장은 engine.applyTraining이 주력 훈련에
// FOCUS_GROWTH, 비주력 훈련에 OFF_FOCUS_GROWTH를 곱한다 — 6개 중 2개라 무작위 훈련의 기대 배율은 1이다.
// `type`은 저장·서버 계약·역할/이벤트 조건 호환을 위해 주력 조합에서 가장 가까운 유형으로 계속 채운다.
export const FOCUS_PICK = 2;
export const FOCUS_UP = 6;
const FOCUS_DOWN = [4, 3] as const;
export const FOCUS_GROWTH = 1.2;
export const OFF_FOCUS_GROWTH = 0.9;
/** 컨디션이 이보다 낮으면 선발 확률이 줄고(0.6배), 부상 확률이 늘어난다(2.5배). 훈련 설명(T-10-074)도 쓴다. */
export const COND_LOW_START = 35,
  COND_LOW_INJURY = 40;

export function focusMod(pos: Pos, focus: readonly AttrKey[]): Partial<Record<AttrKey, number>> {
  const mod: Partial<Record<AttrKey, number>> = {};
  for (const k of focus) mod[k] = FOCUS_UP;
  const w = POS[pos].w;
  const weakest = ATTR_KEYS.filter((k) => !focus.includes(k)).sort(
    (a, b) => (w[a] ?? 0) - (w[b] ?? 0),
  );
  FOCUS_DOWN.forEach((d, i) => {
    const k = weakest[i];
    if (k) mod[k] = -d;
  });
  return mod;
}

/** 포지션 기본 주력 — OVR 가중치가 가장 큰 FOCUS_PICK개. */
export const defaultFocus = (pos: Pos): AttrKey[] =>
  ATTR_KEYS.slice()
    .sort((a, b) => (POS[pos].w[b] ?? 0) - (POS[pos].w[a] ?? 0))
    .slice(0, FOCUS_PICK);

/** 주력 조합에 가장 가까운 기존 유형(동점이면 목록 앞쪽). */
export function typeForFocus(pos: Pos, focus: readonly AttrKey[]): string {
  const score = (t: TypeDef) => focus.reduce((sum, k) => sum + (t.mod[k] ?? 0), 0);
  return TYPES[pos].reduce((best, t) => (score(t) > score(best) ? t : best)).id;
}

/** 유형에서 주력 능력치를 거꾸로 구한다(옛 저장본·시뮬레이터용) — mod가 큰 순 상위 FOCUS_PICK개. */
export function focusOfType(pos: Pos, typeId: string): AttrKey[] {
  const mod = (TYPES[pos].find((t) => t.id === typeId) ?? TYPES[pos][0]!).mod;
  return ATTR_KEYS.filter((k) => (mod[k] ?? 0) > 0)
    .sort((a, b) => mod[b]! - mod[a]!)
    .slice(0, FOCUS_PICK);
}

export interface TraitDef {
  id: string;
  name: string;
  desc: string;
  /** 선수 생성 화면 태그 카드용 아이콘·짧은 설명. */
  icon: string;
  short: string;
}
export const TRAITS: TraitDef[] = [
  {
    id: 'early',
    get name() {
      return L.traitEarly;
    },
    get desc() {
      return L.traitEarlyDesc;
    },
    icon: '⚡',
    get short() {
      return L.traitEarlyShort;
    },
  },
  {
    id: 'late',
    get name() {
      return L.traitLate;
    },
    get desc() {
      return L.traitLateDesc;
    },
    icon: '🌱',
    get short() {
      return L.traitLateShort;
    },
  },
  {
    id: 'iron',
    get name() {
      return L.traitIron;
    },
    get desc() {
      return L.traitIronDesc;
    },
    icon: '🛡️',
    get short() {
      return L.traitIronShort;
    },
  },
  {
    id: 'star',
    get name() {
      return L.traitStar;
    },
    get desc() {
      return L.traitStarDesc;
    },
    icon: '⭐',
    get short() {
      return L.traitStarShort;
    },
  },
];

/**
 * 시즌 구간 이름(0 프리시즌 ~ 3 시즌 종료). 인덱스로 읽을 때마다 지금 언어로 나온다(로그의 시간 표기도 쓴 시점의 언어).
 * 이름은 비교·저장에 쓰지 않는다 — 구간은 숫자(phase)로만 다룬다.
 */
export const PHASES: readonly string[] = new Array<string>(4).fill('');
for (let i = 0; i < 4; i++)
  Object.defineProperty(PHASES, i, {
    enumerable: true,
    get: () => L[`phase${i}` as 'phase0'],
  });
export const LAST_PHASE = 2;

export const SURNAMES = [
  '김',
  '이',
  '박',
  '최',
  '정',
  '강',
  '조',
  '윤',
  '장',
  '임',
  '한',
  '오',
  '서',
  '신',
  '권',
];
export const GIVEN = [
  '민재',
  '흥민',
  '강인',
  '태윤',
  '도현',
  '지호',
  '서준',
  '유찬',
  '하람',
  '시우',
  '건우',
  '은호',
  '재혁',
  '준서',
];
