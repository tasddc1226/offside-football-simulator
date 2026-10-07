import { CUP_POINTS, type CupRound } from '@offside/contracts/cup';

// T-11-145 오프사이드 컵의 순수 규칙: 조 추첨 · 조별 일정 · 순위 · 토너먼트 대진. DB를 모른다(cup.ts가 읽고 쓴다).

/** 문자열 시드 → [0,1) 난수(FNV-1a + mulberry32). 추첨은 서버 비공개 시드로 한 번만 한다. */
export function rngFrom(seed: string): () => number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(xs: readonly T[], rng: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * 조 추첨. OVR 높은 순으로 포트를 나눠(조 수만큼씩) 포트마다 섞어 조 1..g에 한 팀씩 넣는다 — 센 팀끼리 한 조에 몰리지 않는다.
 * 돌려주는 값: teamId → 조 번호(1부터).
 */
export function drawGroups(
  teams: readonly { teamId: string; ovr: number }[],
  groups: number,
  seed: string,
): Map<string, number> {
  const rng = rngFrom(`${seed}:draw`);
  // 같은 OVR은 시드로 섞인 순서를 따른다(입력 순서에 기대지 않는다).
  const sorted = shuffle(teams, rng).sort((a, b) => b.ovr - a.ovr);
  const out = new Map<string, number>();
  for (let p = 0; p * groups < sorted.length; p++) {
    const pot = shuffle(sorted.slice(p * groups, (p + 1) * groups), rng);
    // 포트마다 조 순서도 섞어, 마지막 포트(덜 찬 포트)가 늘 앞 조에만 가지 않게 한다.
    const order = shuffle(
      Array.from({ length: groups }, (_, i) => i + 1),
      rng,
    );
    pot.forEach((t, i) => out.set(t.teamId, order[i]!));
  }
  return out;
}

/**
 * 조 안 풀리그 일정(3라운드). 4팀: 라운드마다 2경기. 3팀: 라운드마다 1경기(한 팀 휴식). 2팀: 1라운드에만 1경기.
 * 돌려주는 값: 라운드 0..2별 [홈, 원정] 쌍.
 */
export function groupFixtures(teamIds: readonly string[]): [string, string][][] {
  const t = teamIds;
  if (t.length === 4)
    return [
      [
        [t[0]!, t[3]!],
        [t[1]!, t[2]!],
      ],
      [
        [t[2]!, t[0]!],
        [t[3]!, t[1]!],
      ],
      [
        [t[0]!, t[1]!],
        [t[2]!, t[3]!],
      ],
    ];
  if (t.length === 3) return [[[t[0]!, t[1]!]], [[t[2]!, t[0]!]], [[t[1]!, t[2]!]]];
  if (t.length === 2) return [[[t[0]!, t[1]!]], [], []];
  return [[], [], []];
}

export type PlayedGroupMatch = {
  home: string;
  away: string;
  homeGoals: number;
  awayGoals: number;
};

export type Standing = {
  teamId: string;
  p: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  pts: number;
  rank: number;
};

/**
 * 조 순위. 승점 → 득실 → 다득점 → (두 팀만 같으면) 승자승 → 추첨 시드. 경기 전이면 모두 0이고 시드 순서다.
 */
export function groupStandings(
  teamIds: readonly string[],
  matches: readonly PlayedGroupMatch[],
  seed: string,
): Standing[] {
  const s = new Map<string, Standing>(
    teamIds.map((id) => [
      id,
      { teamId: id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, rank: 0 },
    ]),
  );
  for (const m of matches) {
    const h = s.get(m.home);
    const a = s.get(m.away);
    if (!h || !a) continue;
    h.p++;
    a.p++;
    h.gf += m.homeGoals;
    h.ga += m.awayGoals;
    a.gf += m.awayGoals;
    a.ga += m.homeGoals;
    if (m.homeGoals > m.awayGoals) {
      h.w++;
      a.l++;
    } else if (m.homeGoals < m.awayGoals) {
      a.w++;
      h.l++;
    } else {
      h.d++;
      a.d++;
    }
  }
  for (const x of s.values()) x.pts = x.w * CUP_POINTS.win + x.d * CUP_POINTS.draw;
  const rng = rngFrom(`${seed}:tiebreak`);
  const lot = new Map(teamIds.map((id) => [id, rng()]));
  const key = (x: Standing) => [x.pts, x.gf - x.ga, x.gf] as const;
  const same = (a: Standing, b: Standing) => key(a).every((v, i) => v === key(b)[i]);
  const h2h = (a: Standing, b: Standing) => {
    let d = 0;
    for (const m of matches) {
      if (m.home === a.teamId && m.away === b.teamId) d += m.homeGoals - m.awayGoals;
      if (m.home === b.teamId && m.away === a.teamId) d += m.awayGoals - m.homeGoals;
    }
    return d;
  };
  const list = [...s.values()];
  const sorted = list.sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return kb[i]! - ka[i]!;
    // 승자승은 정확히 두 팀이 같을 때만 쓴다(셋이 돌고 돌면 시드).
    if (list.filter((x) => same(x, a)).length === 2) {
      const d = h2h(a, b);
      if (d !== 0) return -d;
    }
    return lot.get(a.teamId)! - lot.get(b.teamId)!;
  });
  sorted.forEach((x, i) => (x.rank = i + 1));
  return sorted;
}

/**
 * 토너먼트 첫 라운드 대진. 조를 (1,2)(3,4)…로 짝지어 앞 반쪽에 홀수 조 1위 vs 짝 조 2위, 뒤 반쪽에 짝 조 1위 vs 홀수 조
 * 2위를 둔다 — 같은 조 두 팀은 결승에서야 만난다. 돌려주는 값: slot 순서의 [홈(1위), 원정(2위)].
 */
export function firstKoPairs(
  firsts: readonly string[],
  seconds: readonly string[],
): [string, string][] {
  const g = firsts.length;
  const half = g / 2;
  const out: [string, string][] = new Array(g);
  for (let k = 0; k < half; k++) {
    out[k] = [firsts[2 * k]!, seconds[2 * k + 1]!];
    out[k + half] = [firsts[2 * k + 1]!, seconds[2 * k]!];
  }
  return out;
}

/** 다음 토너먼트 라운드: slot 2i와 2i+1의 승자가 slot i에서 만난다. */
export const nextKoSlot = (slot: number) => Math.floor(slot / 2);

/** 토너먼트 라운드에서 진 팀의 성적. */
export const koLoserStage = (round: CupRound) =>
  (({ r32: 'r32', r16: 'r16', qf: 'qf', sf: 'sf', f: 'runnerup' }) as const)[
    round as 'r32' | 'r16' | 'qf' | 'sf' | 'f'
  ];
