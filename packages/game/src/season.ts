// ───────── 시즌 종료 · 이적 시장 · 은퇴 · 저장 ─────────
import { CLUBS, clubRef, sameClub, type Club } from './data.js';
import { BAL } from './balance.js';
import { ovr, peakProfileOf } from './attributes.js';
import { clamp, ri, pick, rnd, weightedIndex, createRng, getActiveRng } from './rng.js';
import {
  leagueOf,
  clubsIn,
  clubLeague,
  clubLeagueId,
  fmtMoney,
  salaryFor,
  valueFor,
  fmtValue,
  addStat,
  addAttr,
  log,
  bloomTick,
  truePot,
  newSeason,
  finalRank,
  fameEff,
} from './engine.js';
import {
  seasonSetup,
  compGoals,
  seasonAwards,
  checkMilestones,
  retireMilestones,
} from './comps.js';
import { legendBand } from './legend-bands.js';
import { checkTitles, mainTitle, titleView, type TitleView } from './titles.js';
import { natInit, natSeasonEnd, NATIONAL_TROPHIES, type NatTourResult } from './national.js';
import { milSeasonEnd, milDue, milOptions, milEnlistMarket, acceptMilitary } from './military.js';
import { nationOf } from './nation.js';
import { detectCareerHighs } from './records.js';
import { noteMarket } from './playStyle.js';
import { movedWithClub, promoteClub, type Promotion } from './promotion.js';
import type { LegendSnapshot } from '@offside/contracts';
import { PRESEASON_RETIRE_AT } from '@offside/contracts/service-seasons';
import { controlPoints, legendAwardCount, legendTerms } from '@offside/contracts/hof-rules';
import type {
  GameState,
  CareerRecord,
  HofEntry,
  LegendSource,
  MarketOption,
  MarketResult,
  OfferOption,
  RenewOption,
} from './types.js';
import { storage } from './storage.js';

/** 시즌 결산 결과 — 결산 시트가 그린다. tours는 명단에 들었거나 경기가 없던(예선 결과) 대회와 우승 대회만. */
export interface SeasonEndResult {
  rec: CareerRecord;
  trophies: string[];
  awards: string[];
  notes: string[];
  gala: string[];
  tours: NatTourResult[];
  miles: string[];
  titles: TitleView[];
  /** T-10-110 K리그2 우승으로 구단이 승격했으면. 옛 세이브의 pending.res에는 없다. */
  promo?: Promotion | undefined;
}
/** 지난 시즌 대륙 챔피언이면 4년마다 열리는 FIFA 클럽 월드컵 결과(무작위 단계). 해당 없으면 null. */
function clubWorldCup(s: GameState, tier: number): string | null {
  if (s.year % 4 !== 1) return null;
  const champ = s.career.some(
    (r) =>
      r.year === s.year - 1 &&
      sameClub(r, clubRef(s.club)) &&
      r.honors.some((h) => /챔피언스(리그( 엘리트)?|컵) 우승/.test(h)),
  );
  if (!champ) return null;
  return pick(['조별리그 탈락', '16강', '8강', '4강', '준우승', '우승'].slice(tier >= 5 ? 2 : 0));
}

/** 이번 시즌 커리어 기록 한 줄(리그 + 컵·대륙 대회 합산). */
function seasonRecord(
  s: GameState,
  o: number,
  rank: number,
  avg: number,
  honors: string[],
): CareerRecord {
  const L = leagueOf(s.leagueId),
    S = s.season;
  const cg = compGoals(S);
  const comps = (S.comps || []).map((c) => ({
    name: c.name,
    stage: c.stage || '진행',
    apps: c.apps,
    g: c.g,
    a: c.a,
    type: c.type,
  }));
  return {
    year: s.year,
    age: s.age,
    ...clubRef(s.club),
    league: L.name,
    apps: S.apps + cg.apps,
    goals: S.goals + cg.g,
    assists: S.assists + cg.a,
    cs: S.cs,
    lgApps: S.apps,
    lgGoals: S.goals,
    rating: avg ? Math.round(avg * 100) / 100 : 0,
    rank,
    ovr: o,
    honors,
    pro: !L.amateur,
    comps,
    caps: s.nat.caps - (S.capsStart || 0),
  } as CareerRecord;
}

/** 한 해를 넘긴다: 나이·연도, 늦게 피는 재능, 노쇠, 대학 연차·계약 연수, 컨디션·사기 회복. 스카우트 소식이 있으면 돌려준다. */
function nextYear(s: GameState, o: number): string | null {
  s.age++;
  s.year++;
  const scout = bloomTick(s);
  const peakEnd =
    (s.trait === 'early' ? 29 : s.trait === 'late' ? 32 : 30) + (s.pos === 'GK' ? 3 : 0);
  if (s.age > peakEnd) {
    const d = s.age - peakEnd;
    addAttr(s, 'pac', -(1 + rnd() * 2) * d * 0.5);
    addAttr(s, 'phy', -(1 + rnd() * 2) * d * 0.4);
    for (const k of ['sho', 'pas', 'dri', 'def'] as const) addAttr(s, k, -rnd() * d * 0.35);
  }
  if (s.leagueId === 'uni') s.uniYears++;
  if (s.contract) s.contract.years--;
  s.peak = Math.max(s.peak, o);
  s.cond = Math.max(s.cond, 85);
  s.morale = Math.round((s.morale + 65) / 2);
  s.injury = Math.min(s.injury, 4);
  s.seasonStart = { ...s.attrs };
  s.seasonStartSub = { ...s.sub };
  return scout;
}

/** 시즌 정산: 순위·트로피·개인상 → 커리어 기록 → 이정표·칭호 → 병역 → 한 해 넘기기(RNG 순서). */
export function endSeason(s: GameState): SeasonEndResult {
  natInit(s);
  const L = leagueOf(s.leagueId),
    S = s.season,
    o = ovr(s);
  // T-10-092 최고 OVR을 찍은(같아도) 시즌 말 능력치를 남긴다 — 아래 노쇠 감소 전 값.
  if (o >= s.peak) s.peakProfile = peakProfileOf(s);
  if (!S.comps) seasonSetup(s, S);
  const avg = S.apps ? S.ratingSum / S.apps : 0;
  const rank = finalRank(s);
  const trophies = [...(S.trophiesMid || [])],
    notes: string[] = [];

  if (rank === 1) trophies.push(`${L.name} 우승`);
  const cwc = clubWorldCup(s, L.tier);
  if (cwc) {
    notes.push(`FIFA 클럽 월드컵 ${cwc}`);
    if (cwc === '우승') trophies.push('FIFA 클럽 월드컵 우승');
  }
  const nat = natSeasonEnd(s);
  trophies.push(...nat.trophies);
  const tours = nat.tours;

  const { awards, gala } = seasonAwards(s, { rank, avg, trophies, tours });
  trophies.forEach((t) =>
    s.trophies.push({
      year: s.year,
      t,
      ...(NATIONAL_TROPHIES.has(t) ? { club: nationOf(s).ko } : clubRef(s.club)),
    }),
  );
  awards.forEach((t) => s.awards.push({ year: s.year, t }));
  addStat(s, 'fame', trophies.length * 3 + awards.length * 4);

  const rec = seasonRecord(s, o, rank, avg, [...trophies, ...awards]);
  s.career.push(rec);
  rec.ch = detectCareerHighs(s, rec);
  const miles = checkMilestones(s, rec);
  const titles = checkTitles(s).map(titleView);
  log(
    s,
    `${s.year} 시즌 종료 · ${L.name} ${rank}위 · 공식전 ${rec.apps}경기 ${rec.goals}골 ${rec.assists}도움`,
    'big',
  );
  // T-10-110 기록(K리그2 · 우승)을 남긴 뒤 승격을 확정한다 — 이어지는 이적 시장·재계약부터 K1 기준이다.
  const promo = promoteClub(s, rank);
  const mil = milSeasonEnd(s);
  if (mil) notes.push(mil);

  const scout = nextYear(s, o);
  if (scout) notes.push(scout);
  return {
    rec,
    trophies,
    awards,
    notes,
    gala,
    tours: tours.filter(
      (t) => t.inSquad || t.matches.length === 0 || t.stage === '우승' || t.stage === '금메달',
    ),
    miles,
    titles,
    promo,
  };
}

// ───────── 이적 시장 ─────────
// T-10-009: 스카우트·에이전트가 붙여 주는 "갈 수 있는 가장 강한 유럽 클럽". 전력 값이 촘촘해져(리그당 팀 증가)
// 상한에 딱 맞는 클럽이 늘 있으므로 상한을 1 낮춰 예전 평균 간격을 맞춘다(유럽 진출률 기준선 유지). 같은 전력의
// 클럽이 여러 리그에 생겼으므로, 최고 전력 동률 리그 중 하나를 리그 자금력(wealth) 비례로 고른다 —
// CLUBS 순서면 에레디비시가, 상위 리그 우선이면 PL이 늘 이겨 PL 진출률이 26%/52%로 틀어졌다(기준 35%).
function bestEuropeClub(s: GameState, cap: number, taken: Club[]): Club | undefined {
  const cands = CLUBS.filter(
    (c) =>
      leagueOf(c.leagueId).tier >= 4 && c.str <= cap && !taken.includes(c) && c.id !== s.club.id,
  );
  if (!cands.length) return undefined;
  const top = Math.max(...cands.map((c) => c.str));
  const perLeague = [
    ...new Map(cands.filter((c) => c.str === top).map((c) => [c.leagueId, c] as const)).values(),
  ];
  const w = (c: Club) => leagueOf(c.leagueId).wealth;
  const i = weightedIndex(perLeague, w);
  return perLeague[i >= 0 ? i : perLeague.length - 1];
}
/** 오퍼가 하나도 없을 때 재기 도전으로 내려가는 리그(두 단계 아래). */
const DOWN: Record<string, string> = {
  j1: 'k2',
  mls: 'k1',
  ere: 'k1',
  l1: 'j1',
  bl: 'ere',
  sa: 'l1',
  ll: 'bl',
  pl: 'sa',
};
/** 마지막으로 뛴(군 복무가 아닌) 시즌 기록. */
const lastPlayed = (s: GameState) => s.career.filter((r) => !r.mil).pop();
export function makeOffers(s: GameState) {
  const last = lastPlayed(s);
  const o = ovr(s);
  const value =
    o +
    clamp(((last ? last.rating : 6.8) - 6.8) * 4, -4, 5) +
    fameEff(s) * 0.04 -
    (s.age >= 31 ? (s.age - 30) * 1.2 : 0);
  const am = leagueOf(s.leagueId).amateur;
  const pool = CLUBS.filter(
    (c) =>
      !clubLeague(c, s).amateur &&
      c.id !== s.club.id &&
      c.str <= value + 2 &&
      c.str >= value - 14 &&
      (!am || (clubLeague(c, s).tier <= (value >= 66 ? 4 : 3) && c.leagueId !== 'mls')) &&
      (clubLeague(c, s).tier < 4 || leagueOf(s.leagueId).tier >= 4 || c.str <= value - 3),
  );
  // T-10-016 MLS는 팀이 30개라 그대로 두면 오퍼를 쓸어 간다. 실제처럼 주로 30대 베테랑에게 오게 한다.
  const pull = (c: Club) => (c.leagueId === 'mls' && s.age < 30 ? BAL.mlsYoungPull : 1);
  const wt = (c: (typeof CLUBS)[number]) => pull(c) * Math.exp(-((c.str - (value - 3)) ** 2) / 20);
  const n = Math.min(pool.length, value >= 60 ? ri(1, 3) : ri(0, 2));
  const chosen: (typeof CLUBS)[number][] = [];
  for (let i = 0; i < n; i++) {
    chosen.push(pool.splice(Math.max(0, weightedIndex(pool, wt)), 1)[0]!);
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
    coach =
      CLUBS.filter(
        (c) =>
          !clubLeague(c, s).amateur &&
          c.id !== s.club.id &&
          !chosen.includes(c) &&
          Math.abs(clubLeague(c, s).tier - tier) <= 1,
      ).sort((a, b) => Math.abs(a.str - (value + 1)) - Math.abs(b.str - (value + 1)))[0] ?? null;
    s.flags.coachOffer = false;
  }
  const list: OfferOption[] = chosen.map((c) => offerFrom(s, c));
  if (coach)
    list.push({ ...offerFrom(s, coach), role: '은사의 부름 · 감독 신뢰 두터움', trust: 3 });
  return list.sort((a, b) => b.str - a.str);
}
/** T-11-045 이 선수의 은퇴 나이(이 나이가 되는 시장에서 은퇴). 옛 저장·프리시즌 선수는 41세. */
export const retireAge = (s: Pick<GameState, 'retireAt'>): number =>
  s.retireAt ?? PRESEASON_RETIRE_AT;
/**
 * T-11-045 베테랑 나이: 이적 제의는 1년 계약만(은퇴 나이를 넘겨 계약이 남지 않는다), 재계약은 지난 시즌 활약으로.
 * 프리시즌 은퇴 나이와 같은 41이지만 다른 값이다 — 프리시즌 선수는 이 나이에 은퇴하므로 시즌 1부터의 선수만 닿는다.
 */
const VETERAN_AGE = 41;
const isVeteran = (s: GameState) => s.age >= VETERAN_AGE;
/**
 * T-11-045 베테랑 재계약: 기존 재계약 능력 기준(전력 차 7 이내)에 더해 지난(비군복무) 시즌 출전·평균 평점(6.8 = 오퍼 평가의 보통 시즌).
 * 시뮬(4,000커리어, 끝까지 뛰는 정책)에서 41세 도달자의 약 20%가 45세까지 뛰고 은퇴 나이가 41~45세에 고르게 퍼진다
 * (docs/analysis/retire-age-45-sim-2026-10-02.md).
 */
export const VETERAN_RENEW = { apps: 10, rating: 6.8 } as const;
function veteranSeasonOk(s: GameState): boolean {
  const last = lastPlayed(s);
  return !!last && last.apps >= VETERAN_RENEW.apps && last.rating >= VETERAN_RENEW.rating;
}

export function offerFrom(s: GameState, c: (typeof CLUBS)[number]): OfferOption {
  const o = ovr(s),
    old = s.age >= 31;
  const d = o - c.str;
  const leagueId = clubLeagueId(c, s);
  return {
    kind: 'offer',
    clubId: c.id,
    name: c.name,
    leagueId,
    str: c.str,
    years: Math.max(
      1,
      Math.min(ri(old ? 1 : 2, old ? 2 : 5), isVeteran(s) ? 1 : 5, retireAge(s) - s.age),
    ),
    salary: Math.round((salaryFor(leagueId, o) * (0.85 + rnd() * 0.35)) / 10) * 10,
    role: d >= 1 ? '주전 보장' : d >= -5 ? '로테이션' : '벤치 경쟁',
    fee:
      s.contract && s.contract.years > 0
        ? Math.round((marketValue(s) * (0.9 + rnd() * 0.5)) / 100) * 100
        : 0,
  };
}

export function marketValue(s: GameState) {
  return valueFor(leagueOf(s.leagueId).amateur ? 'k2' : s.leagueId, ovr(s), s.age);
}
/** 병역이 시장을 막는 경우(복무 중 · 입영 확정 · 입영 기한)의 시장. 해당 없으면 null. */
function militaryMarket(s: GameState): MarketResult | null {
  if (s.mil.serving)
    return {
      options: [
        {
          kind: 'serve',
          name: '김천 상무 복무 계속',
          desc: `전역까지 ${s.mil.left}시즌 · 군 복무 중에는 이적할 수 없습니다`,
        },
      ],
      note: '국군체육부대 소속으로 복무 중입니다.',
      canRetire: false,
    };
  const enlist = milEnlistMarket(s);
  if (enlist) return enlist;
  if (milDue(s))
    return {
      options: milOptions(s),
      note: `만 ${s.age}세. 더 이상 입영을 미룰 수 없습니다. 병역 의무를 이행해야 합니다.`,
      canRetire: s.age >= 32,
    };
  return null;
}

type Shelf = { options: MarketOption[]; note: string };

/** 기존 재계약 정책. 조기 제안은 RNG 사본으로 기간만 읽어 성장·경기 난수열을 진행시키지 않는다. */
function renewalYears(s: GameState, preview = false): number {
  if (s.age >= 31) return 1;
  return preview ? 2 + Math.floor(createRng(getActiveRng().getState().seed).next() * 3) : ri(2, 4);
}

function renewalSalary(s: GameState, o: number): number {
  return Math.round((salaryFor(s.leagueId, o) * (1 + s.trust * 0.03)) / 10) * 10;
}

/** 38~40세 공백과 41세 이상 매년 성적 심사는 그대로 둔다. */
function earlyRenewalEligible(s: GameState, o: number): boolean {
  return (
    !s.retired &&
    !leagueOf(s.leagueId).amateur &&
    !s.mil.serving &&
    !s.mil.accepted &&
    !s.mil.armyNext &&
    !milDue(s) &&
    s.contract?.years === 1 &&
    s.age < 38 &&
    o >= s.club.str - 7
  );
}

/** 조기 제안은 해당 연도·구단·잔여기간에만 쓸 수 있다(중복·오래된 계약서 방어). */
export function canAcceptRenewal(s: GameState, opt: RenewOption): boolean {
  const e = opt.extension;
  if (!e) return true; // 옛 저장의 만료 재계약 의미를 유지한다.
  return (
    earlyRenewalEligible(s, ovr(s)) &&
    e.clubId === s.club.id &&
    e.year === s.year &&
    Number.isInteger(e.years) &&
    e.years > 0 &&
    opt.years === 1 + e.years &&
    opt.years <= retireAge(s) - s.age
  );
}

/** 고3 졸업: 프로 입단 제의 + 대학 진학. */
function highSchoolShelf(offers: MarketOption[]): Shelf {
  return {
    note: offers.length
      ? '졸업을 앞두고 프로 구단의 입단 제의가 도착했습니다.'
      : '아직 프로 스카우트의 눈에 띄지 못했습니다. 대학에서 기량을 더 키워야 합니다.',
    options: [
      ...offers,
      {
        kind: 'uni',
        name: '대학 진학',
        desc: '4년 이내에 언제든 프로 도전 · 대학리그에서 출전 기회 확보',
      },
    ],
  };
}

/** 대학: 제의 + 잔류(4학년 전까지). 졸업반에 제의가 없으면 K3 입단 테스트(OVR 46 이상). */
function universityShelf(s: GameState, offers: MarketOption[], o: number): Shelf {
  let note = `대학 ${s.uniYears}학년을 마쳤습니다.`;
  const options = [...offers];
  if (s.uniYears < 4)
    options.push({ kind: 'stay', name: '대학 잔류', desc: `${s.uniYears + 1}학년으로 한 시즌 더` });
  if (!offers.length && s.uniYears >= 4) {
    if (o >= 46) {
      const c = clubsIn('k3').sort((a, b) => a.str - b.str)[0]!;
      options.push({ ...offerFrom(s, c), role: '입단 테스트 합격 · 세미프로', years: 1 });
      note = '졸업반. 프로 구단의 제의는 없었지만 K3리그 입단 테스트에 합격했습니다.';
    } else
      note = '졸업반. 어느 팀에서도 연락이 오지 않았습니다. 선수의 꿈을 접어야 할지도 모릅니다.';
  }
  return { options, note };
}

/**
 * 프로: 계약 중이면 잔류 + 제의, 만료면 재계약(전력 차 7 이내·38세 미만) + 제의, 아무것도 없으면 하부 리그 재기 도전.
 * T-11-045 41세부터(은퇴 나이가 더 높은 선수만 닿는다)는 지난 시즌에 뛴 만큼 1년 재계약(VETERAN_RENEW).
 */
function proShelf(
  s: GameState,
  offers: MarketOption[],
  o: number,
  leagueId: string,
  promoted: boolean,
): Shelf {
  const options: MarketOption[] = [];
  if (s.contract && s.contract.years > 0) {
    const contract = s.contract;
    options.push({
      kind: 'stay',
      name: `${s.club.name} 잔류`,
      desc: `${promoted ? `이 구단과 ${leagueOf(s.leagueId).name} 도전 · ` : ''}연봉 ${fmtMoney(contract.salary)} · 계약 ${contract.years}년 남음`,
    });
    if (earlyRenewalEligible(s, o)) {
      const extra = Math.min(renewalYears(s, true), retireAge(s) - s.age - contract.years);
      if (extra > 0)
        options.push({
          kind: 'renew',
          name: `${s.club.name} 연장 계약`,
          years: contract.years + extra,
          salary: renewalSalary(s, o),
          desc: '새 연봉은 이번 시즌부터 적용돼요.',
          extension: { years: extra, clubId: s.club.id, year: s.year },
        });
    }
    options.push(...offers);
    return { options, note: `${s.club.name}와의 계약이 ${contract.years}년 남았습니다.` };
  }
  const veteran = isVeteran(s);
  if (o >= s.club.str - 7 && (veteran ? veteranSeasonOk(s) : s.age < 38)) {
    const sal = renewalSalary(s, o);
    options.push({
      kind: 'renew',
      name: `${s.club.name} 재계약`,
      years: Math.min(renewalYears(s), Math.max(1, retireAge(s) - s.age)),
      salary: sal,
      desc: veteran ? '베테랑 재계약' : '',
    });
  }
  options.push(...offers);
  if (!options.length && s.age < 31) {
    const down = DOWN[leagueId] ?? 'k3';
    const c = clubsIn(down, s).sort((a, b) => Math.abs(a.str - o) - Math.abs(b.str - o))[0];
    if (c && o >= c.str - 10)
      options.push({ ...offerFrom(s, c), role: '하부 리그 · 재기 도전', years: 1 });
  }
  return { options, note: '계약이 만료되어 FA 신분이 되었습니다.' };
}

/** 시즌 뒤 이적 시장: 병역 → 이적 제의 → 단계별(고교·대학·프로) 선택지 → 병역 선택지 → 은퇴 가능 여부(RNG 순서). */
export function market(s: GameState): MarketResult {
  natInit(s);
  const L = leagueOf(s.leagueId),
    o = ovr(s);
  const mil = militaryMarket(s);
  if (mil) return mil;
  const offers = makeOffers(s);
  // T-10-110 방금 구단이 승격했다 — 잔류·재계약은 새 리그 조건이고, 선수가 떠나도 구단의 승격은 그대로다.
  const promoted = movedWithClub(s);
  const { options, note: shelfNote } =
    s.leagueId === 'hs'
      ? highSchoolShelf(offers)
      : s.leagueId === 'uni'
        ? universityShelf(s, offers, o)
        : proShelf(s, offers, o, L.id, promoted);
  const note = promoted ? `${s.club.name}, ${L.name} 승격! ${shelfNote}` : shelfNote;
  if (!L.amateur) options.push(...milOptions(s));
  const lastUni = s.leagueId === 'uni' && s.uniYears >= 4;
  const canRetire = (!L.amateur && (s.age >= 30 || L.tier === 0 || !options.length)) || lastUni;
  if (s.age >= retireAge(s)) {
    return {
      options: [],
      note: `${s.age}세가 되어 더 이상 현역으로 뛸 수 없습니다. 은퇴를 결정할 시간입니다.`,
      canRetire: true,
    };
  }
  const forced = !options.length && (!L.amateur || lastUni);
  return {
    options: forced ? [] : options,
    note: forced
      ? '더 이상 불러주는 팀이 없습니다. 은퇴를 결정할 시간입니다.'
      : isVeteran(s)
        ? `${note} ${retireAge(s)}세가 되면 은퇴합니다.`
        : note,
    canRetire: canRetire || forced,
  };
}

export function acceptOption(
  s: GameState,
  opt: MarketOption,
  /** 이번 이적 시장의 선택지 전부(플레이 성향 — 제의를 뿌리친 잔류를 센다). */
  options: readonly MarketOption[] = [],
): { text: string; ok?: boolean; reopen?: boolean } | null {
  if (opt.kind === 'renew' && !canAcceptRenewal(s, opt)) return null;
  noteMarket(s, opt, options);
  if (opt.kind === 'sangmu' || opt.kind === 'army' || opt.kind === 'serve') {
    return acceptMilitary(s, opt);
  }
  if (opt.kind === 'uni') {
    const c = pick(clubsIn('uni'));
    // T-10-034: 마친 학년 수. endSeason이 시즌마다 1씩 올린다 — 1로 시작하면 3시즌 만에 4학년 졸업이 됐다.
    s.leagueId = 'uni';
    s.club = { ...c };
    s.uniYears = 0;
    s.trust = 0;
    log(s, `${c.name}에 진학했습니다.`, 'big');
  } else if (opt.kind === 'renew') {
    s.contract = { years: opt.years, salary: opt.salary };
    addStat(s, 'trust', 1);
    log(
      s,
      opt.extension
        ? `${s.club.name}와 ${opt.extension.years}년 연장, 잔여 계약 포함 총 ${opt.years}년. 이번 시즌부터 연봉 ${fmtMoney(opt.salary)}`
        : `${s.club.name}와 ${opt.years}년 재계약, 연봉 ${fmtMoney(opt.salary)}`,
      'big',
    );
  } else if (opt.kind === 'offer') {
    const c = CLUBS.find((x) => x.id === opt.clubId)!;
    const from = s.club.name,
      wasAm = leagueOf(s.leagueId).amateur;
    // T-10-110 승강한 구단이면 이 커리어의 지금 리그로(오퍼를 만들 때와 같다).
    s.leagueId = clubLeagueId(c, s);
    s.club = { ...c };
    s.trust = opt.trust || 0;
    s.contract = { years: opt.years, salary: opt.salary };
    addStat(s, 'fame', Math.max(1, leagueOf(s.leagueId).tier * 1.5));
    log(
      s,
      wasAm
        ? `${c.name}(${leagueOf(s.leagueId).name}) 입단! ${opt.years}년 · 연봉 ${fmtMoney(opt.salary)}`
        : `${from} → ${c.name}(${leagueOf(s.leagueId).name}) 이적! ${opt.fee ? `이적료 ${fmtValue(opt.fee)} · ` : '자유계약 · '}${opt.years}년 · 연봉 ${fmtMoney(opt.salary)}`,
      'big',
    );
  }
  s.season = newSeason(s);
  s.phase = 0;
  return null;
}

// ───────── 은퇴 · 명예의 전당 ─────────
const LEGEND_LABEL: Record<keyof ReturnType<typeof legendTerms>, string> = {
  goals: '골 기여',
  assists: '도움 기여',
  cs: '무실점 기여',
  apps: '출전',
  trophies: '우승 트로피',
  awards: '개인 수상',
  caps: 'A매치',
  peak: '최고 OVR',
  ballonWin: '발롱도르 수상',
  ballonRank: '발롱도르 순위',
  wc: '월드컵 우승',
  century: '센추리 클럽',
  control: '경기 장악',
};
export interface LegendBreakdownItem {
  key: string;
  label: string;
  value: number;
}
/** legendScore()를 구성하는 각 항의 값을 그대로 나열한다 — 총합은 legendScore()와 항상 같다
 * (반올림도 legendScore()와 동일하게 마지막에 한 번만 적용). T-10-002 은퇴 리포트용. */
export function legendScoreBreakdown(s: LegendSource): {
  items: LegendBreakdownItem[];
  total: number;
} {
  const t = s.career.reduce(
    (a, r) => ({ g: a.g + r.goals, a: a.a + r.assists, p: a.p + r.apps, cs: a.cs + (r.cs || 0) }),
    { g: 0, a: 0, p: 0, cs: 0 },
  );
  const terms = legendTerms(
    s.pos,
    {
      goals: t.g,
      assists: t.a,
      cs: t.cs,
      apps: t.p,
      trophies: s.trophies.length,
      awards: legendAwardCount(s.awards, s.dpos),
      caps: s.nat.caps,
      peak: s.peak,
      ballon: s.awards.filter((x) => x.t === '발롱도르').length,
      ballonRankPoints: (s.ballon || []).reduce((tt, b) => tt + Math.max(0, 31 - b.rank), 0),
      worldCups: s.trophies.filter((x) => x.t === 'FIFA 월드컵 우승').length,
      control: controlPoints(s.career),
    },
    s.dpos,
  );
  const items: LegendBreakdownItem[] = Object.entries(terms)
    .map(([key, value]) => ({ key, label: LEGEND_LABEL[key as keyof typeof terms], value }))
    .filter((it) => it.value !== 0);
  const total = Math.round(items.reduce((sum, it) => sum + it.value, 0));
  return { items, total };
}
export function legendScore(s: LegendSource): number {
  return legendScoreBreakdown(s).total;
}
export const HOF_LOCAL_MAX = 30;
/** isPublic: 명예의 전당에 이름을 공개한 채로 시작할지(환경설정 '선수 이름 공개', T-10-065). */
export function retire(s: GameState, isPublic = false): HofEntry {
  s.retired = true;
  retireMilestones(s);
  const score = legendScore(s);
  checkTitles(s, { score });
  log(s, `${s.age}세, 정든 그라운드를 떠납니다.`, 'big');
  const t = s.career.reduce((a, r) => ({ g: a.g + r.goals, a: a.a + r.assists, p: a.p + r.apps }), {
    g: 0,
    a: 0,
    p: 0,
  });
  const entry: HofEntry = {
    name: s.name,
    pos: s.pos,
    ...(s.dpos && { dpos: s.dpos }),
    number: s.number,
    peak: s.peak,
    age: s.age,
    apps: t.p,
    goals: t.g,
    assists: t.a,
    trophies: s.trophies.length,
    awards: s.awards.length,
    caps: s.nat.caps,
    ballon: s.awards.filter((x) => x.t === '발롱도르').length,
    lastClub: s.club.name,
    lastClubId: s.club.id,
    score,
    title: mainTitle(s)?.id,
    date: new Date().toISOString().slice(0, 10),
    id: s.cid,
    detail: legendSnapshot(s),
    profile: s.peakProfile ?? peakProfileOf(s, s.peak - ovr(s)),
    pot: Math.round(truePot(s)),
    public: isPublic,
  };
  // T-10-107 같은 커리어가 다시 은퇴하면(탭 두 개로 같은 저장 등) 이전 기록을 바꾼다 — 겹치면 '내 선수' 목록이 깨진다.
  const hof = loadHOF().filter((h) => !entry.id || h.id !== entry.id);
  hof.push(entry);
  hof.sort((a, b) => b.score - a.score);
  // 30명이 찼어도 방금 은퇴한 선수는 남긴다 — 잘리면 은퇴 화면의 공유·이름 공개 카드가 사라진다.
  const kept = hof.slice(0, HOF_LOCAL_MAX);
  if (!kept.includes(entry)) kept[HOF_LOCAL_MAX - 1] = entry;
  saveKey('ft_hof', kept);
  return entry;
}
/** T-10-005. 은퇴 상세를 다시 그리는 데 필요한 필드만 복사한다(서버 계약 LegendSnapshotSchema와 같은
 * 모양 — strictObject라 CareerRecord의 부가 필드(comps·lgApps 등)는 빼고 옮긴다). 선수 이름은 넣지 않는다. */
export function legendSnapshot(s: GameState): LegendSnapshot {
  return {
    number: s.number,
    pos: s.pos,
    ...(s.dpos && { dpos: s.dpos }),
    age: s.age,
    peak: s.peak,
    lastClub: s.club.name,
    lastClubId: s.club.id,
    career: s.career.map((r) => ({
      year: r.year,
      age: r.age,
      club: r.club,
      ...(r.clubId ? { clubId: r.clubId } : {}),
      league: r.league,
      apps: r.apps,
      goals: r.goals,
      assists: r.assists,
      cs: r.cs || 0,
      rating: r.rating,
      rank: r.rank,
      ovr: r.ovr,
      honors: r.honors,
      ...(r.mil ? { mil: true } : {}),
      ...(r.ch?.length ? { ch: r.ch } : {}),
    })),
    trophies: s.trophies.map(({ year, t, club, clubId }) => ({
      year,
      t,
      club,
      ...(clubId ? { clubId } : {}),
    })),
    awards: s.awards.map(({ year, t }) => ({ year, t })),
    ballon: (s.ballon || []).map(({ year, rank }) => ({ year, rank })),
    nat: { caps: s.nat.caps, goals: s.nat.goals, assists: s.nat.assists },
    storyLog: (s.storyLog || []).map(({ year, key, name, ending }) => ({
      year,
      key,
      name,
      ending,
    })),
    miles: (s.miles || []).map(({ year, t }) => ({ year, t })),
    titles: (s.titles || []).map(({ id, year }) => ({ id, year })),
    ...(s.style ? { style: { ...s.style } } : {}),
  };
}
export function legendTitle(score: number, dpos: string | null | undefined): string {
  return legendBand(score, dpos).name;
}

// ───────── 저장 ─────────
/** 저장 성공 여부를 돌려준다(용량 초과·저장소 차단이면 false). */
export function saveKey(k: string, v: unknown): boolean {
  try {
    storage().setItem(k, JSON.stringify(v));
    return true;
  } catch {
    return false;
  }
}
/** 값을 읽지 않고(큰 세이브를 파싱하지 않고) 키가 있는지만 본다. */
export function hasKey(k: string): boolean {
  try {
    return storage().getItem(k) != null;
  } catch {
    return false;
  }
}
export function loadKey<T = unknown>(k: string): T | null {
  try {
    const raw = storage().getItem(k);
    return raw == null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}
export function loadHOF(): HofEntry[] {
  const hof = loadKey<HofEntry[]>('ft_hof') || loadKey<HofEntry[]>('sl_hof') || [];
  // T-10-107 예전에 겹쳐 저장된 같은 커리어는 하나만(점수 순이라 앞의 것).
  const seen = new Set<string>();
  return hof.filter((h) => !h.id || (!seen.has(h.id) && !!seen.add(h.id)));
}
/** 이 기기에 남은 은퇴 선수 이름(커리어 id → 이름). 서버엔 이름 공개를 끈 선수의 이름이 없어 화면이 이것으로 채운다. */
export const localCareerNames = (): Map<string, string> =>
  new Map(loadHOF().flatMap((h) => (h.id ? [[h.id, h.name] as const] : [])));
