// T-11-825 원정 투어 수치 맞추기용 시뮬레이션. 실제 구단주 카드 표본(익명, 저장소 밖 파일)을 읽어 단계별 승률 · 통과율 · 대전료
// 유입 · 순위 동점을 잰다. 표본 파일이 없으면 건너뛴다.
//   TOUR_SIM_DATA=/path/cards.jsonl pnpm --filter @offside/api exec vitest run src/team/squadTour.sim.test.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { describe, it } from 'vitest';
import type { FormationId } from '@offside/contracts/owner-team';
import type { PosGroup, DetailPos, PeakProfile } from '@offside/contracts/positions';
import {
  TOUR,
  tourFee,
  tourMerc,
  tourOpp,
  tourRankCompare,
  tourRules,
  tourScore,
  type TourRule,
} from '@offside/contracts/squad-tour';
import { filledCount, lineupOvr, rngOf, seedOf, type LineupCareer } from './sim.js';
import {
  playTourMatch,
  tourAutoSlots,
  tourLineup,
  tourOpponent,
  tourWinChance,
} from './squadTour.js';

const DATA = process.env.TOUR_SIM_DATA;
const SEASON = 2;
const ATK_K = Number(process.env.TOUR_ATK_K ?? TOUR.atkK);
/** 이길 가망이 이 아래면 그 주 도전을 그만둔다(0이면 남은 도전을 다 쓴다). */
const STOP = Number(process.env.TOUR_STOP ?? 0.05);
const WEEKS = ['2026-11-30', '2026-12-07', '2026-12-14', '2026-12-21'];
const MAX_STAGE = 40;
const MC = 150;
/** 활성 구단주(시즌 중 랭크 10경기 이상) 수와 보유 카드 수 구간 비중. */
const ACTIVE = 855;
const GROUPS = ['~15', '16~33', '34~'];
const POP: Record<string, number> = { '~15': 0.42, '16~33': 0.4, '34~': 0.18 };
const group = (o: { cards: unknown[] }) =>
  o.cards.length <= 15 ? '~15' : o.cards.length <= 33 ? '16~33' : '34~';
/** 제한별 손실을 잴 때의 용병 실력(상대 90 기준). */
const RULE_MERC = Number(process.env.TOUR_RULE_MERC ?? 80);

type Row = {
  o: number;
  f: string;
  tovr: number;
  pos: PosGroup;
  dpos: DetailPos | null;
  peak: number;
  e: number;
  s: number;
  n: string | null;
  roles: string | null;
  t: string | null;
  ml: string | null;
  mc: string | null;
  ft: string | null;
  r: number;
};
type Owner = { id: number; formation: FormationId; ovr: number; cards: LineupCareer[] };

function load(path: string): Owner[] {
  const by = new Map<number, Owner>();
  readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .forEach((line, k) => {
      const r = JSON.parse(line) as Row;
      let o = by.get(r.o);
      if (!o) by.set(r.o, (o = { id: r.o, formation: r.f as FormationId, ovr: r.tovr, cards: [] }));
      o.cards.push({
        id: `c${k}`,
        pos: r.pos,
        dpos: r.dpos,
        peak: r.peak,
        roles: r.roles ? (JSON.parse(r.roles) as PeakProfile['roles']) : null,
        number: null,
        publicName: null,
        type: r.t,
        foot: r.ft,
        nation: r.n,
        raised: !!r.r,
        mainLeague: r.ml,
        mainClub: r.mc,
        season: r.s,
        enhance: r.e,
      });
    });
  return [...by.values()];
}

const pct = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))]! : NaN;
};
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : '-');
const f0 = (x: number) => (Number.isFinite(x) ? Math.round(x).toString() : '-');
const ruleText = (rs: TourRule[]) =>
  rs
    .map((r) =>
      'max' in r
        ? `${r.kind}${'league' in r ? `(${r.league})` : ''}<=${r.max}`
        : 'when' in r
          ? `season:${r.when}`
          : 'league' in r
            ? `ban(${r.league})`
            : r.kind,
    )
    .join(' + ');
const band = (ovr: number) =>
  ovr < 85 ? '<85' : ovr < 90 ? '85-89' : ovr < 94 ? '90-93' : ovr < 98 ? '94-97' : '98+';
const BANDS = ['<85', '85-89', '90-93', '94-97', '98+'];

/** 구단주 한 명 · 한 주의 단계별 준비: 자동 편성 · 팀 OVR · 내 카드 수 · 이길 가망 · 경기 표본(승패 · 골득실). */
type Prep = {
  ovr: number;
  /** 선발 가운데 내 카드 수(나머지는 용병). */
  own: number;
  /** 한 판 승률(경기 표본). */
  p: number;
  /** 난수 없이 계산한 이길 가망 — 그만둘지 정할 때 쓴다. */
  chance: number;
  /** 기본 포메이션 셋 가운데 가장 유리한 편성의 이길 가망. */
  best: number;
  out: { win: boolean; gd: number }[];
};

const FORMS: FormationId[] = ['4-3-3', '4-4-2', '3-5-2'];

function prep(o: Owner, week: string, stage: number): Prep {
  const rules = tourRules(week, stage);
  const merc = tourMerc(stage);
  const lineupOf = (f: FormationId) =>
    tourLineup(f, tourAutoSlots(f, o.cards, rules, SEASON, merc), o.cards, rules, merc);
  const mine = lineupOf(o.formation);
  const opp = tourOpponent(week, stage);
  const out: Prep['out'] = [];
  for (let k = 0; k < MC; k++) {
    const m = playTourMatch(`${week}:${stage}:${o.id}:${k}`, mine, opp, SEASON, ATK_K);
    out.push({ win: m.win, gd: m.pens ? 0 : m.goalsFor - m.goalsAgainst });
  }
  const chance = tourWinChance(mine, opp, SEASON, ATK_K);
  return {
    ovr: lineupOvr(mine),
    own: filledCount(mine),
    p: out.filter((x) => x.win).length / MC,
    chance,
    best: Math.max(chance, ...FORMS.map((f) => tourWinChance(lineupOf(f), opp, SEASON, ATK_K))),
    out,
  };
}

/** 하루 도전 수 목록(월~일)으로 한 주를 치른다 → 통과한 경기 수 · 대전료 · 순위 값. */
function playWeek(preps: (stage: number) => Prep, days: readonly number[], rng: () => number) {
  let stage = 1;
  let tries = 0;
  let fee = 0;
  let score = 0;
  let used = 0;
  let triesAtScore = 0;
  let reachedAt = '';
  let quit = false;
  days.forEach((n, day) => {
    for (let k = 0; k < n && !quit && stage <= MAX_STAGE; k++) {
      const pr = preps(stage);
      // 이길 가망이 거의 없으면 그 주는 그만둔다.
      if (pr.chance < STOP) {
        quit = true;
        break;
      }
      used++;
      tries++;
      const m = pr.out[Math.floor(rng() * pr.out.length)]!;
      if (!m.win) continue;
      fee += tourFee(stage);
      score += tourScore(stage, m.gd, tries);
      triesAtScore = used;
      // 그 점수에 이른 시각: 요일 + 그날 안의 임의 시각.
      reachedAt = `${day}:${rng().toFixed(6)}`;
      stage++;
      tries = 0;
    }
  });
  return { cleared: stage - 1, fee, score, used, triesAtScore, reachedAt };
}

describe.skipIf(!DATA)('원정 투어 시뮬레이션', () => {
  it('단계별 승률 · 통과율 · 유입 · 순위', { timeout: 1_800_000 }, () => {
    const owners = load(DATA!);
    const log: string[] = [];
    const say = (s = '') => log.push(s);
    // 표본은 카드가 많은 구단주가 모집단보다 적다 → 카드 수 구간 비중을 모집단(42 · 40 · 18%)에 맞춘다.
    const share = new Map(GROUPS.map((g) => [g, owners.filter((o) => group(o) === g).length]));
    const weight = (o: Owner) => (POP[group(o)]! * owners.length) / share.get(group(o))!;
    const wavg = (rows: { o: Owner; v: number }[]) =>
      rows.reduce((a, r) => a + r.v * weight(r.o), 0) / rows.reduce((a, r) => a + weight(r.o), 0);
    say(
      `구단주 ${owners.length}명(카드 수 구간 ${GROUPS.map((g) => `${g}:${share.get(g)}`).join(' ')}), 카드 ${owners.reduce((a, o) => a + o.cards.length, 0)}장, atkK ${ATK_K}, 그만두는 기준 ${STOP}`,
    );
    say(
      `지난 시즌 카드가 없는 구단주 ${owners.filter((o) => !o.cards.some((c) => (c.season ?? 0) < SEASON)).length}명`,
    );

    const MIX = [
      { name: '매일 3번', days: [3, 3, 3, 3, 3, 3, 3], share: 0.3 },
      { name: '하루 1~2번', days: [2, 1, 2, 1, 2, 1, 1], share: 0.4 },
      { name: '가끔(이틀)', days: [0, 0, 2, 0, 0, 2, 0], share: 0.3 },
    ];
    const totals = { fee: 0 };
    const done = MIX.map(() => [] as number[]);
    for (const week of WEEKS) {
      const memo = new Map<string, Prep>();
      const get = (o: Owner) => (stage: number) => {
        const k = `${o.id}:${stage}`;
        let v = memo.get(k);
        if (!v) memo.set(k, (v = prep(o, week, stage)));
        return v;
      };
      say();
      say(`== ${week} ==`);
      say(
        '경기 | 상대 | 제한 | 내 팀 OVR p10/p50/p90 | 내 카드 수 p10/p50 | 승률 p10/p50/p90 | 승률 대역별(<85 85-89 90-93 94-97 98+) | 카드 수 구간별(~15 16~33 34~)',
      );
      for (let s = 1; s <= 12; s++) {
        const ps = owners.map((o) => ({ o, p: get(o)(s) }));
        const q = (f: (x: Prep) => number, p: number) =>
          pct(
            ps.map((x) => f(x.p)),
            p,
          );
        const byBand = BANDS.map((b) =>
          f0(100 * avg(ps.filter((x) => band(x.o.ovr) === b).map((x) => x.p.p))),
        ).join(' ');
        const byGroup = GROUPS.map((g) =>
          f0(100 * avg(ps.filter((x) => group(x.o) === g).map((x) => x.p.p))),
        ).join(' ');
        say(
          `${s} | ${tourOpp(s)} | ${ruleText(tourRules(week, s))} | ${q((x) => x.ovr, 0.1)}/${q((x) => x.ovr, 0.5)}/${q((x) => x.ovr, 0.9)} | ${q((x) => x.own, 0.1)}/${q((x) => x.own, 0.5)} | ${f0(100 * q((x) => x.p, 0.1))}/${f0(100 * q((x) => x.p, 0.5))}/${f0(100 * q((x) => x.p, 0.9))} | ${byBand} | ${byGroup}`,
        );
      }
      // 본선 뒤쪽 경기: 고를 카드가 있는가, 편성을 바꾸면 달라지는가, 하루 세 번을 모두 지는가.
      for (const s of [5, 6, 7]) {
        const ps = owners.map((o) => get(o)(s));
        const n = ps.length;
        const gain = ps.map((x) => 100 * (x.best - x.chance));
        say(
          `  [${s}차전] 내 카드 0장 ${f0((100 * ps.filter((x) => x.own === 0).length) / n)}% · 3장 이하 ${f0((100 * ps.filter((x) => x.own <= 3).length) / n)}% | 하루 세 번 모두 질 확률 p50 ${f0(
            100 *
              pct(
                ps.map((x) => (1 - x.p) ** 3),
                0.5,
              ),
          )}% | 포메이션만 바꿔 얻는 승산 p50 ${f1(pct(gain, 0.5))}%p · 5%p 이상 ${gain.filter((g) => g >= 5).length}명`,
        );
      }
      MIX.forEach((mix, mi) => {
        const rng = rngOf(seedOf(`${week}:${mix.name}`));
        const res = owners.map((o) => ({ o, r: playWeek(get(o), mix.days, rng) }));
        const cleared = res.map((x) => x.r.cleared);
        const hist = Array.from({ length: 9 }, (_, n) =>
          n < 8 ? cleared.filter((c) => c === n).length : cleared.filter((c) => c >= 8).length,
        );
        const fin = wavg(res.map((x) => ({ o: x.o, v: x.r.cleared >= 7 ? 1 : 0 })));
        done[mi]!.push(fin);
        const feeAvg = wavg(res.map((x) => ({ o: x.o, v: x.r.fee })));
        say(
          `[${mix.name} · 도전 ${mix.days.reduce((a, b) => a + b, 0)}번] 통과 수 분포 0~7, 8+: ${hist.join(' ')} | 평균 ${f1(avg(cleared))} | 최고 ${Math.max(...cleared)} | 본선 완주 ${f0(100 * fin)}%`,
        );
        say(
          `  대전료(억) 가중 평균 ${f0(feeAvg / 10000)} | 대역별 ${BANDS.map((b) => `${b}:${f0(avg(res.filter((x) => band(x.o.ovr) === b).map((x) => x.r.fee)) / 10000)}`).join(' ')} | 카드 수 구간별 ${GROUPS.map((g) => `${g}:${f0(avg(res.filter((x) => group(x.o) === g).map((x) => x.r.fee)) / 10000)}`).join(' ')}`,
        );
        totals.fee += feeAvg * mix.share;
        if (mi === 0) {
          // 전체를 순위 규칙대로 세운 뒤 30위를 자른다. 동점 = 점수와 도전 수가 모두 같아 시각으로 가른 쌍.
          const all = [...res].sort((a, b) => tourRankCompare(a.r, b.r));
          const top = all.slice(0, 30);
          const pairs = (key: (x: (typeof all)[number]) => string) => {
            const m = new Map<string, number>();
            top.forEach((x) => m.set(key(x), (m.get(key(x)) ?? 0) + 1));
            return [...m.values()].reduce((a, c) => a + (c * (c - 1)) / 2, 0);
          };
          say(
            `  순위(모두 매일 3번 가정) 상위 30명: 통과 ${top.map((x) => x.r.cleared).join(',')} | 점수 동점 ${pairs((x) => `${x.r.score}`)}쌍 → 도전 수까지 같은 쌍 ${pairs((x) => `${x.r.score}:${x.r.triesAtScore}`)}쌍 | 30위와 31위 점수 ${all[29]!.r.score}/${all[30]!.r.score}`,
          );
          say(`  상위 30명 팀 OVR: ${top.map((x) => x.o.ovr).join(',')}`);
        }
      });
    }
    // 가중 평균 대전료(만 원) × 활성 구단주 수.
    const perOwner = totals.fee / WEEKS.length;
    const weekly = perOwner * ACTIVE;
    say();
    say(
      `본선 완주율(4주 평균): ${MIX.map((m, i) => `${m.name} ${f0(100 * avg(done[i]!))}%`).join(' · ')}`,
    );
    say(
      `참여한 구단주 한 명의 주간 대전료(참여 혼합 30/40/30%, 카드 수 구간 가중): ${f0(perOwner / 10000)}억`,
    );
    for (const part of [1, 0.7, 0.5])
      say(
        `  활성 ${ACTIVE}명 가운데 ${f0(part * 100)}% 참여: 주 ${f1((weekly * part) / 1e8)}조 = 하루 ${f1((weekly * part) / 1e8 / 7)}조`,
      );
    if (process.env.TOUR_SIM_OUT) writeFileSync(process.env.TOUR_SIM_OUT, log.join('\n'));
    else console.log(log.join('\n'));
  });

  // 제한 후보마다 팀이 얼마나 약해지는지(제한 없는 자동 편성 대비). 상대 실력 보정(TOUR_HANDICAP)을 정할 때 본다.
  it.skipIf(!process.env.TOUR_SIM_RULES)('제한별 전력 손실', { timeout: 600_000 }, () => {
    const owners = load(DATA!);
    const cands: TourRule[] = [
      { kind: 'typeCap', max: 3 },
      { kind: 'typeCap', max: 2 },
      { kind: 'nationCap', max: 6 },
      { kind: 'nationCap', max: 5 },
      { kind: 'nationCap', max: 4 },
      { kind: 'nationCap', max: 3 },
      { kind: 'leagueCap', league: 'pl', max: 6 },
      { kind: 'leagueCap', league: 'pl', max: 5 },
      { kind: 'leagueCap', league: 'pl', max: 4 },
      { kind: 'leagueCap', league: 'pl', max: 3 },
      { kind: 'leagueBan', league: 'pl' },
      { kind: 'leagueBan', league: 'll' },
      { kind: 'leagueBan', league: 'bl' },
      { kind: 'enhanceMax', max: 5 },
      { kind: 'enhanceMax', max: 4 },
      { kind: 'enhanceMax', max: 2 },
      { kind: 'enhanceMax', max: 0 },
      { kind: 'plain' },
      { kind: 'peakMax', max: 96 },
      { kind: 'peakMax', max: 95 },
      { kind: 'peakMax', max: 94 },
      { kind: 'peakMax', max: 92 },
      { kind: 'peakMax', max: 90 },
      { kind: 'season', when: 'now' },
      { kind: 'season', when: 'past' },
    ];
    const ovrOf = (o: Owner, rules: TourRule[]) => {
      const l = tourLineup(
        o.formation,
        tourAutoSlots(o.formation, o.cards, rules, SEASON, RULE_MERC),
        o.cards,
        rules,
        RULE_MERC,
      );
      return { ovr: lineupOvr(l), filled: filledCount(l) };
    };
    const base = new Map(owners.map((o) => [o.id, ovrOf(o, [])]));
    const log = [
      `제한 없는 자동 편성 OVR p10/p50/p90: ${pct(
        [...base.values()].map((b) => b.ovr),
        0.1,
      )}/${pct(
        [...base.values()].map((b) => b.ovr),
        0.5,
      )}/${pct(
        [...base.values()].map((b) => b.ovr),
        0.9,
      )}`,
      '제한 | 선발 p10/p25/p50 | OVR 손실 p25/p50/p75/p90 | 대역별 손실 중앙값(<85 85-89 90-93 94-97 98+)',
    ];
    for (const rule of cands) {
      const rs = owners.map((o) => {
        const v = ovrOf(o, [rule]);
        return { o, filled: v.filled, drop: base.get(o.id)!.ovr - v.ovr };
      });
      log.push(
        `${ruleText([rule])} | ${pct(
          rs.map((r) => r.filled),
          0.1,
        )}/${pct(
          rs.map((r) => r.filled),
          0.25,
        )}/${pct(
          rs.map((r) => r.filled),
          0.5,
        )} | ${pct(
          rs.map((r) => r.drop),
          0.25,
        )}/${pct(
          rs.map((r) => r.drop),
          0.5,
        )}/${pct(
          rs.map((r) => r.drop),
          0.75,
        )}/${pct(
          rs.map((r) => r.drop),
          0.9,
        )} | ${BANDS.map((b) =>
          pct(
            rs.filter((r) => band(r.o.ovr) === b).map((r) => r.drop),
            0.5,
          ),
        ).join(' ')}`,
      );
    }
    if (process.env.TOUR_SIM_OUT)
      writeFileSync(`${process.env.TOUR_SIM_OUT}.rules`, log.join('\n'));
    else console.log(log.join('\n'));
  });
});
