// T-11-648 감독 커리어 3 경기: 일정(원형 방식), 선발 추천, 줄 힘, 푸아송 득점, 순위표.
import type { ManagerStyle } from '@offside/contracts/manager-rules';
import {
  M3_FORMATION_ROLES,
  M3_GOAL_BASE,
  M3_GOAL_K,
  M3_HOME_EDGE,
  M3_MENTALITY,
  M3_ROLE_GROUP,
  M3_ROLE_LINES,
  type M3Attrs,
  type M3Formation,
  type M3Lines,
  type M3Plan,
  type M3Role,
} from './rules.js';
import { clamp, clubsOf, gauss, leagueOf, type R } from './people.js';
import type { M3Club, M3Fixture, M3Player, M3TableRow } from './types.js';

// ───────── 일정 · 순위표 ─────────

/** 이번 시즌 리그 참가 구단: 리그 데이터의 구단 + 내 구단(다른 리그 출신이면 더한다). */
export function leagueClubs(club: M3Club): { id: string; name: string; str: number }[] {
  const others = clubsOf(club.leagueId)
    .filter((c) => c.id !== club.id)
    .map((c) => ({ id: c.id, name: c.name, str: c.str }));
  return [...others, { id: club.id, name: club.name, str: club.base }];
}

/** 원형 방식 일정. 라운드 수는 리그 경기 수, 한 바퀴가 끝나면 홈 · 원정을 바꿔 다시 돈다. 홀수면 쉬는 팀이 생긴다. */
export function makeFixtures(ids: readonly string[], rounds: number): M3Fixture[][] {
  const list: (string | null)[] = [...ids];
  if (list.length % 2) list.push(null);
  const n = list.length;
  // 한 바퀴(n-1 라운드)를 원형 방식으로 만든다. 고정 자리 경기는 라운드마다, 나머지는 자리마다 홈을 번갈아 준다.
  const base: M3Fixture[][] = [];
  const rot = list.slice(1);
  for (let k = 0; k < n - 1; k++) {
    const order = [list[0] ?? null, ...rot];
    const round: M3Fixture[] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = order[i] ?? null;
      const b = order[n - 1 - i] ?? null;
      if (a === null || b === null) continue;
      const flip = i === 0 ? k % 2 === 1 : i % 2 === 1;
      round.push(flip ? { home: b, away: a } : { home: a, away: b });
    }
    base.push(round);
    rot.unshift(rot.pop()!);
  }
  // 두 번째 바퀴는 홈 · 원정을 뒤집어 두 바퀴마다 홈 경기 수가 같아지게 한다.
  return Array.from({ length: rounds }, (_, k) => {
    const round = base[k % (n - 1)]!;
    return Math.floor(k / (n - 1)) % 2
      ? round.map((m) => ({ home: m.away, away: m.home }))
      : round.map((m) => ({ ...m }));
  });
}

export function emptyTable(clubs: { id: string; name: string; str: number }[]): M3TableRow[] {
  return clubs.map((c) => ({
    clubId: c.id,
    name: c.name,
    str: c.str,
    p: 0,
    w: 0,
    d: 0,
    l: 0,
    gf: 0,
    ga: 0,
    pts: 0,
  }));
}

export function sortTable(t: M3TableRow[]): M3TableRow[] {
  return [...t].sort(
    (a, b) =>
      b.pts - a.pts || b.gf - b.ga - (a.gf - a.ga) || b.gf - a.gf || a.name.localeCompare(b.name),
  );
}
export const rankOf = (t: M3TableRow[], id: string) =>
  sortTable(t).findIndex((x) => x.clubId === id) + 1;

export function record(t: M3TableRow[], home: string, away: string, hg: number, ag: number) {
  const h = t.find((x) => x.clubId === home);
  const a = t.find((x) => x.clubId === away);
  if (!h || !a) return;
  h.p++;
  a.p++;
  h.gf += hg;
  h.ga += ag;
  a.gf += ag;
  a.ga += hg;
  if (hg > ag) {
    h.w++;
    a.l++;
    h.pts += 3;
  } else if (hg < ag) {
    a.w++;
    h.l++;
    a.pts += 3;
  } else {
    h.d++;
    a.d++;
    h.pts++;
    a.pts++;
  }
}

// ───────── 선발 · 줄 힘 ─────────

/** 역할이 다를 때 깎는 값: 같은 무리 −4, 이웃 무리 −10, 골키퍼 자리 · 골키퍼가 필드에 서면 −25. */
export function roleGap(p: Pick<M3Player, 'role'>, slot: M3Role): number {
  if (p.role === slot) return 0;
  const a = M3_ROLE_GROUP[p.role];
  const b = M3_ROLE_GROUP[slot];
  if (a === 'GK' || b === 'GK') return 25;
  if (a === b) return 4;
  const order = ['DF', 'MF', 'FW'];
  return Math.abs(order.indexOf(a) - order.indexOf(b)) === 1 ? 10 : 18;
}

/** 그 자리에서의 실제 힘: OVR − 역할 차 + 사기 − 피로. */
export const slotRating = (p: M3Player, slot: M3Role) =>
  p.ovr - roleGap(p, slot) + (p.morale - 50) / 12 - (100 - p.fit) / 12;

export const available = (p: M3Player) => p.inj === 0;

/** 자동 추천 선발: 자리마다 남은 선수 중 가장 잘 맞는 선수(골키퍼부터). 뛸 선수가 모자라면 비운다(−1). */
export function autoLineup(
  squad: readonly M3Player[],
  formation: M3Formation,
  minFit = 0,
): number[] {
  const roles = M3_FORMATION_ROLES[formation];
  const used = new Set<number>();
  const out: number[] = Array(roles.length).fill(-1);
  // 자리를 찾기 쉬운 순서(골키퍼 → 수비 → 공격 → 중원)로 채워 특화 선수를 먼저 쓴다.
  const order = roles
    .map((role, i) => ({ role, i }))
    .sort((a, b) => 'GKCBFBSTWGDMAMCM'.indexOf(a.role) - 'GKCBFBSTWGDMAMCM'.indexOf(b.role));
  for (const { role, i } of order) {
    let best: M3Player | null = null;
    for (const p of squad) {
      if (used.has(p.id) || !available(p) || p.fit < minFit) continue;
      if (!best || slotRating(p, role) > slotRating(best, role)) best = p;
    }
    if (best) {
      used.add(best.id);
      out[i] = best.id;
    }
  }
  return out;
}

/**
 * 이번 경기 선발: 직접 고른 선발에서 다쳤거나 많이 지친(컨디션 55 아래) 선수만 벤치의 가장 잘 맞는 선수로 바꾼다.
 */
export function matchLineup(squad: readonly M3Player[], plan: M3Plan): number[] {
  const roles = M3_FORMATION_ROLES[plan.formation];
  const base = plan.lineup && plan.lineup.length === roles.length ? plan.lineup : null;
  if (!base) return autoLineup(squad, plan.formation, 55);
  const byId = new Map(squad.map((p) => [p.id, p]));
  const used = new Set<number>();
  const out = base.map((id) => {
    const p = byId.get(id);
    if (p && available(p) && p.fit >= 55 && !used.has(id)) {
      used.add(id);
      return id;
    }
    return -1;
  });
  out.forEach((id, i) => {
    if (id !== -1) return;
    let best: M3Player | null = null;
    for (const p of squad) {
      if (used.has(p.id) || !available(p)) continue;
      if (!best || slotRating(p, roles[i]!) > slotRating(best, roles[i]!)) best = p;
    }
    if (best) {
      used.add(best.id);
      out[i] = best.id;
    }
  });
  return out;
}

const zero = (): M3Lines => ({ atk: 0, mid: 0, def: 0, gk: 0 });

/** 선발로 본 순수 줄 힘(빈자리는 유스 수준 40). */
export function lineupLines(
  squad: readonly M3Player[],
  lineup: readonly number[],
  formation: M3Formation,
): M3Lines {
  const roles = M3_FORMATION_ROLES[formation];
  const byId = new Map(squad.map((p) => [p.id, p]));
  const sum = zero();
  const w = zero();
  roles.forEach((role, i) => {
    const p = byId.get(lineup[i] ?? -1);
    const rating = p ? slotRating(p, role) : 40;
    for (const [k, v] of Object.entries(M3_ROLE_LINES[role]) as [keyof M3Lines, number][]) {
      sum[k] += rating * v;
      w[k] += v;
    }
  });
  return {
    atk: sum.atk / (w.atk || 1),
    mid: sum.mid / (w.mid || 1),
    def: sum.def / (w.def || 1),
    gk: sum.gk / (w.gk || 1),
  };
}

/** 감독 · 전술이 더하는 값(능력치 · 익숙함 · 성향 · 지시 · 구간 보정). */
export function tacticLines(plan: M3Plan, attrs: M3Attrs, fam: number, form: number): M3Lines {
  const m = M3_MENTALITY[plan.mentality as ManagerStyle];
  const famB = (fam - 50) / 40;
  const press = plan.press - 1;
  const line = plan.line - 1;
  const tempo = plan.tempo - 1;
  return {
    atk:
      (attrs.atk - 40) / 15 + famB + (m.atk ?? 0) + press * 0.3 + line * 0.8 + tempo * 0.7 + form,
    mid: (attrs.tac - 40) / 25 + famB + (m.mid ?? 0) + press * 0.4 - tempo * 0.4 + form,
    def: (attrs.def - 40) / 15 + famB + (m.def ?? 0) + press * 0.8 - line * 0.6 + form,
    gk: (attrs.def - 40) / 30,
  };
}

export const addL = (a: M3Lines, b: M3Lines): M3Lines => ({
  atk: a.atk + b.atk,
  mid: a.mid + b.mid,
  def: a.def + b.def,
  gk: a.gk + b.gk,
});
export const flatLines = (v: number): M3Lines => ({ atk: v, mid: v, def: v, gk: v });

function poisson(r: R, l: number): number {
  if (l <= 0) return 0;
  const L = Math.exp(-l);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= r();
  } while (p > L);
  return k - 1;
}

/** 두 팀 줄 힘으로 한 경기 득점. home은 a가 홈인지(null이면 중립). tempo는 양쪽 득점을 함께 키운다. */
export function playMatch(
  r: R,
  a: M3Lines,
  b: M3Lines,
  home: boolean | null,
  tempo = 1,
): [number, number] {
  const formA = gauss(r) * 1.5;
  const formB = gauss(r) * 1.5;
  const defA = a.def * 0.8 + a.gk * 0.2;
  const defB = b.def * 0.8 + b.gk * 0.2;
  const edge = home === null ? 0 : home ? M3_HOME_EDGE / 2 : -M3_HOME_EDGE / 2;
  const pace = 1 + (tempo - 1) * 0.08;
  const lA =
    M3_GOAL_BASE *
    pace *
    Math.exp((0.6 * (a.atk - defB) + 0.4 * (a.mid - b.mid) + formA - formB) / M3_GOAL_K + edge);
  const lB =
    M3_GOAL_BASE *
    pace *
    Math.exp((0.6 * (b.atk - defA) + 0.4 * (b.mid - a.mid) + formB - formA) / M3_GOAL_K - edge);
  return [poisson(r, clamp(lA, 0.1, 6)), poisson(r, clamp(lB, 0.1, 6))];
}

/** 다른 구단끼리 경기(전력 + 시즌 흔들림만). */
export const clubLines = (str: number) => flatLines(str);

/** 리그 평균(상대 구단 전력의 기준). */
export const leagueAvg = (leagueId: string) => leagueOf(leagueId).avg;
