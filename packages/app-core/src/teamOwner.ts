// T-10-092 구단주 팀 화면의 순수 로직(웹 team/Team.svelte · 앱 screens/owner/Team.tsx 공용, T-11-005).
// 편성(자동 배치·자리 바꾸기)·선수 고르기 후보·업적 표기·경기 결과 표기처럼 화면이 그리기 전에 계산하는 것만 둔다.
import { FACE_ABBR, GK_ABBR } from '@offside/game/attributes';
import { ATTR_KEYS } from '@offside/game/data';
import {
  ACH_CATEGORIES,
  LINEUP_SIZE,
  TEAM_WILDCARD_MAX,
  YOUTH_OVR,
  isWildcardSeason,
  achGradeOf,
  DUOS,
  FOOT_BONUS,
  FOOT_BONUS_BOTH,
  HOMEGROWN_EFFECT,
  TEAM_RULES,
  lineStrength,
  slotFit,
  slotRating,
  synergyApplies,
  teamSynergy,
  toSynergyPlayer,
  type AchCategory,
  type AchGrade,
  type ActiveSynergy,
  type DetailPos,
  type LineStrength,
  type SynergyLines,
  type TeamLayout,
  type TeamSynergy,
} from '@offside/contracts/owner-team';
import type {
  ClubAchievement,
  ClubAchievementGroup,
  OwnerTeam,
  TeamMatch,
  TeamPlayer,
} from './api/team.js';
import { num, signedNum } from './teamText.js';
import { teamCoreText as L } from './i18n/ko/teamCore.js';
import { teamHomeText as TH } from './i18n/ko/teamHome.js';
import { teamSynergyText as SY } from './i18n/ko/teamSynergy.js';

/** 선수 고르기 정렬 — 그 자리 실력 · 레전드 점수 · 최고 OVR. */
export type PickSort = 'fit' | 'score' | 'peak';
export const pickSorts = (): readonly (readonly [PickSort, string])[] => [
  ['fit', L.sortFit],
  ['score', L.sortScore],
  ['peak', L.sortPeak],
];

export type PickCandidate = {
  p: TeamPlayer;
  /** 그 자리에서의 실력. */
  rating: number;
  /** 그 자리 적합도(0~1). */
  fit: number;
  /** 이미 편성된 자리(없으면 -1). */
  at: number;
};

/** 고른 자리(picking)에 넣을 수 있는 선수 목록을 정렬해 돌려준다. */
export function pickCandidates(
  slotCodes: readonly DetailPos[],
  picking: number,
  players: readonly TeamPlayer[],
  slots: readonly (string | null)[],
  sort: PickSort,
): PickCandidate[] {
  const slot = slotCodes[picking]!;
  return players
    .map((p) => {
      const rating = slotRating(slot, p);
      return { p, rating, fit: slotFit(slot, p, rating), at: slots.indexOf(p.careerId) };
    })
    .sort((a, b) =>
      sort === 'score'
        ? (b.p.legendScore ?? 0) - (a.p.legendScore ?? 0) || b.rating - a.rating
        : sort === 'peak'
          ? b.p.peak - a.p.peak || b.rating - a.rating
          : b.rating - a.rating || b.p.peak - a.p.peak,
    );
}

/** 최고 시점 대표 능력치 한 줄(골키퍼는 골키퍼 능력치 이름). */
export const attrLine = (p: TeamPlayer): string | null =>
  p.attrs
    ? (p.attrsEstimated ? L.attrEstimated : '') +
      ATTR_KEYS.map((k) => `${(p.pos === 'GK' ? GK_ABBR : FACE_ABBR)[k]} ${p.attrs![k]}`).join(
        ' · ',
      )
    : null;

/** 고른 자리에 선수를 넣는다. 이미 다른 자리에 있던 선수면 두 자리를 맞바꾼다. */
export function assignSlot(
  slots: readonly (string | null)[],
  picking: number,
  id: string | null,
): (string | null)[] {
  const next = [...slots];
  const from = id ? next.indexOf(id) : -1;
  if (from >= 0) next[from] = next[picking] ?? null;
  next[picking] = id;
  return next;
}

/** 와일드카드가 가득 찼을 때 안내(서버 오류 문구 WILDCARD_FULL_TEXT의 화면 쪽). */
export const wildcardFullText = () => L.wildcardFull({ max: TEAM_WILDCARD_MAX });
/** T-11-114 선발에 든 와일드카드(지난 시즌 선수) 수. */
export const wildcardsIn = (
  slots: readonly (string | null)[],
  byId: ReadonlyMap<string, TeamPlayer>,
  season: number,
) => slots.filter((id) => id !== null && isWildcardSeason(byId.get(id)?.season, season)).length;
/** 와일드카드 상한을 넘는 선발인지(자리 바꾸기는 수가 그대로라 괜찮다). */
export const tooManyWildcards = (
  slots: readonly (string | null)[],
  byId: ReadonlyMap<string, TeamPlayer>,
  season: number,
) => wildcardsIn(slots, byId, season) > TEAM_WILDCARD_MAX;
/** 편성 화면 와일드카드 표기 — '와일드카드 2/3'. 앞 시즌이 없는 프리시즌은 null. */
export const wildcardLabel = (
  slots: readonly (string | null)[],
  byId: ReadonlyMap<string, TeamPlayer>,
  season: number,
): string | null =>
  season > 0
    ? L.wildcardLabel({ n: wildcardsIn(slots, byId, season), max: TEAM_WILDCARD_MAX })
    : null;

/** 실력이 같으면 먼저 채울 자리(스트라이커·골키퍼·센터백 …). */
const FILL_ORDER = ['ST', 'GK', 'CB', 'CM', 'AM', 'DM', 'W', 'FB'];

/** 자리마다 가장 잘 맞는 선수부터 채운다(유스 선수보다 나을 때만). 지난 시즌 선수는 와일드카드 상한까지만. */
export function autoFillSlots(
  slotCodes: readonly DetailPos[],
  players: readonly TeamPlayer[],
  season: number,
): (string | null)[] {
  const next: (string | null)[] = Array(LINEUP_SIZE).fill(null);
  const order = slotCodes
    .map((slot, i) => ({ slot, i }))
    .sort((a, b) => FILL_ORDER.indexOf(a.slot) - FILL_ORDER.indexOf(b.slot));
  const wildIds = new Set(
    players.filter((p) => isWildcardSeason(p.season, season)).map((p) => p.careerId),
  );
  const used = new Set<string>();
  let wild = 0;
  for (;;) {
    let best: { i: number; id: string; r: number } | null = null;
    for (const { slot, i } of order) {
      if (next[i] !== null) continue;
      for (const p of players) {
        if (used.has(p.careerId)) continue;
        if (wild >= TEAM_WILDCARD_MAX && wildIds.has(p.careerId)) continue;
        const r = slotRating(slot, p);
        if (r > YOUTH_OVR && (!best || r > best.r)) best = { i, id: p.careerId, r };
      }
    }
    if (!best) break;
    next[best.i] = best.id;
    used.add(best.id);
    if (wildIds.has(best.id)) wild++;
  }
  return next;
}

/**
 * T-11-105 편성 중인 선발의 시너지 — 서버 경기 계산(api team/sim.ts buildLineup)과 같은 입력으로 센다. 빈 자리는 유스 선수.
 */
export function slotsSynergy(
  positions: TeamLayout,
  slots: readonly (string | null)[],
  byId: ReadonlyMap<string, TeamPlayer>,
): TeamSynergy {
  return teamSynergy(
    positions.map(({ slot, x }, i) => {
      const p = slots[i] ? byId.get(slots[i]!) : undefined;
      return p ? toSynergyPlayer(slot, x, p) : null;
    }),
  );
}

/** 편성 줄 힘 — 시너지 반영 시즌부터 시너지 보정을 더한다(서버 view.ts linesOf와 같은 규칙). */
export const draftLines = (
  slotCodes: readonly DetailPos[],
  ratings: readonly (number | null)[],
  synergy: TeamSynergy,
  season: number,
): LineStrength => lineStrength(slotCodes, ratings, synergyApplies(season) ? synergy : null);

const SYN_LABEL = { atk: 'lineAtk', mid: 'lineMid', def: 'lineDef', gk: 'lineGk' } as const;
/** 시너지 효과 표기 — '공격 +2 · 중원 +0.5'. 효과가 비면 배지는 '경기 효과 없음', 듀오는 상한에 걸린 것. */
export const synergyEffectText = (
  effect: Partial<SynergyLines>,
  kind?: ActiveSynergy['kind'],
): string =>
  (Object.keys(SYN_LABEL) as (keyof SynergyLines)[])
    .filter((k) => effect[k])
    .map((k) => `${TH[SYN_LABEL[k]]} ${signedNum(effect[k]!)}`)
    .join(' · ') || (kind === 'duo' ? SY.capped : SY.noEffect);
/** 시너지가 경기에 들어가는지 알리는 한 줄. */
export const synergyNote = (season: number): string =>
  synergyApplies(season) ? SY.applies : SY.notApplied;
/** 시너지 이름·설명 — 한국어는 contracts 정의 그대로, 다른 언어는 사전에서 id로 찾는다. */
const synergyText = (id: string, name: string, desc: string): readonly [string, string] => [
  SY.synName({ id, ko: name }),
  SY.synDesc({ id, ko: desc }),
];

export type SynergyChip = {
  id: string;
  name: string;
  desc: string;
  effect: string;
  badge: boolean;
};
/** 편성 화면의 시너지 칩(웹·앱 공용). 주발 맞춤은 인원과 자리 실력 보정 합을 보인다. */
export const synergyChips = (s: TeamSynergy): SynergyChip[] =>
  s.active.map((a) => {
    const [name, desc] = synergyText(a.id, a.name, a.desc);
    return {
      id: a.id,
      name: a.kind === 'foot' ? SY.footChip({ name, n: a.members.length }) : name,
      desc,
      effect:
        a.kind === 'foot'
          ? SY.fitEffect({ v: signedNum(s.foot.reduce((t, b) => t + b, 0)) })
          : synergyEffectText(a.effect, a.kind),
      badge: a.kind === 'badge',
    };
  });
/** 고른 시너지 칩 → 그라운드 듀오 연결선(고른 것은 굵게)과 테두리를 칠 선수 자리. */
export function synergyFocus(s: TeamSynergy, id: string | null) {
  return {
    links: s.active
      .filter((a) => a.kind === 'duo')
      .map((a) => ({ members: a.members, on: a.id === id })),
    members: s.active.find((a) => a.id === id)?.members ?? null,
  };
}
/** 시너지 표 — [이름, 설명, 효과]. 숨은 규칙 없이 전부 보인다. 언어를 바꾸면 다시 만들어야 해서 함수다. */
export const synergyTable = (): readonly (readonly [string, string, string])[] => {
  const row = (r: { id: string; name: string; desc: string }, effect: string) =>
    [...synergyText(r.id, r.name, r.desc), effect] as const;
  return [
    ...DUOS.map((d) => row(d, synergyEffectText(d.effect))),
    row(TEAM_RULES.homegrown, synergyEffectText(HOMEGROWN_EFFECT)),
    row(TEAM_RULES.national, SY.badgeOnly),
    row(
      TEAM_RULES.foot,
      SY.fitEffectBoth({ v: signedNum(FOOT_BONUS), both: signedNum(FOOT_BONUS_BOTH) }),
    ),
  ];
};

/** 경기하기 버튼 밑에 보이는 못 하는 이유(할 수 있으면 null). */
export function playHintOf(
  team: OwnerTeam | null,
  dirty: boolean,
  matchesLeft: number,
): string | null {
  return !team
    ? L.hintNoTeam
    : dirty
      ? L.hintDirty
      : team.slots.every((s) => s.careerId === null)
        ? L.hintNoStarters
        : matchesLeft === 0
          ? L.hintNoMatches
          : null;
}

// ───────── 시즌 업적 ─────────
export const achDone = (items: ClubAchievement[]) => items.filter((i) => i.done).length;
/** 이름만으론 조건이 안 읽히는 업적의 안내. 미달성일 때만 붙는다. 조건은 api team/achievements.ts와 같이 고친다. */
const achHint = (id: string): string | undefined =>
  id === 'team-fit' ? L.achTeamFitHint : undefined;

/** 업적 한 줄의 오른쪽 표시. */
export function achState(i: ClubAchievement): string {
  if (i.level !== undefined)
    return (
      L.achLevel({ level: i.level, cur: `${num(i.cur ?? 0)}${i.unit ?? ''}` }) +
      (i.next != null ? L.achNext({ next: num(i.next) }) : L.achMaxLevel)
    );
  if (i.max !== undefined) return `${i.cur ?? 0} / ${i.max}`;
  if (i.done) return L.achDone;
  const hint = achHint(i.id);
  return hint ? L.achUndoneHint({ hint }) : L.achUndone;
}

/** 열린 단계 전체의 달성 수 · 업적 수(잠긴 단계는 빼고 센다). */
export function achTotal(groups: readonly ClubAchievementGroup[]): { done: number; total: number } {
  const items = groups.filter((g) => !g.locked).flatMap((g) => g.items);
  return { done: achDone(items), total: items.length };
}

export type AchNear = { group: string; item: ClubAchievement; ratio: number };
// T-11-028 같은 진행률이면 얻는 점수가 큰 것을 먼저 보인다.
/** 다음 목표에 가장 가까운 업적 n개 — 숫자로 진행을 셀 수 있는 것만(단계 업적은 다음 단계까지, 최고 단계는 뺀다). */
export function achNear(groups: readonly ClubAchievementGroup[], n = 3): AchNear[] {
  return groups
    .filter((g) => !g.locked)
    .flatMap((g) =>
      g.items.flatMap((item) => {
        const goal = item.level !== undefined ? item.next : item.done ? null : item.max;
        if (goal == null || item.cur === undefined) return [];
        return [{ group: g.title, item, ratio: Math.min(1, item.cur / goal) }];
      }),
    )
    .sort((a, b) => b.ratio - a.ratio || b.item.worth - a.item.worth)
    .slice(0, n);
}

/** 업적 한 줄의 점수 표시 — 얻은 점수가 있으면 '+30점', 아직 없으면 얻을 수 있는 점수 '50점'. */
export const achPoints = (i: ClubAchievement): string =>
  i.points > 0 ? L.achPointsGot({ n: num(i.points) }) : L.achPointsWorth({ n: num(i.worth) });

// T-11-028 업적 분류(선수·팀·구단주·감독)와 시즌 등급.
/** 업적 분류 이름(contracts의 한국어 이름 대신 지금 언어로). */
export const achCatName = (id: AchCategory): string =>
  ({ player: L.achCatPlayer, team: L.achCatTeam, owner: L.achCatOwner, manager: L.achCatManager })[
    id
  ];

/** 시즌 등급 이름(contracts의 한국어 이름 대신 지금 언어로). 모르는 등급이면 받은 이름 그대로. */
export const achGradeName = (g: { id: string; name: string }): string =>
  (
    ({
      rookie: L.gradeRookie,
      bronze: L.gradeBronze,
      silver: L.gradeSilver,
      gold: L.gradeGold,
      platinum: L.gradePlatinum,
      diamond: L.gradeDiamond,
      legend: L.gradeLegend,
    }) as Record<string, string>
  )[g.id] ?? g.name;

export type AchSection = {
  id: AchCategory;
  name: string;
  groups: ClubAchievementGroup[];
  score: number;
  done: number;
  total: number;
  /** 아직 열리지 않은 분류(감독 — 감독 시뮬레이션이 열리면 공개). */
  locked: boolean;
};

/** 분류별 묶음(선수 → 팀 → 구단주 → 감독). 지난 시즌에 팀이 없었으면 팀 분류는 빠진다. */
export function achSections(groups: readonly ClubAchievementGroup[]): AchSection[] {
  return ACH_CATEGORIES.flatMap((id) => {
    const gs = groups.filter((g) => g.category === id);
    if (!gs.length) return [];
    const items = gs.filter((g) => !g.locked).flatMap((g) => g.items);
    return [
      {
        id,
        name: achCatName(id),
        groups: gs,
        score: items.reduce((t, i) => t + i.points, 0),
        done: achDone(items),
        total: items.length,
        locked: gs.every((g) => g.locked),
      },
    ];
  });
}

export type AchGradeView = {
  grade: AchGrade;
  next: AchGrade | null;
  /** 다음 등급까지 남은 점수(맨 위면 0). */
  toNext: number;
  /** 지금 등급 안에서 다음 등급까지 온 비율(0–1, 맨 위면 1). */
  ratio: number;
};
export function achGradeView(score: number): AchGradeView {
  const { grade, next } = achGradeOf(score);
  if (!next) return { grade, next, toNext: 0, ratio: 1 };
  return {
    grade,
    next,
    toNext: next.min - score,
    ratio: (score - grade.min) / (next.min - grade.min),
  };
}

/** 업적 랭킹 순위 표시('12위 · 297명 중' / 점수가 없으면 안내). */
export const achRankText = (rank: number | null, ranked: number): string =>
  rank === null ? L.achRankNone : L.achRank({ rank: num(rank), ranked: num(ranked) });

/** 처음 펼쳐 둘 단계 — 아직 다 채우지 못한 첫 단계. */
export const achOpenGroup = (groups: readonly ClubAchievementGroup[]): string | null =>
  groups.find((g) => !g.locked && achDone(g.items) < g.items.length)?.id ?? null;

/** T-11-113 개막 뒤의 프리시즌 팀 — 지난 시즌이지만 친구 친선전용으로 고칠 수 있다. */
export const isPreseasonLegacy = (season: number, current: number | null) =>
  season === 0 && current !== 0;

/** 그 시즌 팀을 고칠 수 있는가: 지금 시즌 팀과 개막 뒤의 프리시즌 팀(친선전용). */
export const teamEditableIn = (season: number, current: number | null) =>
  season === current || isPreseasonLegacy(season, current);

/** 개막 뒤 프리시즌 팀 화면의 안내. */
export const preseasonTeamNote = () => L.preseasonTeamNote;

/** 팀 화면 '경기' 탭에서 경기를 막는 이유 — 휴식기 · 지난 시즌 · 그 밖은 playHintOf. */
export function matchHintOf(
  team: OwnerTeam | null,
  dirty: boolean,
  matchesLeft: number,
  season: number,
  current: number | null,
): string | null {
  if (current === null) return L.hintRest;
  if (isPreseasonLegacy(season, current)) return L.hintPreseason;
  if (season !== current) return L.hintPast;
  return playHintOf(team, dirty, matchesLeft);
}

// ───────── 경기 결과 ─────────
export type Outcome = '승' | '무' | '패';
export const outcomeOf = (m: TeamMatch): Outcome => {
  const mine = m[m.mine].goals;
  const theirs = m[m.mine === 'home' ? 'away' : 'home'].goals;
  return mine > theirs ? '승' : mine < theirs ? '패' : '무';
};
/** 결과 이름(승리 · 무승부 · 패배). 읽을 때마다 지금 언어로 고른다. */
export const OUTCOME_TITLE = {
  get 승() {
    return L.titleWin;
  },
  get 무() {
    return L.titleDraw;
  },
  get 패() {
    return L.titleLoss;
  },
} as const;
/** 결과 한 글자(승 · 무 · 패). Outcome 값 자체는 식별자라 한국어 그대로 두고 화면에만 이 표기를 쓴다. */
export const outcomeLabel = (o: Outcome): string =>
  o === '승' ? L.outWin : o === '패' ? L.outLoss : L.outDraw;
export const pct = (f: number) => `${Math.round(f * 100)}%`;

/** 업적 분류의 짧은 이름(탭 글자) — 선수 · 팀 · 구단주 · 감독. */
export const achCatShort = (id: AchCategory): string =>
  ({
    player: L.achCatShortPlayer,
    team: L.achCatShortTeam,
    owner: L.achCatShortOwner,
    manager: L.achCatShortManager,
  })[id];
