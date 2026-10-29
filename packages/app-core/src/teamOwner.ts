// T-10-092 구단주 팀 화면의 순수 로직(웹 team/Team.svelte · 앱 screens/owner/Team.tsx 공용, T-11-005).
// 편성(자동 배치·자리 바꾸기)·선수 고르기 후보·업적 표기·경기 결과 표기처럼 화면이 그리기 전에 계산하는 것만 둔다.
import { leagueFatiguePenalty } from '@offside/contracts/league';
import { flagOf } from '@offside/contracts/nations';
import { defaultClubName, LEAGUE_BASE } from '@offside/contracts/club-names';
import { FACE_ABBR, GK_ABBR } from '@offside/game/attributes';
import { ATTR_KEYS } from '@offside/game/data';
import {
  ACH_CATEGORIES,
  LINEUP_SIZE,
  PAST_SALARY_BUDGET,
  YOUTH_OVR,
  seasonSalaryOf,
  achGradeAt,
  achGradeCutoff,
  achTierByRank,
  type AchStanding,
  DUOS,
  FOOT_BONUS,
  FOOT_BONUS_BOTH,
  CLUB_EFFECT,
  HOMEGROWN_EFFECT,
  LEAGUE_STYLES,
  NATIONAL_POWER,
  nationStyle,
  TEAM_RULES,
  lineStrength,
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
import { tn } from '@offside/game/i18n/names';
import { num, signedNum } from './teamText.js';
import { teamCoreText as L } from './i18n/ko/teamCore.js';
import { teamHomeText as TH } from './i18n/ko/teamHome.js';
import { teamSynergyText as SY } from './i18n/ko/teamSynergy.js';

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

// T-11-376 지난 시즌 선수 급여 예산(docs/tracking/salary-cap-plan.md). 이번 시즌 선수는 급여가 없고, 지난 시즌 선수는 카드
// 최고 OVR로 정한 급여(1~20)의 합이 예산 안이어야 한다. 예산은 서버 응답(pastSalaryBudget), 없으면 기본값.
export const budgetOf = (res: { pastSalaryBudget?: number | undefined } | null | undefined) =>
  res?.pastSalaryBudget ?? PAST_SALARY_BUDGET;
// T-11-571 리그 체력(docs/tracking/league-fatigue-plan.md). 서버가 켰을 때만 응답에 온다.
export type LeagueFatigue = { rate: number; streaks: Record<string, number> };
/** 다음 리그 경기에 선발로 나가면 깎이는 자리 실력(%). 0이면 문제없다. */
export const fatiguePctOf = (f: LeagueFatigue | null | undefined, careerId: string) =>
  f ? Math.round(leagueFatiguePenalty(f.streaks[careerId] ?? 0, f.rate) * 100) : 0;
/** 이 팀 시즌에서 카드가 받는 급여(이번 시즌 선수는 0). */
export const salaryIn = (p: Pick<TeamPlayer, 'peak' | 'season'>, season: number) =>
  seasonSalaryOf(p, season);
/** 선발에 든 지난 시즌 선수 급여 합. */
export const pastSalaryIn = (
  slots: readonly (string | null)[],
  byId: ReadonlyMap<string, TeamPlayer>,
  season: number,
) =>
  slots.reduce((sum, id) => {
    const p = id ? byId.get(id) : undefined;
    return sum + (p ? salaryIn(p, season) : 0);
  }, 0);
/** 예산을 넘는 선발인지(자리 바꾸기는 합이 그대로라 괜찮다). */
export const overSalaryBudget = (
  slots: readonly (string | null)[],
  byId: ReadonlyMap<string, TeamPlayer>,
  season: number,
  budget: number,
) => pastSalaryIn(slots, byId, season) > budget;
/** 편성을 바꿀 때 막을지: 바꾼 뒤 예산을 넘고 급여 합이 늘어날 때만(예산을 내린 뒤의 옛 선발도 줄이는 쪽은 허용). */
export const salaryBlocks = (
  prev: readonly (string | null)[],
  next: readonly (string | null)[],
  byId: ReadonlyMap<string, TeamPlayer>,
  season: number,
  budget: number,
) => {
  const after = pastSalaryIn(next, byId, season);
  return after > budget && after > pastSalaryIn(prev, byId, season);
};
export type SalaryState = 'ok' | 'near' | 'full' | 'over';
/** 급여 막대 색: 80% 이상이면 near, 딱 맞으면 full, 넘으면 over(예산을 내린 뒤의 옛 선발). */
export const salaryState = (sum: number, budget: number): SalaryState =>
  sum > budget ? 'over' : sum === budget ? 'full' : sum >= budget * 0.8 ? 'near' : 'ok';
/** 편성 화면 급여 막대 — 앞 시즌이 없는 프리시즌은 null. */
export function salaryBar(
  slots: readonly (string | null)[],
  byId: ReadonlyMap<string, TeamPlayer>,
  season: number,
  budget: number,
): { sum: number; budget: number; left: number; state: SalaryState; label: string } | null {
  if (season <= 0) return null;
  const sum = pastSalaryIn(slots, byId, season);
  return {
    sum,
    budget,
    left: Math.max(0, budget - sum),
    state: salaryState(sum, budget),
    label: L.salaryBar({ n: sum, max: budget }),
  };
}
/** 고르기 목록에서 이 선수를 빈 자리에 더하면 예산을 넘는지(선발에 이미 든 선수 · 이번 시즌 선수는 false). */
export const salaryWontFit = (
  p: TeamPlayer,
  slots: readonly (string | null)[],
  byId: ReadonlyMap<string, TeamPlayer>,
  season: number,
  budget: number,
) =>
  !slots.includes(p.careerId) && pastSalaryIn(slots, byId, season) + salaryIn(p, season) > budget;
/** 넣으면 예산을 넘을 때 안내 — 넣으려던 선수의 급여와 그 자리를 뺀 남은 예산. */
export function salaryFullText(
  next: readonly (string | null)[],
  id: string | null,
  byId: ReadonlyMap<string, TeamPlayer>,
  season: number,
  budget: number,
) {
  const p = id ? byId.get(id) : undefined;
  const salary = p ? salaryIn(p, season) : 0;
  const left = budget - (pastSalaryIn(next, byId, season) - salary);
  return L.salaryFull({ salary, left: Math.max(0, left) });
}

/** 실력이 같으면 먼저 채울 자리(스트라이커·골키퍼·센터백 …). */
const FILL_ORDER = ['ST', 'GK', 'CB', 'CM', 'AM', 'DM', 'W', 'FB'];
/** 예산이 빠듯할 때 지난 시즌 선수 급여에 매기는 벌점(OVR / 급여 1). 0이면 예산 안에서 가장 센 선수부터 채운다. */
const SALARY_PENALTIES = [0, 0.1, 0.2, 0.3, 0.5, 0.75, 1, 1.5, 2, 3, 5, 10];

/** 자리마다 점수(자리 OVR - 벌점 × 급여)가 가장 높은 선수부터 채운다(유스 선수보다 나을 때만, 남은 예산 안에서만). */
function greedyFill(
  order: readonly { slot: DetailPos; i: number }[],
  players: readonly TeamPlayer[],
  salaries: ReadonlyMap<string, number>,
  budget: number,
  penalty: number,
): { slots: (string | null)[]; total: number } {
  const next: (string | null)[] = Array(LINEUP_SIZE).fill(null);
  const used = new Set<string>();
  let spent = 0;
  for (;;) {
    let best: { i: number; id: string; r: number; score: number } | null = null;
    for (const { slot, i } of order) {
      if (next[i] !== null) continue;
      for (const p of players) {
        if (used.has(p.careerId)) continue;
        const salary = salaries.get(p.careerId) ?? 0;
        if (spent + salary > budget) continue;
        const r = slotRating(slot, p);
        const score = r - penalty * salary;
        if (r > YOUTH_OVR && score > YOUTH_OVR && (!best || score > best.score))
          best = { i, id: p.careerId, r, score };
      }
    }
    if (!best) break;
    next[best.i] = best.id;
    used.add(best.id);
    spent += salaries.get(best.id) ?? 0;
  }
  const total = order.reduce((sum, { slot, i }) => {
    const p = next[i] ? players.find((x) => x.careerId === next[i]) : undefined;
    return sum + (p ? slotRating(slot, p) : YOUTH_OVR);
  }, 0);
  return { slots: next, total };
}

/**
 * 자리마다 가장 잘 맞는 선수부터 채운다(유스 선수보다 나을 때만). T-11-376 지난 시즌 선수는 급여 합이 예산 안에서만 —
 * 급여 벌점을 몇 단계로 바꿔 가며 채워 보고 자리 OVR 합이 가장 높은 선발을 고른다. 예산이 넉넉하면 벌점 0(제한 없음)과 같다.
 */
export function autoFillSlots(
  slotCodes: readonly DetailPos[],
  players: readonly TeamPlayer[],
  season: number,
  budget = PAST_SALARY_BUDGET,
): (string | null)[] {
  const order = slotCodes
    .map((slot, i) => ({ slot, i }))
    .sort((a, b) => FILL_ORDER.indexOf(a.slot) - FILL_ORDER.indexOf(b.slot));
  const salaries = new Map(players.map((p) => [p.careerId, salaryIn(p, season)]));
  const anyPast = [...salaries.values()].some((s) => s > 0);
  let best: { slots: (string | null)[]; total: number } | null = null;
  for (const penalty of anyPast ? SALARY_PENALTIES : [0]) {
    const run = greedyFill(order, players, salaries, budget, penalty);
    if (!best || run.total > best.total) best = run;
  }
  return best!.slots;
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
/** 시너지 효과 표기 — '공격 +2 · 중원 +0.5'. 효과가 비면(배지) '경기 효과 없음'. */
export const synergyEffectText = (effect: Partial<SynergyLines>): string =>
  (Object.keys(SYN_LABEL) as (keyof SynergyLines)[])
    .filter((k) => effect[k])
    .map((k) => `${TH[SYN_LABEL[k]]} ${signedNum(effect[k]!)}`)
    .join(' · ') || SY.noEffect;
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
  /** 경기 효과가 실제로 들어가는 시너지(배지는 아니다). 켜진 것은 모두 함께 적용된다. */
  applied: boolean;
};
/** 경기 효과가 실제로 들어가는지 — 주발 맞춤은 자리 실력 보정, 나머지는 더한 줄 힘. */
const synergyApplied = (s: TeamSynergy, a: ActiveSynergy): boolean =>
  a.kind === 'badge'
    ? false
    : a.kind === 'foot'
      ? s.foot.some((b) => b > 0)
      : Object.values(a.effect).some((v) => (v ?? 0) > 0);
/** T-11-467 리그 컬러 · 클럽 동료 칩에 붙이는 리그 · 클럽 이름(저장값은 한국어 이름, 그릴 때 옮긴다). */
const leagueName = (id: string) => tn(LEAGUE_BASE.find((l) => l.id === id)?.name ?? id);
const clubName = (id: string) => tn(defaultClubName(id) ?? id);
/** 편성 화면의 시너지 칩(웹·앱 공용). 주발 맞춤은 인원과 자리 실력 보정 합을 보인다. */
export const synergyChips = (s: TeamSynergy): SynergyChip[] =>
  s.active.map((a) => {
    const [name, desc] = synergyText(a.id, a.name, a.desc);
    return {
      id: a.id,
      name:
        a.kind === 'foot'
          ? SY.footChip({ name, n: a.members.length })
          : a.nation
            ? SY.nationalChip({
                name,
                flag: flagOf(a.nation),
                style: SY.styleName({ id: a.style!, ko: nationStyle(a.nation).name }),
              })
            : a.league
              ? SY.leagueChip({
                  name,
                  league: leagueName(a.league),
                  style: SY.styleName({ id: a.style!, ko: LEAGUE_STYLES[a.league]?.name ?? '' }),
                })
              : a.club
                ? SY.clubChip({ name, club: clubName(a.club), n: a.members.length })
                : name,
      desc,
      effect:
        a.kind === 'foot'
          ? SY.fitEffect({ v: signedNum(s.foot.reduce((t, b) => t + b, 0)) })
          : synergyEffectText(a.effect),
      badge: a.kind === 'badge',
      applied: synergyApplied(s, a),
    };
  });
/**
 * 그라운드 시너지 표시(웹·앱 공용). 켜진 시너지는 고른 칩과 상관없이 모두 적용되므로, 효과가 들어가는 듀오 · 주발 맞춤의
 * 선수(applied)는 늘 점으로 표시하고 칩을 고르면(id) 그 시너지의 선 · 선수만 더 굵게 보여 준다. 팀 색깔(우리가 키운 팀)은
 * 선발 대부분이라 점을 찍지 않고 caption 개수에만 든다. caption은 그라운드 아래 한 줄.
 */
export function synergyFocus(s: TeamSynergy, id: string | null) {
  const on = s.active.filter((a) => synergyApplied(s, a));
  const picked = s.active.find((a) => a.id === id);
  const n = on.length;
  return {
    links: s.active
      .filter((a) => a.kind === 'duo')
      .map((a) => ({ members: a.members, on: a.id === id })),
    members: picked?.members ?? null,
    applied: [...new Set(on.filter((a) => a.kind !== 'team').flatMap((a) => a.members))].sort(
      (a, b) => a - b,
    ),
    caption:
      n === 0
        ? null
        : picked
          ? SY.pitchFocus({ name: synergyText(picked.id, picked.name, picked.desc)[0], n })
          : SY.pitchAll({ n }),
  };
}
/** 시너지 목록의 한 줄 — 적용 중(효과가 들어감) · 효과 없음(켜졌지만 배지이거나 상한) · 미적용(조건 미달). */
export type SynergyState = 'applied' | 'noEffect' | 'off';
export type SynergyRow = SynergyChip & { state: SynergyState };
const STATE_RANK: Record<SynergyState, number> = { applied: 0, noEffect: 1, off: 2 };
/**
 * 편성 화면의 시너지 목록(웹·앱 공용). 규칙 전부를 숨김 없이 보이고 적용 중 → 효과 없음 → 미적용 순으로 둔다(같은 상태는 표 순서).
 * 켜진 것은 실제 효과, 미적용은 규칙 효과를 보인다. 언어를 바꾸면 다시 만들어야 해서 함수다.
 */
export function synergyRows(s: TeamSynergy): SynergyRow[] {
  const on = new Map(synergyChips(s).map((c) => [c.id, c]));
  const rules: (readonly [{ id: string; name: string; desc: string }, string])[] = [
    ...DUOS.map((d) => [d, synergyEffectText(d.effect)] as const),
    [TEAM_RULES.homegrown, synergyEffectText(HOMEGROWN_EFFECT)],
    [TEAM_RULES.national, SY.nationalVaries({ sum: signedNum(NATIONAL_POWER) })],
    [TEAM_RULES.league, SY.leagueVaries({ sum: signedNum(NATIONAL_POWER) })],
    [TEAM_RULES.club, synergyEffectText(CLUB_EFFECT)],
    [
      TEAM_RULES.foot,
      SY.fitEffectBoth({ v: signedNum(FOOT_BONUS), both: signedNum(FOOT_BONUS_BOTH) }),
    ],
  ];
  return rules
    .map(([r, effect]): SynergyRow => {
      const c = on.get(r.id);
      if (c) return { ...c, state: c.applied ? 'applied' : 'noEffect' };
      const [name, desc] = synergyText(r.id, r.name, r.desc);
      return {
        id: r.id,
        name,
        desc,
        effect,
        badge: false,
        applied: false,
        state: 'off',
      };
    })
    .sort((x, y) => STATE_RANK[x.state] - STATE_RANK[y.state]);
}

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
  id === 'team-fit'
    ? L.achTeamFitHint
    : id === 'one-club'
      ? L.achOneClubHint
      : id === 'long-service'
        ? L.achLongServiceHint
        : undefined;

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

/** T-11-180 모음 업적에서 아직 못 모은 이름 한 줄(없으면 null). */
export const achMissing = (i: ClubAchievement): string | null =>
  i.missing?.length ? L.achMissing({ names: i.missing.map(tn).join(' · ') }) : null;

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

/** T-11-357 업적 보상 아이템 이름(잠재력 강화권 · 프리미엄 스카우트권). 없으면 빈 문자열. */
export const achRewardItems = (r: { boost: number; scout: number }): string =>
  [
    r.boost > 0 ? L.achRewardBoost({ n: r.boost }) : '',
    r.scout > 0 ? L.achRewardScout({ n: r.scout }) : '',
  ]
    .filter(Boolean)
    .join(' · ');

/** T-11-357 업적 한 줄의 보상 표시 — 받은 보상과 다음 달성 보상(지금 시즌만 붙는다). 없으면 null. */
export function achReward(i: ClubAchievement): string | null {
  const parts = [
    i.got ? L.achRewardGot({ items: achRewardItems(i.got) }) : '',
    i.reward ? L.achRewardNext({ items: achRewardItems(i.reward) }) : '',
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

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
  /** T-11-489 true면 등급이 상위 비율 기준이라 toNext가 점수가 아니라 올라야 할 순위 수다. */
  byRank: boolean;
  /** 다음 등급까지 남은 점수(상위 비율 시즌은 순위 수, 맨 위면 0). */
  toNext: number;
  /** 지금 등급 안에서 다음 등급까지 온 비율(0–1, 맨 위면 1). */
  ratio: number;
};
export function achGradeView(s: AchStanding): AchGradeView {
  const { grade, next, nextRank } = achGradeAt(s);
  const byRank = achTierByRank(s.season);
  if (!next) return { grade, next, byRank, toNext: 0, ratio: 1 };
  if (!byRank)
    return {
      grade,
      next,
      byRank,
      toNext: next.min - s.score,
      ratio: (s.score - grade.min) / (next.min - grade.min),
    };
  // 순위가 없으면(점수 0) 랭킹 끝 다음 자리에서 센다.
  const rank = s.rank ?? s.ranked + 1;
  const floor = grade.id === 'rookie' ? s.ranked + 1 : achGradeCutoff(grade.id, s.ranked);
  const top = nextRank ?? 1;
  const span = floor - top;
  return {
    grade,
    next,
    byRank,
    toNext: Math.max(1, rank - top),
    ratio: span > 0 ? Math.min(1, Math.max(0, (floor - rank) / span)) : 0,
  };
}

/** 업적 랭킹 순위 표시('12위 · 297명 중' / 점수가 없으면 안내). */
export const achRankText = (rank: number | null, ranked: number): string =>
  rank === null ? L.achRankNone : L.achRank({ rank: num(rank), ranked: num(ranked) });

/** T-11-113 개막 뒤의 프리시즌 팀 — 지난 시즌이지만 친구 친선전용으로 고칠 수 있다. */
export const isPreseasonLegacy = (season: number, current: number | null) =>
  season === 0 && current !== 0;

/**
 * 그 시즌 팀을 고칠 수 있는가: 지금 시즌 팀과 개막 뒤의 프리시즌 팀(친선전용). T-11-552 끝나지 않은 컵에 참가 중인 지난
 * 시즌 팀(cupSeason, 서버가 알려 준다)은 컵이 끝날 때까지 컵 명단으로 고친다.
 */
export const teamEditableIn = (season: number, current: number | null, cupSeason?: number | null) =>
  season === current || isPreseasonLegacy(season, current) || (season > 0 && season === cupSeason);

/** T-11-552 컵에 참가 중인 지난 시즌 팀 화면의 안내. */
export const cupTeamNote = (season: string) => L.cupTeamNote({ season });
/** T-11-552 지금 시즌 팀 화면에서 컵에 참가 중인 지난 시즌 팀으로 가는 버튼. */
export const cupTeamLink = (season: string) => L.cupTeamLink({ season });

/** 개막 뒤 프리시즌 팀 화면의 안내. */
export const preseasonTeamNote = () => L.preseasonTeamNote;

/** 팀 화면 '경기' 탭에서 경기를 막는 이유 — 휴식기 · 지난 시즌 · 그 밖은 playHintOf. */
export function matchHintOf(
  team: OwnerTeam | null,
  dirty: boolean,
  matchesLeft: number,
  season: number,
  current: number | null,
  cupSeason?: number | null,
): string | null {
  if (current === null) return L.hintRest;
  if (isPreseasonLegacy(season, current)) return L.hintPreseason;
  if (season > 0 && season === cupSeason) return L.hintCupTeam;
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

/** 업적 분류의 짧은 이름(탭 글자) — 선수 · 팀 · 구단주 · 감독. */
export const achCatShort = (id: AchCategory): string =>
  ({
    player: L.achCatShortPlayer,
    team: L.achCatShortTeam,
    owner: L.achCatShortOwner,
    manager: L.achCatShortManager,
  })[id];
