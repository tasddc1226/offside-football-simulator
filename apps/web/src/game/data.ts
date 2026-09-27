// ───────── 정적 데이터: 리그 · 클럽 · 포지션 · 유형 · 특성 ─────────
import { CLUB_NAMES, clubIdOf } from '@offside/contracts/club-names';

/** 세이브(ft_save) 형식 버전. 다른 값이면 저장본을 버리고 새로 시작한다(ui/boot.ts). 형식 변환은 save.ts migrateSave. */
export const SAVE_VERSION = 1;

export interface League {
  id: string;
  name: string;
  tier: number;
  avg: number;
  spread: number;
  wealth: number;
  matches: number;
  amateur?: boolean;
}
export const LEAGUES: League[] = [
  {
    id: 'hs',
    name: '고교 리그',
    tier: 0,
    avg: 46,
    spread: 5,
    wealth: 0,
    matches: 20,
    amateur: true,
  },
  {
    id: 'uni',
    name: 'U리그 (대학)',
    tier: 0,
    avg: 52,
    spread: 5,
    wealth: 0,
    matches: 20,
    amateur: true,
  },
  { id: 'k3', name: 'K3리그', tier: 0, avg: 51, spread: 5, wealth: 1.5, matches: 28 },
  { id: 'k2', name: 'K리그2', tier: 1, avg: 57, spread: 5, wealth: 4, matches: 36 },
  { id: 'k1', name: 'K리그1', tier: 2, avg: 63, spread: 6, wealth: 7, matches: 38 },
  { id: 'j1', name: 'J1리그', tier: 3, avg: 65, spread: 6, wealth: 9, matches: 38 },
  // T-10-016 미국 MLS. 유럽이 아니라 J1과 같은 tier 3(해외·단일 연도 시즌)에 두고, 전력은 J1보다 조금 위, 자금력은 에레디비시 위.
  { id: 'mls', name: 'MLS', tier: 3, avg: 66, spread: 7, wealth: 14, matches: 34 },
  { id: 'ere', name: '에레디비시', tier: 4, avg: 68, spread: 7, wealth: 12, matches: 34 },
  { id: 'l1', name: '리그 1', tier: 5, avg: 71, spread: 7, wealth: 18, matches: 34 },
  { id: 'bl', name: '분데스리가', tier: 6, avg: 74, spread: 7, wealth: 24, matches: 34 },
  { id: 'sa', name: '세리에 A', tier: 6, avg: 74, spread: 7, wealth: 24, matches: 38 },
  { id: 'll', name: '라리가', tier: 7, avg: 76, spread: 8, wealth: 30, matches: 38 },
  { id: 'pl', name: '프리미어리그', tier: 8, avg: 78, spread: 7, wealth: 40, matches: 38 },
];

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
export const ATTR_LABEL: Record<AttrKey, string> = {
  pac: '스피드',
  sho: '슈팅',
  pas: '패스',
  dri: '드리블',
  def: '수비',
  phy: '피지컬',
};
export const GK_LABEL: Record<AttrKey, string> = {
  pac: '반사 신경',
  sho: '스피드',
  pas: '킥',
  dri: '위치 선정',
  def: '다이빙',
  phy: '핸들링',
};

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
    label: '공격수',
    blurb: '골로 말하는 해결사',
    base: { pac: 50, sho: 52, pas: 42, dri: 48, def: 28, phy: 46 },
    w: { sho: 0.34, pac: 0.2, dri: 0.24, phy: 0.1, pas: 0.1, def: 0.02 },
    goal: 0.34,
    assist: 0.13,
    atk: { sho: 0.6, dri: 0.25, pac: 0.15 },
  },
  MF: {
    label: '미드필더',
    blurb: '패스로 경기를 조율',
    base: { pac: 46, sho: 42, pas: 52, dri: 48, def: 40, phy: 44 },
    w: { pas: 0.32, dri: 0.2, sho: 0.12, def: 0.14, phy: 0.1, pac: 0.12 },
    goal: 0.14,
    assist: 0.19,
    atk: { sho: 0.45, dri: 0.3, pas: 0.25 },
  },
  DF: {
    label: '수비수',
    blurb: '실점을 막는 벽',
    base: { pac: 44, sho: 30, pas: 42, dri: 38, def: 54, phy: 52 },
    w: { def: 0.42, phy: 0.22, pac: 0.16, pas: 0.14, dri: 0.04, sho: 0.02 },
    goal: 0.05,
    assist: 0.06,
    atk: { sho: 0.3, phy: 0.5, pac: 0.2 },
  },
  GK: {
    label: '골키퍼',
    blurb: '마지막 방어선',
    base: { pac: 48, sho: 30, pas: 38, dri: 40, def: 54, phy: 48 },
    w: { def: 0.45, pac: 0.25, phy: 0.15, pas: 0.1, dri: 0.05, sho: 0 },
    goal: 0,
    assist: 0.008,
    atk: { sho: 1 },
  },
};

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
      name: '골 사냥꾼',
      desc: '슈팅 ▲▲ · 수비 ▼',
      mod: { sho: 8, dri: 1, def: -5, pas: -2 },
    },
    {
      id: 'speed',
      name: '스피드스터',
      desc: '스피드 ▲▲ · 피지컬 ▼',
      mod: { pac: 8, dri: 2, phy: -5 },
    },
    {
      id: 'target',
      name: '타깃맨',
      desc: '피지컬 ▲▲ · 스피드 ▼',
      mod: { phy: 8, sho: 3, pac: -6 },
    },
  ],
  MF: [
    {
      id: 'maker',
      name: '플레이메이커',
      desc: '패스 ▲▲ · 피지컬 ▼',
      mod: { pas: 8, dri: 2, phy: -5 },
    },
    {
      id: 'b2b',
      name: '박스 투 박스',
      desc: '피지컬·수비 ▲ · 드리블 ▼',
      mod: { phy: 5, def: 5, dri: -3 },
    },
    {
      id: 'winger',
      name: '윙어',
      desc: '드리블·스피드 ▲ · 수비 ▼',
      mod: { dri: 6, pac: 5, def: -6 },
    },
  ],
  DF: [
    {
      id: 'stopper',
      name: '스토퍼',
      desc: '수비·피지컬 ▲ · 패스 ▼',
      mod: { def: 6, phy: 5, pas: -5 },
    },
    {
      id: 'fullback',
      name: '공격형 풀백',
      desc: '스피드·패스 ▲ · 피지컬 ▼',
      mod: { pac: 7, pas: 3, phy: -4 },
    },
    {
      id: 'libero',
      name: '빌드업 센터백',
      desc: '패스 ▲▲ · 스피드 ▼',
      mod: { pas: 7, def: 2, pac: -5 },
    },
  ],
  GK: [
    {
      id: 'shot',
      name: '슈퍼 세이버',
      desc: '다이빙·반사 신경 ▲ · 킥 ▼',
      mod: { def: 6, pac: 4, pas: -5 },
    },
    {
      id: 'sweeper',
      name: '스위퍼 키퍼',
      desc: '킥 ▲▲ · 핸들링 ▼',
      mod: { pas: 8, pac: 2, phy: -5 },
    },
    {
      id: 'wall',
      name: '통곡의 벽',
      desc: '핸들링 ▲▲ · 반사 신경 ▼',
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
    name: '조기 성장',
    desc: '어릴 때 빠르게 크고 일찍 주목받지만, 일찍 꺾입니다.',
    icon: '⚡',
    short: '빨리 크고 일찍 꺾여요',
  },
  {
    id: 'late',
    name: '대기만성',
    desc: '늦게 피지만 전성기가 길어요.',
    icon: '🌱',
    short: '늦게 피고 오래 가요',
  },
  {
    id: 'iron',
    name: '강철 체력',
    desc: '부상 확률이 크게 낮습니다.',
    icon: '🛡️',
    short: '부상이 크게 줄어요',
  },
  {
    id: 'star',
    name: '스타성',
    desc: '인기와 스폰서가 잘 따라옵니다.',
    icon: '⭐',
    short: '인기·스폰서가 따라와요',
  },
];

export const PHASES = ['프리시즌', '전반기', '후반기', '시즌 종료'];
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
