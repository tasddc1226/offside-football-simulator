// ───────── 시즌 종료 · 이적 시장 · 은퇴 · 저장 ─────────
import { CLUBS, type Club } from './data.js';
import { BAL } from './balance.js';
import { ovr } from './attributes.js';
import { clamp, ri, pick, rnd } from './rng.js';
import { leagueOf, clubsIn, fmtMoney, salaryFor, addStat, addAttr, log, bloomTick, newSeason, finalRank } from './engine.js';
import { seasonSetup, compGoals, seasonAwards, checkMilestones, retireMilestones } from './comps.js';
import { natInit, natSeasonEnd } from './national.js';
import { milSeasonEnd, milDue, milOptions, milEnlistMarket, acceptMilitary } from './military.js';
import { detectCareerHighs } from './records.js';
import type { LegendSnapshot } from '@offside/contracts';
import type { GameState, CareerRecord, HofEntry, LegendSource, MarketOption, OfferOption } from './types.js';

export function endSeason(s: GameState) {
  natInit(s);
  const L = leagueOf(s.leagueId), S = s.season, o = ovr(s);
  if (!S.comps) seasonSetup(s, S);
  const avg = S.apps ? S.ratingSum / S.apps : 0;
  const rank = finalRank(s);
  const trophies = [...(S.trophiesMid || [])], notes: string[] = [];

  if (rank === 1) trophies.push(`${L.name} 우승`);
  if (s.year % 4 === 1 && s.career.some((r) => r.year === s.year - 1 && r.club === s.club.name && r.honors.some((h) => /챔피언스(리그( 엘리트)?|컵) 우승/.test(h)))) {
    const stage = pick(['조별리그 탈락', '16강', '8강', '4강', '준우승', '우승'].slice(L.tier >= 5 ? 2 : 0));
    notes.push(`FIFA 클럽 월드컵 ${stage}`);
    if (stage === '우승') trophies.push('FIFA 클럽 월드컵 우승');
  }
  const nat = natSeasonEnd(s);
  trophies.push(...nat.trophies);
  const tours = nat.tours;

  const { awards, gala } = seasonAwards(s, { rank, avg, trophies, tours });
  trophies.forEach((t) => s.trophies.push({ year: s.year, t, club: /월드컵 우승|아시안컵|아시안게임|올림픽/.test(t) && !/클럽/.test(t) ? '대한민국' : s.club.name }));
  awards.forEach((t) => s.awards.push({ year: s.year, t }));
  addStat(s, 'fame', trophies.length * 3 + awards.length * 4);

  const cg = compGoals(S);
  const comps = (S.comps || []).map((c) => ({ name: c.name, stage: c.stage || '진행', apps: c.apps, g: c.g, a: c.a, type: c.type }));
  const rec: CareerRecord = {
    year: s.year, age: s.age, club: s.club.name, league: L.name, apps: S.apps + cg.apps, goals: S.goals + cg.g, assists: S.assists + cg.a, cs: S.cs,
    lgApps: S.apps, lgGoals: S.goals, rating: avg ? Math.round(avg * 100) / 100 : 0, rank, ovr: o, honors: [...trophies, ...awards],
    pro: !L.amateur, comps, caps: s.nat.caps - (S.capsStart || 0),
  } as CareerRecord;
  s.career.push(rec);
  rec.ch = detectCareerHighs(s, rec);
  const miles = checkMilestones(s, rec as unknown as { pro?: boolean; apps: number; goals: number; club: string });
  log(s, `${s.year} 시즌 종료 · ${L.name} ${rank}위 · 공식전 ${rec.apps}경기 ${rec.goals}골 ${rec.assists}도움`, 'big');
  const mil = milSeasonEnd(s);
  if (mil) notes.push(mil);

  s.age++; s.year++;
  const scout = bloomTick(s);
  if (scout) notes.push(scout);
  const peakEnd = (s.trait === 'early' ? 29 : s.trait === 'late' ? 32 : 30) + (s.pos === 'GK' ? 3 : 0);
  if (s.age > peakEnd) {
    const d = s.age - peakEnd;
    addAttr(s, 'pac', -(1 + rnd() * 2) * d * .5);
    addAttr(s, 'phy', -(1 + rnd() * 2) * d * .4);
    for (const k of ['sho', 'pas', 'dri', 'def'] as const) addAttr(s, k, -rnd() * d * .35);
  }
  if (s.leagueId === 'uni') s.uniYears++;
  if (s.contract) s.contract.years--;
  s.peak = Math.max(s.peak, o);
  s.cond = Math.max(s.cond, 85);
  s.morale = Math.round((s.morale + 65) / 2);
  s.injury = Math.min(s.injury, 4);
  s.seasonStart = { ...s.attrs }; s.seasonStartSub = { ...s.sub };
  return { rec, trophies, awards, notes, gala, tours: tours.filter((t) => t.inSquad || (t.matches?.length ?? 0) === 0 || t.stage === '우승' || t.stage === '금메달'), miles };
}

// ───────── 이적 시장 ─────────
// T-10-009: 스카우트·에이전트가 붙여 주는 "갈 수 있는 가장 강한 유럽 클럽". 전력 값이 촘촘해져(리그당 팀 증가)
// 상한에 딱 맞는 클럽이 늘 있으므로 상한을 1 낮춰 예전 평균 간격을 맞춘다(유럽 진출률 기준선 유지). 같은 전력의
// 클럽이 여러 리그에 생겼으므로, 최고 전력 동률 리그 중 하나를 리그 자금력(wealth) 비례로 고른다 —
// CLUBS 순서면 에레디비시가, 상위 리그 우선이면 PL이 늘 이겨 PL 진출률이 26%/52%로 틀어졌다(기준 35%).
function bestEuropeClub(s: GameState, cap: number, taken: Club[]): Club | undefined {
  const cands = CLUBS.filter((c) => leagueOf(c.leagueId).tier >= 4 && c.str <= cap && !taken.includes(c) && c.id !== s.club.id);
  if (!cands.length) return undefined;
  const top = Math.max(...cands.map((c) => c.str));
  const perLeague = [...new Map(cands.filter((c) => c.str === top).map((c) => [c.leagueId, c] as const)).values()];
  const w = (c: Club) => leagueOf(c.leagueId).wealth;
  let x = rnd() * perLeague.reduce((t, c) => t + w(c), 0);
  return perLeague.find((c) => (x -= w(c)) <= 0) ?? perLeague[perLeague.length - 1];
}
/** 오퍼가 하나도 없을 때 재기 도전으로 내려가는 리그(두 단계 아래). */
const DOWN: Record<string, string> = { j1: 'k2', mls: 'k1', ere: 'k1', l1: 'j1', bl: 'ere', sa: 'l1', ll: 'bl', pl: 'sa' };
export function makeOffers(s: GameState) {
  const last = s.career.filter((r) => !r.mil).pop();
  const o = ovr(s);
  const value = o + clamp(((last ? last.rating : 6.8) - 6.8) * 4, -4, 5) + s.fame * .04 - (s.age >= 31 ? (s.age - 30) * 1.2 : 0);
  const am = leagueOf(s.leagueId).amateur;
  const pool = CLUBS.filter((c) => !leagueOf(c.leagueId).amateur && c.id !== s.club.id && c.str <= value + 2 && c.str >= value - 14
    && (!am || (leagueOf(c.leagueId).tier <= (value >= 66 ? 4 : 3) && c.leagueId !== 'mls'))
    && (leagueOf(c.leagueId).tier < 4 || leagueOf(s.leagueId).tier >= 4 || c.str <= value - 3));
  // T-10-016 MLS는 팀이 30개라 그대로 두면 오퍼를 쓸어 간다. 실제처럼 주로 30대 베테랑에게 오게 한다.
  const pull = (c: Club) => (c.leagueId === 'mls' && s.age < 30 ? BAL.mlsYoungPull : 1);
  const wt = (c: (typeof CLUBS)[number]) => pull(c) * Math.exp(-((c.str - (value - 3)) ** 2) / 20);
  const n = Math.min(pool.length, value >= 60 ? ri(1, 3) : ri(0, 2));
  const chosen: (typeof CLUBS)[number][] = [];
  for (let i = 0; i < n; i++) {
    const tot = pool.reduce((t, c) => t + wt(c), 0);
    let x = rnd() * tot;
    const idx = pool.findIndex((c) => (x -= wt(c)) <= 0);
    chosen.push(pool.splice(Math.max(0, idx), 1)[0]!);
  }
  if (s.flags.scouted) {
    const eu = bestEuropeClub(s, value + 1, chosen);
    if (eu) chosen.push(eu);
    s.flags.scouted = false;
  }
  if (s.flags.agent) {
    const eu = bestEuropeClub(s, value + 2, chosen);
    if (eu) chosen.push(eu);
    s.flags.agent = false;
  }
  let coach: (typeof CLUBS)[number] | null = null;
  if (s.flags.coachOffer) {
    const tier = leagueOf(s.leagueId).tier;
    coach = CLUBS.filter((c) => !leagueOf(c.leagueId).amateur && c.id !== s.club.id && !chosen.includes(c) && Math.abs(leagueOf(c.leagueId).tier - tier) <= 1)
      .sort((a, b) => Math.abs(a.str - (value + 1)) - Math.abs(b.str - (value + 1)))[0] ?? null;
    s.flags.coachOffer = false;
  }
  const list: OfferOption[] = chosen.map((c) => offerFrom(s, c));
  if (coach) list.push({ ...offerFrom(s, coach), role: '은사의 부름 · 감독 신뢰 두터움', trust: 3 });
  return list.sort((a, b) => b.str - a.str);
}
export function offerFrom(s: GameState, c: (typeof CLUBS)[number]): OfferOption {
  const o = ovr(s), old = s.age >= 31;
  const d = o - c.str;
  return {
    kind: 'offer', clubId: c.id, name: c.name, leagueId: c.leagueId, str: c.str,
    years: ri(old ? 1 : 2, old ? 2 : 5),
    salary: Math.round((salaryFor(c.leagueId, o) * (0.85 + rnd() * .35)) / 10) * 10,
    role: d >= 1 ? '주전 보장' : d >= -5 ? '로테이션' : '벤치 경쟁',
    fee: s.contract && s.contract.years > 0 ? Math.round(marketValue(s) * (0.9 + rnd() * .5) / 100) * 100 : 0,
  };
}

export function marketValue(s: GameState) {
  return Math.round(salaryFor(leagueOf(s.leagueId).amateur ? 'k2' : s.leagueId, ovr(s)) * (s.age <= 24 ? 5 : s.age <= 29 ? 4 : 2) / 100) * 100;
}
export function market(s: GameState): { options: MarketOption[]; note: string; canRetire: boolean } {
  natInit(s);
  const L = leagueOf(s.leagueId), o = ovr(s);
  const options: MarketOption[] = [];
  let note: string;
  if (s.mil.serving) return { options: [{ kind: 'serve', name: '김천 상무 복무 계속', desc: `전역까지 ${s.mil.left}시즌 · 군 복무 중에는 이적할 수 없습니다` }], note: '국군체육부대 소속으로 복무 중입니다.', canRetire: false };
  const enlist = milEnlistMarket(s);
  if (enlist) return enlist;
  if (milDue(s)) return { options: milOptions(s), note: `만 ${s.age}세. 더 이상 입영을 미룰 수 없습니다. 병역 의무를 이행해야 합니다.`, canRetire: s.age >= 32 };
  const offers = makeOffers(s);

  if (s.leagueId === 'hs') {
    note = offers.length ? '졸업을 앞두고 프로 구단의 입단 제의가 도착했습니다.' : '아직 프로 스카우트의 눈에 띄지 못했습니다. 대학에서 기량을 키워보세요.';
    options.push(...offers, { kind: 'uni', name: '대학 진학', desc: '4년 이내에 언제든 프로 도전 · 대학리그에서 출전 기회 확보' });
  } else if (s.leagueId === 'uni') {
    note = `대학 ${s.uniYears}학년을 마쳤습니다.`;
    options.push(...offers);
    if (s.uniYears < 4) options.push({ kind: 'stay', name: '대학 잔류', desc: `${s.uniYears + 1}학년으로 한 시즌 더` });
    if (!offers.length && s.uniYears >= 4) {
      if (o >= 46) {
        const c = clubsIn('k3').sort((a, b) => a.str - b.str)[0]!;
        options.push({ ...offerFrom(s, c), role: '입단 테스트 합격 · 세미프로', years: 1 });
        note = '졸업반. 프로 구단의 제의는 없었지만 K3리그 입단 테스트에 합격했습니다.';
      } else note = '졸업반. 어느 팀에서도 연락이 오지 않았습니다. 선수의 꿈을 접어야 할지도 모릅니다.';
    }
  } else {
    if (s.contract && s.contract.years > 0) {
      const contract = s.contract;
      note = `${s.club.name}와의 계약이 ${contract.years}년 남았습니다.`;
      options.push({ kind: 'stay', name: `${s.club.name} 잔류`, desc: `연봉 ${fmtMoney(contract.salary)} · 계약 ${contract.years}년 남음` });
      options.push(...offers);
    } else {
      note = '계약이 만료되어 FA 신분이 되었습니다.';
      if (o >= s.club.str - 7 && s.age < 38) {
        const sal = Math.round((salaryFor(s.leagueId, o) * (1 + s.trust * .03)) / 10) * 10;
        options.push({ kind: 'renew', name: `${s.club.name} 재계약`, years: s.age >= 31 ? 1 : ri(2, 4), salary: sal, desc: '' });
      }
      options.push(...offers);
      if (!options.length && s.age < 31) {
        const down = DOWN[L.id] ?? 'k3';
        const c = clubsIn(down).sort((a, b) => Math.abs(a.str - o) - Math.abs(b.str - o))[0];
        if (c && o >= c.str - 10) options.push({ ...offerFrom(s, c), role: '하부 리그 · 재기 도전', years: 1 });
      }
    }
  }
  if (!L.amateur) options.push(...milOptions(s));
  const lastUni = s.leagueId === 'uni' && s.uniYears >= 4;
  const canRetire = (!L.amateur && (s.age >= 30 || L.tier === 0 || !options.length)) || lastUni;
  const forced = s.age >= 41 || (!options.length && (!L.amateur || lastUni));
  return { options: forced ? [] : options, note: forced ? '더 이상 불러주는 팀이 없습니다. 은퇴를 결정할 시간입니다.' : note, canRetire: canRetire || forced };
}

export function acceptOption(s: GameState, opt: MarketOption): { text: string; ok?: boolean; reopen?: boolean } | null {
  if (opt.kind === 'sangmu' || opt.kind === 'army' || opt.kind === 'serve') {
    return acceptMilitary(s, opt);
  }
  if (opt.kind === 'uni') {
    const c = pick(clubsIn('uni'));
    s.leagueId = 'uni'; s.club = { ...c }; s.uniYears = 1; s.trust = 0;
    log(s, `${c.name}에 진학했습니다.`, 'big');
  } else if (opt.kind === 'renew') {
    s.contract = { years: opt.years, salary: opt.salary };
    addStat(s, 'trust', 1);
    log(s, `${s.club.name}와 ${opt.years}년 재계약 (연봉 ${fmtMoney(opt.salary)})`, 'big');
  } else if (opt.kind === 'offer') {
    const c = CLUBS.find((x) => x.id === opt.clubId)!;
    const from = s.club.name, wasAm = leagueOf(s.leagueId).amateur;
    s.leagueId = c.leagueId; s.club = { ...c }; s.trust = opt.trust || 0;
    s.contract = { years: opt.years, salary: opt.salary };
    addStat(s, 'fame', Math.max(1, leagueOf(c.leagueId).tier * 1.5));
    log(s, wasAm ? `${c.name}(${leagueOf(c.leagueId).name}) 입단! ${opt.years}년 · 연봉 ${fmtMoney(opt.salary)}`
                 : `${from} → ${c.name}(${leagueOf(c.leagueId).name}) 이적! ${opt.fee ? `이적료 ${fmtMoney(opt.fee)} · ` : '자유계약 · '}${opt.years}년 · 연봉 ${fmtMoney(opt.salary)}`, 'big');
  }
  s.season = newSeason(s);
  s.phase = 0;
  return null;
}

// ───────── 은퇴 · 명예의 전당 ─────────
const LEGEND_W: Record<string, { g: number; a: number; cs: number }> = {
  FW: { g: .42, a: .35, cs: 0 }, MF: { g: .65, a: .75, cs: 0 }, DF: { g: .9, a: .5, cs: .9 }, GK: { g: 1, a: .6, cs: .95 },
};
export interface LegendBreakdownItem { key: string; label: string; value: number }
/** legendScore()를 구성하는 각 항의 값을 그대로 나열한다 — 총합은 legendScore()와 항상 같다
 * (반올림도 legendScore()와 동일하게 마지막에 한 번만 적용). T-10-002 은퇴 리포트용. */
export function legendScoreBreakdown(s: LegendSource): { items: LegendBreakdownItem[]; total: number } {
  const t = s.career.reduce((a, r) => ({ g: a.g + r.goals, a: a.a + r.assists, p: a.p + r.apps, cs: a.cs + (r.cs || 0) }), { g: 0, a: 0, p: 0, cs: 0 });
  const w = LEGEND_W[s.pos] || LEGEND_W.MF!;
  const items: LegendBreakdownItem[] = [
    { key: 'goals', label: '골 기여', value: t.g * w.g },
    { key: 'assists', label: '도움 기여', value: t.a * w.a },
    { key: 'cs', label: '무실점 기여', value: t.cs * w.cs },
    { key: 'apps', label: '출전', value: t.p * .05 },
    { key: 'trophies', label: '우승 트로피', value: s.trophies.length * 10 },
    { key: 'awards', label: '개인 수상', value: s.awards.length * 12 },
    { key: 'caps', label: 'A매치', value: s.nat.caps * .4 },
    { key: 'peak', label: '최고 OVR', value: s.peak * 2 },
    { key: 'ballonWin', label: '발롱도르 수상', value: s.awards.filter((x) => x.t === '발롱도르').length * 60 },
    { key: 'ballonRank', label: '발롱도르 순위', value: (s.ballon || []).reduce((tt, b) => tt + Math.max(0, 31 - b.rank), 0) * .6 },
    { key: 'wc', label: '월드컵 우승', value: s.trophies.filter((x) => x.t === 'FIFA 월드컵 우승').length * 60 },
    { key: 'century', label: '센추리 클럽', value: s.nat.caps >= 100 ? 25 : 0 },
  ].filter((it) => it.value !== 0);
  const total = Math.round(items.reduce((sum, it) => sum + it.value, 0));
  return { items, total };
}
export function legendScore(s: LegendSource): number {
  return legendScoreBreakdown(s).total;
}
export function retire(s: GameState): HofEntry {
  s.retired = true;
  retireMilestones(s);
  log(s, `${s.age}세, 정든 그라운드를 떠납니다.`, 'big');
  const t = s.career.reduce((a, r) => ({ g: a.g + r.goals, a: a.a + r.assists, p: a.p + r.apps }), { g: 0, a: 0, p: 0 });
  const entry: HofEntry = {
    name: s.name, pos: s.pos, number: s.number, peak: s.peak, age: s.age, apps: t.p, goals: t.g, assists: t.a,
    trophies: s.trophies.length, awards: s.awards.length, caps: s.nat.caps, ballon: s.awards.filter((x) => x.t === '발롱도르').length,
    lastClub: s.club.name, score: legendScore(s), date: new Date().toISOString().slice(0, 10),
    id: s.cid, detail: legendSnapshot(s),
  };
  const hof = loadHOF();
  hof.push(entry);
  hof.sort((a, b) => b.score - a.score);
  saveKey('ft_hof', hof.slice(0, 30));
  return entry;
}
/** T-10-005. 은퇴 상세를 다시 그리는 데 필요한 필드만 복사한다(서버 계약 LegendSnapshotSchema와 같은
 * 모양 — strictObject라 CareerRecord의 부가 필드(comps·lgApps 등)는 빼고 옮긴다). 선수 이름은 넣지 않는다. */
export function legendSnapshot(s: GameState): LegendSnapshot {
  return {
    number: s.number, pos: s.pos, age: s.age, peak: s.peak, lastClub: s.club.name,
    career: s.career.map((r) => ({
      year: r.year, age: r.age, club: r.club, league: r.league, apps: r.apps, goals: r.goals, assists: r.assists,
      cs: r.cs || 0, rating: r.rating, rank: r.rank, ovr: r.ovr, honors: r.honors,
      ...(r.mil ? { mil: true } : {}), ...(r.ch?.length ? { ch: r.ch } : {}),
    })),
    trophies: s.trophies.map(({ year, t, club }) => ({ year, t, club })),
    awards: s.awards.map(({ year, t }) => ({ year, t })),
    ballon: (s.ballon || []).map(({ year, rank }) => ({ year, rank })),
    nat: { caps: s.nat.caps },
    storyLog: (s.storyLog || []).map(({ year, key, name, ending }) => ({ year, key, name, ending })),
    miles: (s.miles || []).map(({ year, t }) => ({ year, t })),
  };
}
export function legendTitle(score: number): string {
  return score >= 840 ? '역대 최고의 전설' : score >= 590 ? '월드클래스 레전드' : score >= 425 ? '클럽 레전드' : score >= 305 ? '성실한 프로' : '평범한 축구 커리어';
}

// ───────── 저장 ─────────
/** 저장 성공 여부를 돌려준다(용량 초과·저장소 차단이면 false). */
export function saveKey(k: string, v: unknown): boolean {
  try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; }
}
export function loadKey<T = unknown>(k: string): T | null {
  try {
    const raw = localStorage.getItem(k);
    return raw == null ? null : (JSON.parse(raw) as T);
  } catch { return null; }
}
export function loadHOF(): HofEntry[] {
  return loadKey<HofEntry[]>('ft_hof') || loadKey<HofEntry[]>('sl_hof') || [];
}
