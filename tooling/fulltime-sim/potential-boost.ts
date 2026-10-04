// T-11-083 잠재력 강화(자금 소모) 밸런스 시뮬레이션. 게임 엔진은 바꾸지 않고, 시즌 결산 뒤(이적시장 전)에
// 정책이 자금을 써서 flags.potBonus를 올리는 것으로 흉내 낸다. 같은 시드로 강화 없는 커리어와 짝지어 비교한다.
//
// 실행: tsx potential-boost.ts <mode> [커리어 수]
//   money  : 강화 없이 나이별 보유 자금·연봉 분포(만 원)
//   effect : 특정 나이에 잠재력 +k를 주었을 때 최고 OVR·레전드 점수 변화
//   boost  : 가격·확률 후보(CONFIGS)별 시도·성공·지출·효과
// 환경: SEED(기본 2026), INVEST=1(자기 투자 정책도 자금을 쓴다), RETIRE_AT(서비스 시즌 은퇴 나이, 기본 45)
import {
  TYPES,
  TRAITS,
  POS,
  ATTR_KEYS,
  LAST_PHASE,
  LEAGUES,
  newGame,
  resolveChoice,
  leagueOf,
  ovr,
  endSeason,
  market,
  acceptOption,
  retire,
  legendScore,
  eventById,
  playPhase,
  investCost,
  INVESTS,
} from '@offside/game/index';
import { pick, createRng, setActiveRng } from '@offside/game/rng';
import { gradeOf, truePot } from '@offside/game/stats';
import { BOOST } from '@offside/game/boost';
import { OVR_CAP_BY_AGE } from '../../apps/api/src/plausibility.js';
import type { GameState, MarketOption, OfferOption } from '@offside/game/types';

if (typeof (globalThis as Record<string, unknown>).localStorage === 'undefined') {
  const mem = new Map<string, string>();
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  };
}

const INVEST = process.env.INVEST === '1';
const RETIRE_AT = +(process.env.RETIRE_AT || 45);
const RETIRE_AGE = +(process.env.RETIRE_AGE || 35);

// ───────── 강화 규칙 후보 ─────────
export type BoostConfig = {
  name: string;
  /** 단계(0부터)별 성공 확률. 길이가 최대 단계. */
  p: number[];
  /** 단계별 비용(만 원) = max(min[L], 연봉 × rate[L]). */
  min: number[];
  rate: number[];
  /** 실패하면 단계가 1 내려갈 확률(그 단계 이상에서만). */
  down?: { from: number; p: number };
  /** 같은 단계에서 실패할 때마다 다음 시도 확률에 더한다(성공하면 0으로). */
  pity?: number;
  /** 이 나이까지만 강화할 수 있다. */
  maxAge: number;
  /** 시즌마다 최대 시도 횟수. */
  perSeason: number;
  /** 정책: 비용의 이 배수 이상 있을 때만 시도한다. */
  reserve: number;
};

type Hook = (s: GameState, r: () => number) => void;

// ───────── 스마트 정책(simulate.ts 와 같다) ─────────
function pickTraining(s: GameState): string {
  if (s.cond < 55) return 'rest';
  return [...ATTR_KEYS]
    .filter((k) => (POS[s.pos].w[k] ?? 0) >= 0.1)
    .sort(
      (a, b) =>
        s.attrs[a] - (POS[s.pos].w[a] ?? 0) * 40 - (s.attrs[b] - (POS[s.pos].w[b] ?? 0) * 40),
    )[0]!;
}
function pickInvest(s: GameState): string {
  const want = s.injury > 0 || s.cond < 50 ? 'medical' : s.morale < 45 ? 'mental' : 'weak';
  const d = INVESTS.find((x) => x.id === want)!;
  return s.money >= investCost(s, d) * 2 ? want : 'none';
}
function value(x: GameState): number {
  const S = x.season || ({} as GameState['season']);
  return (
    ovr(x) * 3 +
    (x.flags.potBonus ?? 0) * 3 +
    x.fame * 0.15 +
    x.morale * 0.08 +
    x.trust * 1.2 +
    x.cond * 0.03 +
    Math.log10(Math.max(1, x.money)) * 2 +
    (S.goals || 0) * 0.5 +
    (S.assists || 0) * 0.3 +
    (S.cs || 0) * 0.3 -
    x.injury * 0.8 +
    x.nat.caps * 0.2 +
    (x.flags.scouted ? 2 : 0) +
    x.awards.length * 3
  );
}
function pickChoice(s: GameState, id: string): number {
  const E = eventById(id)!;
  const snap = JSON.stringify(s);
  let best = 0,
    bv = -1e9;
  E.choices.forEach((_, i) => {
    let v = 0;
    for (let k = 0; k < 8; k++) {
      const x = JSON.parse(snap) as GameState;
      resolveChoice(x, E.id, i);
      v += value(x);
    }
    if (v > bv) {
      bv = v;
      best = i;
    }
  });
  return best;
}
const anyJob = (o: MarketOption) =>
  (['offer', 'renew', 'stay', 'uni', 'sangmu', 'army', 'serve'] as MarketOption['kind'][]).includes(
    o.kind,
  );
function realJob(s: GameState, o: MarketOption): boolean {
  if (o.kind === 'sangmu' || o.kind === 'army' || o.kind === 'serve') return true;
  const L = o.kind === 'offer' ? LEAGUES.find((l) => l.id === o.leagueId) : leagueOf(s.leagueId);
  return !!L && L.tier >= 1 && anyJob(o);
}
function pickOption(s: GameState, m: { options: MarketOption[] }): MarketOption {
  const milO =
    m.options.find((o) => o.kind === 'sangmu' && o.due) ||
    m.options.find((o) => o.kind === 'serve') ||
    m.options.find((o) => o.kind === 'sangmu' && s.age >= 25);
  if (milO) return milO;
  const offers = m.options.filter((o): o is OfferOption => o.kind === 'offer');
  const stay = m.options.find((o) => o.kind === 'stay' || o.kind === 'renew');
  const good = offers.filter((o) => o.role !== '벤치 경쟁').sort((a, b) => b.str - a.str)[0];
  if (good && (!stay || good.str > s.club.str + 1)) return good;
  return stay || good || offers[0] || m.options.find((o) => o.kind !== 'sangmu') || m.options[0]!;
}

// ───────── 커리어 하나 ─────────
export type SeasonRow = { age: number; money: number; salary: number; ovr: number };
export type Career = {
  pot0: number;
  trait: string;
  peak: number;
  legend: number;
  money: number;
  retireAge: number;
  tpGrade: string;
  potBonus: number;
  seasons: SeasonRow[];
  boost?:
    | {
        tries: number;
        ok: number;
        down: number;
        spent: number;
        level: number;
        income: number;
        fails: number;
        ages: number[];
      }
    | undefined;
};

function career(seed: number, hook?: Hook, cfg?: BoostConfig): Career {
  setActiveRng(createRng(seed));
  const pos = pick(['FW', 'MF', 'DF', 'GK'] as const);
  const type = pick(TYPES[pos]).id;
  const trait = pick(TRAITS).id;
  const s = newGame(
    { name: 'SIM', number: 9, pos, foot: '오른발', type, trait, retireAt: RETIRE_AT },
    (seed * 2654435761) >>> 0,
  );
  const pot0 = s.pot;
  // 강화 판정은 게임 RNG와 따로 굴린다(같은 시드의 강화 없는 커리어와 갈라지는 지점을 줄인다).
  const own = createRng((seed ^ 0x9e3779b9) >>> 0);
  const r = () => own.next();
  const seasons: SeasonRow[] = [];
  const b = {
    tries: 0,
    ok: 0,
    down: 0,
    spent: 0,
    level: 0,
    income: 0,
    fails: 0,
    ages: [] as number[],
  };
  let prevMoney = s.money;
  for (let y = 0; y < 32 && !s.retired; y++) {
    for (let ph = 0; ph <= LAST_PHASE; ph++) {
      s.training = pickTraining(s);
      if (INVEST) s.invest = pickInvest(s);
      const { ev } = playPhase(s);
      if (ev) resolveChoice(s, ev, pickChoice(s, ev));
    }
    const res = endSeason(s);
    seasons.push({
      age: res.rec.age,
      money: s.money,
      salary: s.contract?.salary ?? 0,
      ovr: ovr(s),
    });
    b.income += Math.max(0, s.money - prevMoney);
    if (hook) hook(s, r);
    if (cfg) boostSeason(s, cfg, r, b);
    prevMoney = s.money;
    let m = market(s),
      g = 0;
    while (true) {
      if (!m.options.length) {
        retire(s);
        break;
      }
      if (
        m.canRetire &&
        (s.age >= RETIRE_AGE ||
          (s.age >= 28 && !m.options.some((o) => realJob(s, o))) ||
          !m.options.some(anyJob))
      ) {
        retire(s);
        break;
      }
      const res2 = acceptOption(s, pickOption(s, m), m.options);
      if (res2?.reopen && g++ < 5) {
        m = market(s);
        continue;
      }
      break;
    }
  }
  if (!s.retired) retire(s);
  return {
    pot0,
    trait,
    peak: s.peak,
    legend: legendScore(s),
    money: s.money,
    retireAge: s.age,
    tpGrade: gradeOf(truePot(s)),
    potBonus: s.flags.potBonus ?? 0,
    seasons,
    boost: cfg ? b : undefined,
  };
}

export const cfgCost = (s: GameState, c: BoostConfig, L: number) =>
  Math.round(Math.max(c.min[L]!, (s.contract?.salary ?? 0) * c.rate[L]!) / 10) * 10;

function boostSeason(
  s: GameState,
  c: BoostConfig,
  r: () => number,
  b: NonNullable<Career['boost']>,
) {
  if (s.age > c.maxAge || s.career.length === 0) return;
  for (let t = 0; t < c.perSeason && b.level < c.p.length; t++) {
    const cost = cfgCost(s, c, b.level);
    if (s.money < cost * c.reserve) return;
    s.money -= cost;
    b.spent += cost;
    b.tries++;
    b.ages.push(s.age);
    if (r() < Math.min(1, c.p[b.level]! + (c.pity ?? 0) * b.fails)) {
      b.fails = 0;
      b.level++;
      b.ok++;
      s.flags.potBonus = (s.flags.potBonus ?? 0) + 1;
    } else if ((b.fails++, c.down && b.level >= c.down.from && r() < c.down.p)) {
      b.level--;
      b.down++;
      s.flags.potBonus = (s.flags.potBonus ?? 0) - 1;
    }
  }
}

// ───────── 통계 ─────────
const q = (xs: number[], p: number) => {
  if (!xs.length) return NaN;
  const a = [...xs].sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.floor(p * a.length))]!;
};
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const eok = (v: number) => (v / 1e4).toFixed(v < 1e5 ? 2 : 0) + '억';

function seeds(n: number) {
  const m = createRng(+(process.env.SEED || 2026));
  return Array.from({ length: n }, () => (m.next() * 0x100000000) >>> 0);
}

function modeMoney(n: number) {
  const out = seeds(n).map((sd) => career(sd));
  const byAge = new Map<number, SeasonRow[]>();
  for (const c of out)
    for (const r of c.seasons) byAge.set(r.age, [...(byAge.get(r.age) ?? []), r]);
  console.log(`나이별 시즌 말 보유 자금·연봉 (n=${n}, INVEST=${INVEST ? 1 : 0})`);
  console.log('나이  표본  자금p25  자금p50  자금p75  자금p90  연봉p50  연봉p90');
  for (const age of [...byAge.keys()].sort((a, b) => a - b)) {
    const rs = byAge.get(age)!;
    if (rs.length < n * 0.1) continue;
    const m = rs.map((x) => x.money),
      sl = rs.map((x) => x.salary);
    console.log(
      [age, rs.length, q(m, 0.25), q(m, 0.5), q(m, 0.75), q(m, 0.9), q(sl, 0.5), q(sl, 0.9)]
        .map((v, i) => (i < 2 ? String(v).padStart(4) : eok(v as number).padStart(8)))
        .join(' '),
    );
  }
  const fin = out.map((c) => c.money);
  console.log(
    `은퇴 시 자금 p25 ${eok(q(fin, 0.25))} · p50 ${eok(q(fin, 0.5))} · p90 ${eok(q(fin, 0.9))} · 은퇴 나이 p50 ${q(
      out.map((c) => c.retireAge),
      0.5,
    )}`,
  );
}

function modeEffect(n: number) {
  const sd = seeds(n);
  const base = sd.map((x) => career(x));
  console.log(`잠재력 +k 효과 (n=${n}, 같은 시드 짝 비교)`);
  console.log('나이  +k   최고OVR Δ평균  Δp50   레전드 Δ평균  실제 등급 상승%');
  for (const age of [19, 21, 23, 25, 27, 29])
    for (const k of [1, 3]) {
      const arm = sd.map((x) =>
        career(x, (s) => {
          if (s.age === age) s.flags.potBonus = (s.flags.potBonus ?? 0) + k;
        }),
      );
      const dp = arm.map((c, i) => c.peak - base[i]!.peak);
      const dl = arm.map((c, i) => c.legend - base[i]!.legend);
      const up = arm.filter(
        (c, i) => 'DCBAS'.indexOf(c.tpGrade) > 'DCBAS'.indexOf(base[i]!.tpGrade),
      );
      console.log(
        `${String(age).padStart(4)}  +${k}   ${mean(dp).toFixed(2).padStart(8)}  ${String(q(dp, 0.5)).padStart(5)}  ${mean(dl).toFixed(0).padStart(10)}  ${((up.length / n) * 100).toFixed(0).padStart(8)}`,
      );
    }
}

// 후보: 단계 5(+5), 시즌마다 1번, 30세까지. 비용 = max(최소, 연봉 × 비율).
export const CONFIGS: BoostConfig[] = [
  {
    name: 'A 쉬움 · 연봉 10~30% · 70→30%',
    p: [0.7, 0.6, 0.5, 0.4, 0.3],
    min: [300, 500, 800, 1200, 2000],
    rate: [0.1, 0.15, 0.2, 0.25, 0.3],
    maxAge: 30,
    perSeason: 1,
    reserve: 1.5,
  },
  {
    name: 'B 기본 · 연봉 20~60% · 60→20%',
    p: [0.6, 0.5, 0.4, 0.3, 0.2],
    min: [500, 1000, 2000, 3000, 5000],
    rate: [0.2, 0.3, 0.4, 0.5, 0.6],
    maxAge: 30,
    perSeason: 1,
    reserve: 1.5,
  },
  {
    name: 'C 기본+하락 · B + 3단계부터 실패 시 30% 하락',
    p: [0.6, 0.5, 0.4, 0.3, 0.2],
    min: [500, 1000, 2000, 3000, 5000],
    rate: [0.2, 0.3, 0.4, 0.5, 0.6],
    down: { from: 3, p: 0.3 },
    maxAge: 30,
    perSeason: 1,
    reserve: 1.5,
  },
  {
    name: 'D 비쌈 · 연봉 40~120% · 50→15%',
    p: [0.5, 0.4, 0.3, 0.2, 0.15],
    min: [1000, 2000, 4000, 6000, 10000],
    rate: [0.4, 0.6, 0.8, 1.0, 1.2],
    maxAge: 30,
    perSeason: 1,
    reserve: 1.2,
  },
  {
    name: 'E 시즌 2회 · B 가격·확률',
    p: [0.6, 0.5, 0.4, 0.3, 0.2],
    min: [500, 1000, 2000, 3000, 5000],
    rate: [0.2, 0.3, 0.4, 0.5, 0.6],
    maxAge: 30,
    perSeason: 2,
    reserve: 1.5,
  },
  {
    name: 'F 가파름+하락 · 연봉 20~100% · 60→10% · 3단계부터 30% 하락 · 29세까지',
    p: [0.6, 0.45, 0.3, 0.2, 0.1],
    min: [500, 1000, 2000, 4000, 8000],
    rate: [0.2, 0.35, 0.5, 0.75, 1.0],
    down: { from: 3, p: 0.3 },
    maxAge: 29,
    perSeason: 1,
    reserve: 1.5,
  },
  {
    name: 'G 가파름 시즌 2회 · F 가격·확률, 하락 없음',
    p: [0.6, 0.45, 0.3, 0.2, 0.1],
    min: [500, 1000, 2000, 4000, 8000],
    rate: [0.2, 0.35, 0.5, 0.75, 1.0],
    maxAge: 29,
    perSeason: 2,
    reserve: 1.5,
  },
  {
    name: 'H 가파름 · F 가격·확률, 하락 없음, 26세까지',
    p: [0.6, 0.45, 0.3, 0.2, 0.1],
    min: [500, 1000, 2000, 4000, 8000],
    rate: [0.2, 0.35, 0.5, 0.75, 1.0],
    maxAge: 26,
    perSeason: 1,
    reserve: 1.5,
  },
  {
    name: 'I 저축형 · 연봉 50~300% · 60→10% · 실패마다 +10%p · 29세까지',
    p: [0.6, 0.45, 0.3, 0.2, 0.1],
    min: [1000, 2000, 4000, 8000, 15000],
    rate: [0.5, 1.0, 1.5, 2.0, 3.0],
    pity: 0.1,
    maxAge: 29,
    perSeason: 1,
    reserve: 1,
  },
  {
    name: 'J 저축형+하락 · I 가격·확률, 보정 대신 3단계부터 30% 하락',
    p: [0.6, 0.45, 0.3, 0.2, 0.1],
    min: [1000, 2000, 4000, 8000, 15000],
    rate: [0.5, 1.0, 1.5, 2.0, 3.0],
    down: { from: 3, p: 0.3 },
    maxAge: 29,
    perSeason: 1,
    reserve: 1,
  },
  {
    name: 'K 저축형 시즌 2회 · I 그대로',
    p: [0.6, 0.45, 0.3, 0.2, 0.1],
    min: [1000, 2000, 4000, 8000, 15000],
    rate: [0.5, 1.0, 1.5, 2.0, 3.0],
    pity: 0.1,
    maxAge: 29,
    perSeason: 2,
    reserve: 1,
  },
  {
    name: 'L 추천 · 4단계 · 연봉 50~200% · 60/45/30/20% · 실패마다 +10%p · 29세까지',
    p: [0.6, 0.45, 0.3, 0.2],
    min: [1000, 2000, 4000, 8000],
    rate: [0.5, 1.0, 1.5, 2.0],
    pity: 0.1,
    maxAge: 29,
    perSeason: 1,
    reserve: 1,
  },
  {
    name: 'M 부담 · 연봉 100~300% · 45/30/20/12% · 실패마다 +5%p · 29세까지',
    p: [0.45, 0.3, 0.2, 0.12],
    min: [3000, 6000, 10000, 20000],
    rate: [1.0, 1.5, 2.0, 3.0],
    pity: 0.05,
    maxAge: 29,
    perSeason: 1,
    reserve: 1,
  },
  {
    name: 'N 부담+하락 · M + 3단계부터 실패 시 20% 하락',
    p: [0.45, 0.3, 0.2, 0.12],
    min: [3000, 6000, 10000, 20000],
    rate: [1.0, 1.5, 2.0, 3.0],
    pity: 0.05,
    down: { from: 2, p: 0.2 },
    maxAge: 29,
    perSeason: 1,
    reserve: 1,
  },
  {
    name: 'O 중간 · 연봉 70~250% · 50/35/25/15% · 실패마다 +5%p · 29세까지',
    p: [0.5, 0.35, 0.25, 0.15],
    min: [2000, 4000, 8000, 15000],
    rate: [0.7, 1.2, 1.8, 2.5],
    pity: 0.05,
    maxAge: 29,
    perSeason: 1,
    reserve: 1,
  },
  {
    name: '출시 · game BOOST(연봉 70~250% · 50/35/25/15% · 실패마다 +5%p · 29세까지)',
    p: [...BOOST.p],
    min: [...BOOST.min],
    rate: [...BOOST.rate],
    pity: BOOST.pity,
    maxAge: BOOST.maxAge,
    perSeason: 1,
    reserve: 1,
  },
];

function modeBoost(n: number) {
  const sd = seeds(n);
  const base = sd.map((x) => career(x));
  const only = process.env.ONLY;
  console.log(
    `강화 후보 비교 (n=${n}, INVEST=${INVEST ? 1 : 0}) · 강화 없음 최고 OVR p50 ${q(
      base.map((a) => a.peak),
      0.5,
    )} p90 ${q(
      base.map((a) => a.peak),
      0.9,
    )} · 레전드 p50 ${q(
      base.map((a) => a.legend),
      0.5,
    )} p90 ${q(
      base.map((a) => a.legend),
      0.9,
    )}`,
  );
  for (const c of CONFIGS) {
    if (only && !c.name.startsWith(only)) continue;
    const arm = sd.map((x) => career(x, undefined, c));
    const B = arm.map((a) => a.boost!);
    const lv = B.map((b) => b.level);
    const dist = [0, 1, 2, 3, 4, 5].map((L) =>
      ((lv.filter((x) => x === L).length / n) * 100).toFixed(0),
    );
    const dp = arm.map((a, i) => a.peak - base[i]!.peak);
    const dl = arm.map((a, i) => a.legend - base[i]!.legend);
    const share = B.map((b) => b.spent / Math.max(1, b.income));
    const ages = B.flatMap((b) => b.ages);
    const band = (lo: number, hi: number) =>
      ((ages.filter((a) => a >= lo && a <= hi).length / Math.max(1, ages.length)) * 100).toFixed(0);
    const first = B.filter((b) => b.ages.length).map((b) => b.ages[0]!);
    const none = B.filter((b) => !b.ages.length).length;
    console.log(`\n■ ${c.name}`);
    console.log(
      `  시도 평균 ${mean(B.map((b) => b.tries)).toFixed(1)} · 성공 ${mean(B.map((b) => b.ok)).toFixed(1)} · 하락 ${mean(B.map((b) => b.down)).toFixed(2)}`,
    );
    console.log(`  최종 단계 분포(0~5, %) ${dist.join(' / ')}`);
    console.log(
      `  지출 p50 ${eok(
        q(
          B.map((b) => b.spent),
          0.5,
        ),
      )} · p90 ${eok(
        q(
          B.map((b) => b.spent),
          0.9,
        ),
      )} · 수입 대비 p50 ${(q(share, 0.5) * 100).toFixed(0)}% · 은퇴 자금 p50 ${eok(
        q(
          arm.map((a) => a.money),
          0.5,
        ),
      )} (강화 없음 ${eok(
        q(
          base.map((a) => a.money),
          0.5,
        ),
      )})`,
    );
    console.log(
      `  최고 OVR Δ 평균 ${mean(dp).toFixed(2)} · p50 ${q(dp, 0.5)} · p90 ${q(dp, 0.9)} · 레전드 Δ 평균 ${mean(dl).toFixed(0)}`,
    );
    console.log(
      `  시도 나이 ~21 ${band(0, 21)}% · 22~25 ${band(22, 25)}% · 26~ ${band(26, 99)}% · 첫 시도 p25 ${q(first, 0.25)} p50 ${q(first, 0.5)} · 한 번도 못 함 ${((none / n) * 100).toFixed(0)}%`,
    );
    const byInc = [...arm.keys()].sort((x, y) => base[x]!.money - base[y]!.money);
    const qt = (lo: number, hi: number) =>
      mean(byInc.slice(Math.floor(lo * n), Math.floor(hi * n)).map((i) => B[i]!.level)).toFixed(1);
    console.log(
      `  평균 단계 · 자금 하위 25% ${qt(0, 0.25)} · 중간 50% ${qt(0.25, 0.75)} · 상위 25% ${qt(0.75, 1)}`,
    );
    // 서버 plausibility의 나이별 OVR 상한(만 18~23세)을 넘는 시즌 수 — 넘으면 서버가 잘라 저장한다.
    const over = (cs: Career[]) =>
      cs
        .flatMap((a) => a.seasons)
        .filter((r) => r.age <= 23 && r.ovr > OVR_CAP_BY_AGE[Math.max(r.age, 18) - 18]!).length;
    console.log(`  서버 나이별 OVR 상한 초과 시즌 ${over(arm)} (강화 없음 ${over(base)})`);
    console.log(`  +1 OVR당 지출 ${eok(mean(B.map((b) => b.spent)) / Math.max(0.01, mean(dp)))}`);
  }
}

const mode = process.argv[2] || 'money';
const N = +(process.argv[3] || 300);
const t0 = Date.now();
if (mode === 'money') modeMoney(N);
else if (mode === 'effect') modeEffect(N);
else modeBoost(N);
console.error(`(${((Date.now() - t0) / 1000).toFixed(0)}s)`);
