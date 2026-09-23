// 풀타임(fulltime) 원본 analysis/simulate.js 를 포팅한 TS 시뮬레이션 러너.
// 포트된(ported) apps/web/src/game/* ES 모듈을 그대로 import 해서, DOM/UI 없이
// N개의 랜덤(또는 "스마트") 정책 커리어를 은퇴까지 헤드리스로 돌리고
// 커리어별 CSV + 집계 JSON 을 저장한다. 원본과 동일한 정책 로직을 그대로 옮겼다.
//
// 실행: tsx simulate.ts [커리어 수] [정책: random|smart] [태그]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LEAGUES,
  TYPES,
  TRAITS,
  POS,
  ATTR_KEYS,
  LAST_PHASE,
  newGame,
  applyTraining,
  simBlock,
  rollEvent,
  resolveChoice,
  leagueOf,
  ovr,
  compsPhase,
  natWindow,
  endSeason,
  market,
  acceptOption,
  retire,
  legendScore,
  legendTitle,
  EVENTS,
} from '../../apps/web/src/game/index.js';
import { pick, ri, createRng, setActiveRng, freshSeed } from '../../apps/web/src/game/rng.js';
import type { GameState, MarketOption, OfferOption } from '../../apps/web/src/game/types.js';

// ───────── Node 환경에 localStorage 스텁 (retire()/HOF 저장용, season.ts 는 이미 try/catch 로 감싸지만 예외 비용을 피한다) ─────────
if (typeof (globalThis as Record<string, unknown>).localStorage === 'undefined') {
  const mem = new Map<string, string>();
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  };
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type Agg = Record<string, number | Record<string, number> | Record<string, Record<string, number>>>;

function newAgg(): Agg {
  return {
    errors: 0, ev: {}, evOk: {}, evChoice: {}, awards: {}, trophies: {}, endings: {}, mil: {}, title: {},
    ovrByAge: {}, nByAge: {}, tierByAge: {}, roleByAge: {}, peakByPos: {}, nByPos: {}, firstLeague: {}, maxLeague: {},
    retireReason: {}, ballonBest: {}, repeats: 0, distinct: 0, tours: {}, miles: {}, capsBin: {}, legendBin: {}, moneyBin: {},
    condLow: 0, blocks: 0, injBlocks: 0, benchSeasons: 0, proSeasons: 0,
  };
}
const inc = (o: Record<string, number>, k: string | number, v = 1) => { o[k] = (o[k] || 0) + v; };
const inc2 = (o: Record<string, Record<string, number>>, k: string | number, kk: string | number, v = 1) => {
  o[k] = o[k] || {}; o[k][kk] = (o[k][kk] || 0) + v;
};

interface Row {
  [k: string]: string | number;
}

function run(N: number, policy: 'random' | 'smart'): { rows: Row[]; agg: Agg } {
  const smart = policy === 'smart';
  const A = newAgg();
  const rows: Row[] = [];
  let s_cur: GameState | null = null;

  for (let iter = 0; iter < N; iter++) {
    setActiveRng(createRng(freshSeed()));
    const pos = pick(['FW', 'MF', 'DF', 'GK'] as const);
    const type = pick(TYPES[pos]).id;
    const trait = pick(TRAITS).id;
    const seed = freshSeed();
    let s = newGame({ name: 'SIM', number: 9, pos, foot: '오른발', type, trait }, seed);
    const pot0 = s.pot;
    const seen: Record<string, 1> = {};
    let events = 0, evOk = 0, injuries = 0;
    let proDebutAge: number | null = null, euAge: number | null = null, retireReason = 'age35';
    const clubs = new Set<string>();

    try {
      for (let y = 0; y < 30 && !s.retired; y++) {
        for (let ph = 0; ph <= LAST_PHASE; ph++) {
          s.training = pickTraining(s);
          applyTraining(s);
          if (s.phase > 0) {
            (A.blocks as number)++;
            if (s.cond < 40) (A.condLow as number)++;
            const b = simBlock(s);
            if (b.injured) { injuries++; (A.injBlocks as number)++; }
          }
          compsPhase(s); natWindow(s);
          const e = rollEvent(s); s.phase++;
          if (e) {
            const E = EVENTS.find((x) => x.id === e)!;
            const idx = pickChoice(s, E);
            const r = resolveChoice(s, e, idx);
            events++; if (r.ok) evOk++;
            if (seen[e]) (A.repeats as number)++; else { seen[e] = 1; (A.distinct as number)++; }
            inc(A.ev as Record<string, number>, e);
            if (r.ok) inc(A.evOk as Record<string, number>, e);
            inc2(A.evChoice as Record<string, Record<string, number>>, e, idx);
          }
        }
        const res = endSeason(s);
        const rec = res.rec, L = LEAGUES.find((l) => l.name === rec.league);
        if (rec.pro) {
          (A.proSeasons as number)++;
          if (L && rec.apps < L.matches * 0.3) (A.benchSeasons as number)++;
          if (proDebutAge === null && rec.apps) proDebutAge = rec.age;
        }
        if (L && L.tier >= 4 && euAge === null) euAge = rec.age;
        clubs.add(rec.club);
        inc(A.ovrByAge as Record<string, number>, rec.age, rec.ovr);
        inc(A.nByAge as Record<string, number>, rec.age);
        inc2(A.tierByAge as Record<string, Record<string, number>>, rec.age, L ? L.tier : -1);
        res.tours.forEach((t: { inSquad: boolean; name: string; stage: string }) => {
          if (t.inSquad) inc(A.tours as Record<string, number>, t.name.replace(/^\d+ /, '').replace(/ \(.*/, '') + ':' + t.stage);
        });
        s_cur = s;
        let m = market(s), g = 0;
        while (true) {
          if (!m.options.length) { retireReason = 'noOffers'; retire(s); break; }
          if (m.canRetire && (s.age >= 35 || (s.age >= 28 && !m.options.some(realJob)) || !m.options.some(anyJob))) {
            retireReason = s.age >= 35 ? 'age35' : 'washout'; retire(s); break;
          }
          const opt = pickOption(s, m);
          const r = acceptOption(s, opt) as { reopen?: boolean } | null;
          if (r && r.reopen && g++ < 5) { m = market(s); continue; }
          break;
        }
      }
      if (!s.retired) { retireReason = 'cap'; retire(s); }
    } catch {
      (A.errors as number)++;
      continue;
    }

    const pro = s.career.filter((r) => r.pro);
    const T = pro.reduce((a, r) => ({ p: a.p + r.apps, g: a.g + r.goals, a: a.a + r.assists }), { p: 0, g: 0, a: 0 });
    const maxTier = Math.max(0, ...s.career.map((r) => (LEAGUES.find((l) => l.name === r.league) || { tier: 0 }).tier));
    const first = pro[0] ? pro[0].league : 'none';
    const ballonBest = (s.ballon || []).reduce((b, x) => Math.min(b, x.rank), 99);
    const score = legendScore(s), title = legendTitle(score);
    s.trophies.forEach((t) => inc(A.trophies as Record<string, number>, t.t));
    s.awards.forEach((t) => inc(A.awards as Record<string, number>, t.t));
    (s.storyLog || []).forEach((x) => inc(A.endings as Record<string, number>, x.name + ':' + x.ending));
    (s.miles || []).forEach((x) => inc(A.miles as Record<string, number>, x.t.replace(/\(.*\)/, '').replace(/ · .*/, '').replace(/^.* (홈구장에서 은퇴 경기|레전드 헌정)$/, '$1')));
    inc(A.mil as Record<string, number>, s.mil.exempt ? 'exempt:' + s.mil.exempt : s.mil.served ? 'served:' + s.mil.type : s.mil.serving ? 'serving' : 'none');
    inc(A.title as Record<string, number>, title);
    inc(A.peakByPos as Record<string, number>, pos, s.peak);
    inc(A.nByPos as Record<string, number>, pos);
    inc(A.firstLeague as Record<string, number>, first);
    inc(A.maxLeague as Record<string, number>, maxTier);
    inc(A.retireReason as Record<string, number>, retireReason);
    inc(A.ballonBest as Record<string, number>, ballonBest === 99 ? 'none' : ballonBest === 1 ? '1' : ballonBest <= 10 ? '2-10' : '11-30');
    inc(A.capsBin as Record<string, number>, s.nat.caps === 0 ? '0' : s.nat.caps < 30 ? '1-29' : s.nat.caps < 70 ? '30-69' : s.nat.caps < 100 ? '70-99' : '100+');
    inc(A.legendBin as Record<string, number>, Math.floor(score / 100) * 100);
    inc(A.moneyBin as Record<string, number>, s.money < 1e4 ? '<1억' : s.money < 1e5 ? '1-10억' : s.money < 1e6 ? '10-100억' : '100억+');

    rows.push({
      pos, type, trait, pot: pot0, peak: s.peak, retireAge: s.age, seasons: s.career.length, proSeasons: pro.length,
      proDebutAge: proDebutAge ?? '', euAge: euAge ?? '', firstLeague: first, maxTier, clubs: clubs.size,
      apps: T.p, goals: T.g, assists: T.a, caps: s.nat.caps, ntGoals: s.nat.goals,
      trophies: s.trophies.length, awards: s.awards.length, ballon: s.awards.filter((x) => x.t === '발롱도르').length,
      ballonBest: ballonBest === 99 ? '' : ballonBest,
      wc: s.trophies.filter((x) => x.t === 'FIFA 월드컵 우승').length, ucl: s.trophies.filter((x) => x.t === 'UEFA 챔피언스리그 우승').length,
      mil: s.mil.exempt ? 'exempt' : s.mil.served ? s.mil.type! : 'none',
      events, evOk, injuries, money: Math.round(s.money), fameEnd: Math.round(s.fame), legend: score, title, retireReason,
    });
  }
  return { rows, agg: A };

  // ── 정책 (analysis/simulate.js 의 pickTraining / value / pickChoice / pickOption / anyJob / realJob 그대로 이식) ──
  function pickTraining(s: GameState): string {
    if (!smart) return s.cond < 45 ? 'rest' : pick(ATTR_KEYS);
    if (s.cond < 55) return 'rest';
    return [...ATTR_KEYS].filter((k) => (POS[s.pos].w[k] ?? 0) >= 0.1)
      .sort((a, b) => (s.attrs[a] - (POS[s.pos].w[a] ?? 0) * 40) - (s.attrs[b] - (POS[s.pos].w[b] ?? 0) * 40))[0]!;
  }
  function value(x: GameState): number {
    const S = x.season || ({} as GameState['season']);
    return ovr(x) * 3 + ((x.flags && x.flags.potBonus) || 0) * 3 + x.fame * 0.15 + x.morale * 0.08 + x.trust * 1.2 + x.cond * 0.03
      + Math.log10(Math.max(1, x.money)) * 2 + (S.goals || 0) * 0.5 + (S.assists || 0) * 0.3 + (S.cs || 0) * 0.3 - x.injury * 0.8
      + (x.nat ? x.nat.caps * 0.2 : 0) + (x.flags && x.flags.scouted ? 2 : 0) + (x.awards ? x.awards.length * 3 : 0);
  }
  function pickChoice(s: GameState, E: (typeof EVENTS)[number]): number {
    if (!smart) return ri(0, E.choices.length - 1);
    const snap = JSON.stringify(s);
    let best = 0, bv = -1e9;
    E.choices.forEach((_, i) => {
      let v = 0;
      for (let k = 0; k < 8; k++) {
        const x = JSON.parse(snap) as GameState;
        resolveChoice(x, E.id, i);
        v += value(x);
      }
      if (v > bv) { bv = v; best = i; }
    });
    return best;
  }
  function pickOption(s: GameState, m: { options: MarketOption[] }): MarketOption {
    const milO = m.options.find((o) => o.kind === 'sangmu' && o.due)
      || m.options.find((o) => o.kind === 'serve')
      || (smart ? m.options.find((o) => o.kind === 'sangmu' && s.age >= 25) : undefined);
    if (milO) return milO;
    const offers = m.options.filter((o): o is OfferOption => o.kind === 'offer');
    const stay = m.options.find((o) => o.kind === 'stay' || o.kind === 'renew');
    if (smart) {
      const good = offers.filter((o) => o.role !== '벤치 경쟁').sort((a, b) => b.str - a.str)[0];
      if (good && (!stay || good.str > s.club.str + 1)) return good;
      return stay || good || offers[0] || m.options.find((o) => o.kind !== 'sangmu') || m.options[0]!;
    }
    const best = offers.sort((a, b) => b.str - a.str)[0];
    return best && (!stay || best.str > s.club.str + 2) ? best : stay || m.options.find((o) => o.kind !== 'sangmu') || m.options[0]!;
  }
  function anyJob(o: MarketOption): boolean {
    return (['offer', 'renew', 'stay', 'uni', 'sangmu', 'army', 'serve'] as MarketOption['kind'][]).includes(o.kind);
  }
  function realJob(o: MarketOption): boolean {
    if (o.kind === 'sangmu' || o.kind === 'army' || o.kind === 'serve') return true;
    const L = o.kind === 'offer' ? LEAGUES.find((l) => l.id === o.leagueId) : leagueOf(s_cur!.leagueId);
    return !!L && L.tier >= 1 && anyJob(o);
  }
}

async function main() {
  const N = +(process.argv[2] || 20000);
  const policy = (process.argv[3] || 'random') as 'random' | 'smart';
  const tag = process.argv[4] || 'ts-port';
  const outDir = path.join(__dirname, 'results', tag);
  fs.mkdirSync(outDir, { recursive: true });
  const t0 = Date.now();
  const { rows, agg } = run(N, policy);
  const cols = Object.keys(rows[0]!);
  fs.writeFileSync(path.join(outDir, `careers-${policy}.csv`), [cols.join(','), ...rows.map((r) => cols.map((c) => r[c]).join(','))].join('\n'));
  const out: Record<string, unknown> = { n: rows.length, policy, secs: (Date.now() - t0) / 1000, ...agg };
  fs.writeFileSync(path.join(outDir, `aggregate-${policy}.json`), JSON.stringify(out, null, 1));
  console.log(`[${tag}] ${rows.length} careers (${policy}) in ${((Date.now() - t0) / 1000).toFixed(1)}s, errors ${agg.errors}`);
}

main();
