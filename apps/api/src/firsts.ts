// ───────── T-10-027 서버 최초 기록(Server Firsts) ─────────
// "서버에서 처음으로 ○○를 해낸 커리어"를 기록한다. 판정은 서버가 이미 받은 시즌 요약(career_seasons)과
// 은퇴 요약(careers)만으로 한다 — 클라이언트가 따로 주장하는 값은 없다. 달성 시각은 조건을 처음 채운
// 시즌 행이 서버에 처음 올라온 시각(created_at)이고, 같은 기록은 시각이 더 이른 커리어가 가져간다.

import type { ServerFirstCat as FirstCat } from '@offside/contracts';
import { CONFEDS, CONF_ORDER, cupTrophy } from '@offside/contracts/nations';
import { nextRetireAt, retireAtOf } from '@offside/contracts/service-seasons';

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
  /** T-11-045 서버가 시즌 기록에 맞춘 은퇴 나이와 커리어의 서비스 시즌(0 = 프리시즌). */
  retireAge?: number | null;
  season?: number;
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
  /** 시즌마다 다른 문장. null이면 그 시즌 목록에서 뺀다. 없으면 label 그대로. */
  seasonLabel?: (season: number) => string | null;
}

/** T-11-045 은퇴 나이 해금 기록 id. */
export const RETIRE_CAP_FIRST = 'retirecap';

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
function firstSeason(
  ok: (s: FirstSeason, i: number, all: FirstSeason[]) => boolean,
): FirstDef['at'] {
  return (c) => {
    const i = c.seasons.findIndex((s, k) => ok(s, k, c.seasons));
    const s = c.seasons[i];
    return s ? { at: s.createdAt, year: s.year } : null;
  };
}
const honorCount = (h: string, times: number) =>
  cumulative((s) => s.honors.filter((x) => x === h).length, times);

/**
 * T-10-056 끝없는 단계. 기본 단계(base)를 다 채우면 마지막 단계에서 step씩 다음 목표가 계속 열린다 — 누가
 * 가장 높은 단계를 넘으면 그 위가 '아직 아무도 못 한 다음 목표'가 된다. step이 없으면 기본 단계에서 끝난다
 * (OVR 99처럼 상한이 있는 값). id는 `${key}${v}`.
 */
export interface FirstLadder {
  key: string;
  cat: FirstCat;
  base: number[];
  step?: number | undefined;
  /** 이 커리어가 이른 가장 큰 값(누적 합계·시즌 최고 등). */
  reach: (c: FirstCareer) => number;
  at: (v: number) => FirstDef['at'];
  label: (v: number) => string;
  /** 같은 값으로 겨루는 서버 기록(id는 key). */
  record?: Omit<RecordDef, 'id'> | undefined;
}
type FirstSpec = FirstDef | FirstLadder;
const isLadder = (x: FirstSpec): x is FirstLadder => 'base' in x;
/** 직접 쓰는 단계(매개변수 타입을 잡아 준다). */
const custom = (l: FirstLadder) => l;

const sum = (get: (s: FirstSeason) => number) => (c: FirstCareer) =>
  c.seasons.reduce((t, s) => t + get(s), 0);
const best = (get: (s: FirstSeason) => number) => (c: FirstCareer) =>
  c.seasons.reduce((m, s) => Math.max(m, get(s)), 0);

type RecordName = Pick<RecordDef, 'label' | 'unit'>;
/** 통산 누적 단계. record를 주면 통산 합계로 서버 기록도 겨룬다. */
const ladder = (
  cat: FirstCat,
  key: string,
  base: number[],
  step: number | undefined,
  get: (s: FirstSeason) => number,
  label: (v: number) => string,
  record?: RecordName,
): FirstLadder => ({
  key,
  cat,
  base,
  step,
  reach: sum(get),
  at: (v) => cumulative(get, v),
  label,
  record: record && { ...record, value: totalRecord(get) },
});
/** 한 시즌 값 단계. record를 주면 한 시즌 최고값으로 서버 기록도 겨룬다. */
const seasonLadder = (
  key: string,
  base: number[],
  step: number | undefined,
  get: (s: FirstSeason) => number,
  label: (v: number) => string,
  record?: RecordName,
): FirstLadder => ({
  key,
  cat: 'season',
  base,
  step,
  reach: best(get),
  at: (v) => firstSeason((s) => get(s) >= v),
  label,
  record: record && { ...record, value: seasonRecord(get) },
});
const range = (from: number, to: number, step: number) =>
  Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);

// 우승 이름은 web game/data.ts LEAGUES · game/comps.ts CUPS·CONT의 `${이름} 우승`과 같다(트레블은 web 칭호와 같은 정의).
const LEAGUE_WIN = [
  '프리미어리그',
  '라리가',
  '세리에 A',
  '분데스리가',
  '리그 1',
  'K리그1',
  'K리그2',
  'K3리그',
  'J1리그',
  'MLS',
  '에레디비시',
].map((l) => `${l} 우승`);
const CUP_WIN = [
  '코리아컵',
  '일왕배',
  'J리그컵',
  'US 오픈컵',
  '리그스컵',
  'KNVB컵',
  '쿠프 드 프랑스',
  'DFB-포칼',
  '코파 이탈리아',
  '코파 델 레이',
  'FA컵',
  'EFL컵',
].map((c) => `${c} 우승`);
const TOP_CONT_WIN = ['UEFA 챔피언스리그', 'AFC 챔피언스리그 엘리트', 'CONCACAF 챔피언스컵'].map(
  (c) => `${c} 우승`,
);
const hasAny = (honors: string[], names: string[]) => honors.some((h) => names.includes(h));

/**
 * T-11-045 은퇴 나이 해금. 시즌 선수가 그 시즌 은퇴 나이까지 뛰고 은퇴하면(은퇴 나이는 서버가 시즌 기록으로 맞춘 값)
 * 다음 시즌 은퇴 나이가 한 살 오른다(nextRetireAt). 프리시즌은 해금이 없어 목록에서 뺀다. 판정에 시즌 행을 쓰지 않아
 * 은퇴 업로드(legendOnly)에서 잡힌다.
 */
const RETIRE_CAP: FirstDef = {
  id: RETIRE_CAP_FIRST,
  cat: 'honor',
  label: '은퇴 나이까지 뛰고 은퇴 최초 달성!',
  at: (c) =>
    c.retiredAt && c.season && c.retireAge === retireAtOf(c.season)
      ? { at: c.retiredAt, year: null }
      : null,
  seasonLabel: (season) => {
    if (season === 0) return null;
    const cap = retireAtOf(season),
      next = nextRetireAt(cap, true);
    return next > cap
      ? `${cap}세 은퇴 최초 달성! 다음 시즌 은퇴 나이 ${next}세 해금`
      : `${cap}세 은퇴 최초 달성!`;
  },
};

const SPECS: FirstSpec[] = [
  // 통산
  ladder(
    'total',
    'goals',
    range(100, 500, 50),
    50,
    (s) => s.goals,
    (v) => `통산 ${n(v)}골 최초 달성!`,
    { label: '통산 최다 골', unit: '골' },
  ),
  ladder(
    'total',
    'assists',
    range(50, 300, 50),
    50,
    (s) => s.assists,
    (v) => `통산 ${n(v)}도움 최초 달성!`,
    { label: '통산 최다 도움', unit: '도움' },
  ),
  ladder(
    'total',
    'apps',
    range(200, 800, 100),
    100,
    (s) => s.apps,
    (v) => `통산 ${n(v)}경기 출전 최초 달성!`,
    { label: '통산 최다 출전', unit: '경기' },
  ),
  ladder(
    'total',
    'cs',
    range(50, 250, 50),
    50,
    (s) => s.cs ?? 0,
    (v) => `통산 무실점 ${n(v)}경기 최초 달성!`,
    { label: '통산 최다 무실점', unit: '경기' },
  ),
  ladder(
    'total',
    'caps',
    [50, 100, 150],
    50,
    (s) => s.caps ?? 0,
    (v) => `A매치 ${v}경기 최초 달성!`,
    { label: 'A매치 최다 출전', unit: '경기' },
  ),
  ladder(
    'total',
    'trophies',
    [10, 20, 30],
    10,
    (s) => s.honors.filter(isTrophy).length,
    (v) => `우승 트로피 ${v}개 최초 달성!`,
    { label: '최다 우승 트로피', unit: '개' },
  ),
  ladder(
    'total',
    'awards',
    [10, 20, 30],
    10,
    (s) => s.honors.filter((h) => !isTrophy(h)).length,
    (v) => `개인상 ${v}개 최초 달성!`,
    { label: '최다 개인상', unit: '개' },
  ),
  // 시즌 · 나이
  seasonLadder(
    'sgoals',
    [30, 40, 50, 60],
    10,
    (s) => s.goals,
    (v) => `한 시즌 ${v}골 최초 달성!`,
    { label: '한 시즌 최다 골', unit: '골' },
  ),
  seasonLadder(
    'sassists',
    [20, 25, 30],
    5,
    (s) => s.assists,
    (v) => `한 시즌 ${v}도움 최초 달성!`,
    { label: '한 시즌 최다 도움', unit: '도움' },
  ),
  seasonLadder(
    'scs',
    [20, 25],
    5,
    (s) => s.cs ?? 0,
    (v) => `한 시즌 무실점 ${v}경기 최초 달성!`,
    { label: '한 시즌 최다 무실점', unit: '경기' },
  ),
  ...[8, 8.5].map((v): FirstDef => ({
    id: `srating${v * 10}`,
    cat: 'season',
    label: `시즌 평균 평점 ${v.toFixed(1)} 최초 달성!`,
    at: firstSeason((s) => s.apps >= 15 && s.rating >= v),
  })),
  seasonLadder(
    'ovr',
    [85, 90, 95, 99],
    undefined,
    (s) => s.ovr,
    (v) => `OVR ${v} 최초 도달!`,
  ),
  {
    id: 'teen20',
    cat: 'season',
    label: '20세 이하 한 시즌 20골 최초 달성!',
    at: firstSeason((s) => s.age <= 20 && s.goals >= 20),
  },
  seasonLadder(
    'age',
    [38, 40],
    1,
    (s) => (s.apps > 0 ? s.age : 0),
    (v) => `${v}세 현역 출전 최초 달성!`,
  ),
  custom({
    key: 'oneclub',
    cat: 'season',
    base: [10],
    step: 5,
    reach: (c) => Math.max(0, ...c.seasons.map((_s, i) => clubSeasons(c.seasons, i))),
    at: (v) => firstSeason((_s, i, all) => clubSeasons(all, i) >= v),
    label: (v) => `한 클럽 ${v}시즌 최초 달성!`,
  }),
  custom({
    key: 'leagues',
    cat: 'season',
    base: [5],
    step: 1,
    reach: (c) => new Set(c.seasons.map((x) => x.league)).size,
    at: (v) =>
      firstSeason((_s, i, all) => new Set(all.slice(0, i + 1).map((x) => x.league)).size >= v),
    label: (v) => `${v}개 리그 경험 최초 달성!`,
  }),
  // 수상 · 우승
  ladder(
    'honor',
    'ballon',
    [1, 3, 5],
    1,
    (s) => s.honors.filter((x) => x === '발롱도르').length,
    (v) => (v === 1 ? '발롱도르 최초 수상!' : `발롱도르 ${v}회 최초 수상!`),
    { label: '발롱도르 최다 수상', unit: '회' },
  ),
  ...(
    [
      ['goldenshoe', '유러피언 골든슈'],
      ['yashin', '야신 트로피'],
      ['thebest', 'FIFA 더 베스트 남자 선수'],
      ['kopa', '코파 트로피'],
      ['muller', '게르트 뮐러 트로피'],
      ['fifpro', 'FIFPRO 월드 11'],
    ] as const
  ).map(([id, h]): FirstDef => ({
    id,
    cat: 'honor',
    label: `${h} 최초 수상!`,
    at: honorCount(h, 1),
  })),
  ...(
    [
      ['ucl', 'UEFA 챔피언스리그 우승', 'UEFA 챔피언스리그 최초 우승!'],
      ['uel', 'UEFA 유로파리그 우승', 'UEFA 유로파리그 최초 우승!'],
      ['acle', 'AFC 챔피언스리그 엘리트 우승', 'AFC 챔피언스리그 엘리트 최초 우승!'],
      ['cwc', 'FIFA 클럽 월드컵 우승', 'FIFA 클럽 월드컵 최초 우승!'],
      ['wc', 'FIFA 월드컵 우승', 'FIFA 월드컵 최초 우승!'],
      // T-10-096 연맹마다 대륙컵(아시안컵이 맨 앞 — 예전 순서 그대로).
      ...CONF_ORDER.map(
        (c) => [CONFEDS[c].title.id, cupTrophy(c), `${CONFEDS[c].cup} 최초 우승!`] as const,
      ),
      ['olympic', '올림픽 금메달', '올림픽 금메달 최초 획득!'],
      ['asiangames', '아시안게임 금메달', '아시안게임 금메달 최초 획득!'],
    ] as const
  ).map(([id, h, label]): FirstDef => ({ id, cat: 'honor', label, at: honorCount(h, 1) })),
  ...(
    [
      ['pl', '프리미어리그'],
      ['ll', '라리가'],
      ['sa', '세리에 A'],
      ['bl', '분데스리가'],
      ['l1', '리그 1'],
      ['k1', 'K리그1'],
    ] as const
  ).map(([id, l]): FirstDef => ({
    id: `win_${id}`,
    cat: 'honor',
    label: `${l} 최초 우승!`,
    at: honorCount(`${l} 우승`, 1),
  })),
  ladder(
    'honor',
    'leaguewins',
    [5],
    5,
    (s) => s.honors.filter((h) => LEAGUE_WIN.includes(h)).length,
    (v) => `리그 우승 ${v}회 최초 달성!`,
  ),
  {
    id: 'treble',
    cat: 'honor',
    label: '트레블 최초 달성!',
    at: firstSeason(
      (s) =>
        hasAny(s.honors, LEAGUE_WIN) && hasAny(s.honors, CUP_WIN) && hasAny(s.honors, TOP_CONT_WIN),
    ),
  },
  custom({
    key: 'legend',
    cat: 'honor',
    base: [840, 1000],
    step: 100,
    reach: (c) => (c.retiredAt ? (c.legendScore ?? 0) : 0),
    at: (v) => (c) =>
      c.retiredAt && (c.legendScore ?? 0) >= v ? { at: c.retiredAt, year: null } : null,
    label: (v) => `레전드 점수 ${n(v)}점 은퇴 최초 달성!`,
    record: {
      label: '최고 레전드 점수',
      unit: '점',
      value: (c) =>
        c.retiredAt && c.legendScore ? { value: c.legendScore, at: c.retiredAt, year: null } : null,
    },
  }),
  RETIRE_CAP,
];

/** 군 복무를 뺀, i번째 시즌까지 그 시즌 클럽에서 뛴 시즌 수. */
function clubSeasons(all: FirstSeason[], i: number): number {
  const s = all[i]!;
  return s.mil ? 0 : all.slice(0, i + 1).filter((x) => !x.mil && x.club === s.club).length;
}

const ladderId = (l: FirstLadder, v: number) => `${l.key}${v}`;

/** 단계 값을 차례로: 기본 단계, 그다음 step씩 끝없이(step이 없으면 기본 단계에서 끝). */
function* steps(l: FirstLadder): Generator<number> {
  yield* l.base;
  if (!l.step) return;
  for (let v = l.base[l.base.length - 1]! + l.step; ; v += l.step) yield v;
}

/** 한 커리어가 한 단계 사다리에서 채울 수 있는 단계 수 상한. 실제 최고 기록도 20단계 남짓이다 — 지어낸 큰 값이
 * 수백 개의 기록 행을 만들지 않게 한다. */
const MAX_STEPS = 40;

/** upTo 이하의 단계(최대 MAX_STEPS개). */
function stepsUpTo(l: FirstLadder, upTo: number): number[] {
  const out: number[] = [];
  for (const v of steps(l)) {
    if (v > upTo || out.length >= MAX_STEPS) break;
    out.push(v);
  }
  return out;
}

/** top(지금까지 달성된 가장 높은 단계)보다 높은 첫 단계. 끝난 단계면 null. */
function nextStep(l: FirstLadder, top: number): number | null {
  for (const v of steps(l)) if (v > top) return v;
  return null;
}

const LADDERS = SPECS.filter(isLadder);
const LADDER_ID = new Map(LADDERS.map((l) => [l.key, l]));
/** 단계 id → (단계, 값). 단계 id가 아니면 null. */
function parseLadderId(id: string): { l: FirstLadder; v: number } | null {
  const m = /^([a-z_]+?)(\d+)$/.exec(id);
  const l = m && LADDER_ID.get(m[1]!);
  return l ? { l, v: Number(m![2]) } : null;
}

const toDef = (l: FirstLadder, v: number): FirstDef => ({
  id: ladderId(l, v),
  cat: l.cat,
  label: l.label(v),
  at: l.at(v),
});

/**
 * 화면에 보일 규칙 목록(순서 고정). 끝없는 단계는 기본 단계 + 이미 달성된 단계 + 그 위의 다음 목표 하나.
 * achieved: 지금까지 누군가 달성한 id. season: 그 시즌 목록(seasonLabel을 푼다).
 */
export function firstsCatalog(achieved: Iterable<string>, season?: number): FirstDef[] {
  const got = new Map<FirstLadder, Set<number>>();
  for (const id of achieved) {
    const p = parseLadderId(id);
    if (p) got.set(p.l, (got.get(p.l) ?? new Set()).add(p.v));
  }
  return SPECS.flatMap((x) => {
    if (!isLadder(x)) {
      if (season === undefined || !x.seasonLabel) return [x];
      const label = x.seasonLabel(season);
      return label === null ? [] : [{ ...x, label }];
    }
    const done = got.get(x) ?? new Set<number>();
    const vals = new Set([...x.base, ...done]);
    const next = nextStep(x, Math.max(0, ...done));
    if (next !== null) vals.add(next);
    return [...vals].sort((a, b) => a - b).map((v) => toDef(x, v));
  });
}

/** 한 커리어가 채운 기록과 그 시각. */
export function evaluateCareer(c: FirstCareer): { id: string; at: string; year: number | null }[] {
  const out: { id: string; at: string; year: number | null }[] = [];
  const add = (id: string, r: ReturnType<FirstDef['at']>) => {
    if (r) out.push({ id, ...r });
  };
  for (const x of SPECS) {
    if (!isLadder(x)) add(x.id, x.at(c));
    else for (const v of stepsUpTo(x, x.reach(c))) add(ladderId(x, v), x.at(v)(c)); // 문장은 만들지 않는다
  }
  return out;
}

/**
 * T-10-056 서버 기록 — 깨질 수 있는 최고 기록. 더 큰 값을 낸 커리어가 가져가고, 같은 값이면 먼저 세운 쪽이
 * 지킨다. 진행 중 커리어도 시즌을 올릴 때마다 값이 커질 수 있다.
 */
export interface RecordDef {
  id: string;
  label: string;
  unit: string;
  value: (c: FirstCareer) => { value: number; at: string; year: number | null } | null;
}

/** 통산 합계와 그 합계가 마지막으로 늘어난 시즌. */
function totalRecord(get: (s: FirstSeason) => number): RecordDef['value'] {
  return (c) => {
    let value = 0;
    let last: FirstSeason | undefined;
    for (const s of c.seasons) {
      const g = get(s);
      if (g <= 0) continue;
      value += g;
      last = s;
    }
    return last ? { value, at: last.createdAt, year: last.year } : null;
  };
}
/** 한 시즌 최고값과 그 값을 처음 낸 시즌. */
function seasonRecord(get: (s: FirstSeason) => number): RecordDef['value'] {
  return (c) => {
    let value = 0;
    let top: FirstSeason | undefined;
    for (const s of c.seasons) {
      const g = get(s);
      if (g <= value) continue;
      value = g;
      top = s;
    }
    return top ? { value, at: top.createdAt, year: top.year } : null;
  };
}

/** 서버 기록 목록 — 단계에 붙은 기록을 단계 순서대로. */
export const RECORDS: RecordDef[] = LADDERS.flatMap((l) =>
  l.record ? [{ id: l.key, ...l.record }] : [],
);

/** 한 커리어의 서버 기록 후보 값. */
export function evaluateRecords(
  c: FirstCareer,
): { id: string; value: number; at: string; year: number | null }[] {
  return RECORDS.flatMap((d) => {
    const r = d.value(c);
    return r ? [{ id: d.id, ...r }] : [];
  });
}
