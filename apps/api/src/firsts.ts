// ───────── T-10-027 서버 최초 기록(Server Firsts) ─────────
// "서버에서 처음으로 ○○를 해낸 커리어"를 기록한다. 판정은 서버가 이미 받은 시즌 요약(career_seasons)과
// 은퇴 요약(careers)만으로 한다 — 클라이언트가 따로 주장하는 값은 없다. 달성 시각은 조건을 처음 채운
// 시즌 행이 서버에 처음 올라온 시각(created_at)이고, 같은 기록은 시각이 더 이른 커리어가 가져간다.

import type { ServerFirstCat as FirstCat } from '@offside/contracts';

export interface FirstSeason {
  year: number;
  age: number;
  club: string;
  league: string;
  apps: number;
  goals: number;
  assists: number;
  cs: number | null;
  caps: number | null;
  rating: number;
  ovr: number;
  honors: string[];
  mil: boolean;
  createdAt: string;
}
export interface FirstCareer {
  id: string;
  legendScore: number | null;
  retiredAt: string | null;
  /** 연도 오름차순 */
  seasons: FirstSeason[];
}
export interface FirstDef {
  id: string;
  cat: FirstCat;
  /** 화면에 그대로 쓰는 문장("통산 100골 최초 달성!"). */
  label: string;
  /** 처음 조건을 채운 시각(시즌 created_at 또는 은퇴 시각). 못 채웠으면 null. */
  at: (c: FirstCareer) => { at: string; year: number | null } | null;
}

const n = (v: number) => v.toLocaleString('en-US');
const isTrophy = (h: string) => /(우승|메달)$/.test(h);

/** 시즌을 차례로 쌓아 가며 누적값이 처음 target 이상이 된 시즌. */
function cumulative(get: (s: FirstSeason) => number, target: number): FirstDef['at'] {
  return (c) => {
    let t = 0;
    for (const s of c.seasons) {
      t += get(s);
      if (t >= target) return { at: s.createdAt, year: s.year };
    }
    return null;
  };
}
/** 조건을 처음 채운 시즌. */
function firstSeason(ok: (s: FirstSeason, i: number, all: FirstSeason[]) => boolean): FirstDef['at'] {
  return (c) => {
    const i = c.seasons.findIndex((s, k) => ok(s, k, c.seasons));
    const s = c.seasons[i];
    return s ? { at: s.createdAt, year: s.year } : null;
  };
}
const honorCount = (h: string, times: number) => cumulative((s) => s.honors.filter((x) => x === h).length, times);

const ladder = (cat: FirstCat, key: string, steps: number[], get: (s: FirstSeason) => number, label: (v: string) => string): FirstDef[] =>
  steps.map((v) => ({ id: `${key}${v}`, cat, label: label(n(v)), at: cumulative(get, v) }));
/** 한 시즌 값이 처음 target 이상이 된 시즌. */
const seasonLadder = (key: string, steps: number[], get: (s: FirstSeason) => number, label: (v: number) => string): FirstDef[] =>
  steps.map((v) => ({ id: `${key}${v}`, cat: 'season', label: label(v), at: firstSeason((s) => get(s) >= v) }));
const range = (from: number, to: number, step: number) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);

// 우승 이름은 web game/data.ts LEAGUES · game/comps.ts CUPS·CONT의 `${이름} 우승`과 같다(트레블은 web 칭호와 같은 정의).
const LEAGUE_WIN = ['프리미어리그', '라리가', '세리에 A', '분데스리가', '리그 1', 'K리그1', 'K리그2', 'K3리그', 'J1리그', 'MLS', '에레디비시'].map((l) => `${l} 우승`);
const CUP_WIN = ['코리아컵', '일왕배', 'J리그컵', 'US 오픈컵', '리그스컵', 'KNVB컵', '쿠프 드 프랑스', 'DFB-포칼', '코파 이탈리아', '코파 델 레이', 'FA컵', 'EFL컵'].map((c) => `${c} 우승`);
const TOP_CONT_WIN = ['UEFA 챔피언스리그', 'AFC 챔피언스리그 엘리트', 'CONCACAF 챔피언스컵'].map((c) => `${c} 우승`);
const hasAny = (honors: string[], names: string[]) => honors.some((h) => names.includes(h));

export const FIRSTS: FirstDef[] = [
  // 통산
  ...ladder('total', 'goals', range(100, 500, 50), (s) => s.goals, (v) => `통산 ${v}골 최초 달성!`),
  ...ladder('total', 'assists', range(50, 300, 50), (s) => s.assists, (v) => `통산 ${v}도움 최초 달성!`),
  ...ladder('total', 'apps', range(200, 800, 100), (s) => s.apps, (v) => `통산 ${v}경기 출전 최초 달성!`),
  ...ladder('total', 'cs', range(50, 250, 50), (s) => s.cs ?? 0, (v) => `통산 무실점 ${v}경기 최초 달성!`),
  ...ladder('total', 'caps', [50, 100, 150], (s) => s.caps ?? 0, (v) => `A매치 ${v}경기 최초 달성!`),
  ...ladder('total', 'trophies', [10, 20, 30], (s) => s.honors.filter(isTrophy).length, (v) => `우승 트로피 ${v}개 최초 달성!`),
  ...ladder('total', 'awards', [10, 20, 30], (s) => s.honors.filter((h) => !isTrophy(h)).length, (v) => `개인상 ${v}개 최초 달성!`),
  // 시즌 · 나이
  ...seasonLadder('sgoals', [30, 40, 50, 60], (s) => s.goals, (v) => `한 시즌 ${v}골 최초 달성!`),
  ...seasonLadder('sassists', [20, 25, 30], (s) => s.assists, (v) => `한 시즌 ${v}도움 최초 달성!`),
  ...seasonLadder('scs', [20, 25], (s) => s.cs ?? 0, (v) => `한 시즌 무실점 ${v}경기 최초 달성!`),
  ...[8, 8.5].map((v): FirstDef => ({
    id: `srating${v * 10}`, cat: 'season', label: `시즌 평균 평점 ${v.toFixed(1)} 최초 달성!`, at: firstSeason((s) => s.apps >= 15 && s.rating >= v),
  })),
  ...seasonLadder('ovr', [85, 90, 95, 99], (s) => s.ovr, (v) => `OVR ${v} 최초 도달!`),
  { id: 'teen20', cat: 'season', label: '20세 이하 한 시즌 20골 최초 달성!', at: firstSeason((s) => s.age <= 20 && s.goals >= 20) },
  { id: 'age38', cat: 'season', label: '38세 현역 출전 최초 달성!', at: firstSeason((s) => s.age >= 38 && s.apps > 0) },
  { id: 'age40', cat: 'season', label: '40세 현역 출전 최초 달성!', at: firstSeason((s) => s.age >= 40 && s.apps > 0) },
  {
    id: 'oneclub10', cat: 'season', label: '한 클럽 10시즌 최초 달성!',
    at: firstSeason((s, i, all) => !s.mil && all.slice(0, i + 1).filter((x) => !x.mil && x.club === s.club).length >= 10),
  },
  { id: 'leagues5', cat: 'season', label: '5개 리그 경험 최초 달성!', at: firstSeason((_s, i, all) => new Set(all.slice(0, i + 1).map((x) => x.league)).size >= 5) },
  // 수상 · 우승
  { id: 'ballon', cat: 'honor', label: '발롱도르 최초 수상!', at: honorCount('발롱도르', 1) },
  { id: 'ballon3', cat: 'honor', label: '발롱도르 3회 최초 수상!', at: honorCount('발롱도르', 3) },
  { id: 'ballon5', cat: 'honor', label: '발롱도르 5회 최초 수상!', at: honorCount('발롱도르', 5) },
  ...(
    [
      ['goldenshoe', '유러피언 골든슈'], ['yashin', '야신 트로피'], ['thebest', 'FIFA 더 베스트 남자 선수'],
      ['kopa', '코파 트로피'], ['muller', '게르트 뮐러 트로피'], ['fifpro', 'FIFPRO 월드 11'],
    ] as const
  ).map(([id, h]): FirstDef => ({ id, cat: 'honor', label: `${h} 최초 수상!`, at: honorCount(h, 1) })),
  ...(
    [
      ['ucl', 'UEFA 챔피언스리그 우승', 'UEFA 챔피언스리그 최초 우승!'], ['uel', 'UEFA 유로파리그 우승', 'UEFA 유로파리그 최초 우승!'],
      ['acle', 'AFC 챔피언스리그 엘리트 우승', 'AFC 챔피언스리그 엘리트 최초 우승!'], ['cwc', 'FIFA 클럽 월드컵 우승', 'FIFA 클럽 월드컵 최초 우승!'],
      ['wc', 'FIFA 월드컵 우승', 'FIFA 월드컵 최초 우승!'], ['asiancup', 'AFC 아시안컵 우승', 'AFC 아시안컵 최초 우승!'],
      ['olympic', '올림픽 금메달', '올림픽 금메달 최초 획득!'], ['asiangames', '아시안게임 금메달', '아시안게임 금메달 최초 획득!'],
    ] as const
  ).map(([id, h, label]): FirstDef => ({ id, cat: 'honor', label, at: honorCount(h, 1) })),
  ...(
    [
      ['pl', '프리미어리그'], ['ll', '라리가'], ['sa', '세리에 A'], ['bl', '분데스리가'], ['l1', '리그 1'], ['k1', 'K리그1'],
    ] as const
  ).map(([id, l]): FirstDef => ({ id: `win_${id}`, cat: 'honor', label: `${l} 최초 우승!`, at: honorCount(`${l} 우승`, 1) })),
  { id: 'leaguewins5', cat: 'honor', label: '리그 우승 5회 최초 달성!', at: cumulative((s) => s.honors.filter((h) => LEAGUE_WIN.includes(h)).length, 5) },
  {
    id: 'treble', cat: 'honor', label: '트레블 최초 달성!',
    at: firstSeason((s) => hasAny(s.honors, LEAGUE_WIN) && hasAny(s.honors, CUP_WIN) && hasAny(s.honors, TOP_CONT_WIN)),
  },
  ...[840, 1000].map((v): FirstDef => ({
    id: `legend${v}`, cat: 'honor', label: `레전드 점수 ${n(v)}점 은퇴 최초 달성!`,
    at: (c) => (c.retiredAt && (c.legendScore ?? 0) >= v ? { at: c.retiredAt, year: null } : null),
  })),
];

/** 한 커리어가 채운 기록과 그 시각. */
export function evaluateCareer(c: FirstCareer): { id: string; at: string; year: number | null }[] {
  const out: { id: string; at: string; year: number | null }[] = [];
  for (const d of FIRSTS) {
    const r = d.at(c);
    if (r) out.push({ id: d.id, ...r });
  }
  return out;
}
