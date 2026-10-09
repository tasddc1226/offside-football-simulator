/**
 * T-10-076 영구결번. 한 구단에서 레전드급 업적을 남기고 은퇴한 선수에게 그 구단의 그 등번호를 서버 전체에서
 * 영구히 준다(구단·번호마다 한 명, 먼저 자격을 채운 선수). 판정은 서버(apps/api db/repos/retiredNumbers.ts)만
 * 한다 — 기준값이 웹 번들에 실리지 않게 웹은 이 서브패스(`@offside/contracts/retired-numbers`)를 import하지 않는다(eslint).
 *
 * 구단 기여 점수 = 시즌마다 (6 + 골·도움·무실점 포지션 가중 + 출전 × 0.05) × 리그 배수 + 그 시즌 구단 우승·개인상 점수,
 * 여기에 구단 애착(RN_BOND — 원클럽맨·그 구단에서 은퇴·친정 복귀·오랜 연속 시즌)만큼 퍼센트를 더한다. 대표팀 대회·협회
 * 상은 구단 업적이 아니라 0점. 기준(RN_CUT)은 운영 명예의 전당 1,542명에서 상위 1%(15명)의 경계값이다(2026-09-27
 * 보정). 애착을 더하면 2,368명 중 자격자가 31명 → 37명이 된다(2026-09-28).
 *
 * 판정은 서버가 받아 둔 시즌 기록(career_seasons)으로만 한다. 클라이언트가 값을 지어 보내도 크게 부풀지 않게, 구단은
 * 게임에 있는 클럽 id로만 인정하고 리그는 그 클럽의 리그로 정하며, 한 시즌의 영예 점수는 RN_SEASON_HONOR_CAP까지만 센다.
 */
import { isDefaultClubId, LEAGUE_BASE, leagueOfClub, type LeagueBase } from './club-names.js';
import { LEGEND_W } from './hof-rules.js';
import { CONFEDS } from './nations.js';
import type { PosGroup } from './positions.js';

/** 프리시즌 결번 기준 점수(상위 1%, 포지션 공통). */
export const RN_CUT = 827;
/** T-11-094 시즌 1부터의 결번 기준 점수 — 프리시즌 운영 기록에서 포지션마다 상위 1%(2026-10-05). */
export const RN_CUT_SEASON: Readonly<Record<Pos, number>> = {
  FW: 1500,
  MF: 1000,
  DF: 870,
  GK: 890,
};
/** 그 시즌(0 = 프리시즌)·포지션의 결번 기준 점수. */
export const rnCut = (pos: Pos, season: number): number =>
  season === 0 ? RN_CUT : RN_CUT_SEASON[pos];
/** 그 구단에서 뛴 최소 시즌 수. */
export const RN_MIN_SEASONS = 6;

type Pos = PosGroup;

const LEAGUE_BY_NAME = new Map<string, LeagueBase>(LEAGUE_BASE.map((l) => [l.name, l]));
/**
 * 구단 애착 가산(경기·영예 점수에 곱하는 비율). 서버가 받아 둔 시즌 기록만으로 정한다 — 인지도·감독 신뢰 같은
 * 기기 값은 검증할 수 없어 쓰지 않는다. 원클럽맨이면 나머지는 이미 담겨 있어 원클럽맨 몫만 준다.
 */
export const RN_BOND = {
  /** 프로 시즌 전부를 그 구단에서. */
  oneClub: 0.2,
  /** 마지막 프로 시즌이 그 구단(그 구단에서 은퇴). */
  lastClub: 0.05,
  /** 떠났다가 다시 돌아왔다(그 구단 시기가 두 번 이상). */
  homecoming: 0.05,
  /** 그 구단에서 longRunSeasons 시즌 이상 연속으로. */
  longRun: 0.05,
  longRunSeasons: 10,
  cap: 0.25,
} as const;

/** 한 시즌 영예 점수 상한. 운영 명예의 전당 상위 64명의 한 시즌 최고가 192점(2026-09-28)이다. */
export const RN_SEASON_HONOR_CAP = 250;

const NATIONAL =
  /아시안컵|월드컵|올림픽|아시안게임|네이션스|유로 |코파 아메리카|축구협회|국제선수|대회 MVP|대회 베스트|동아시안|U-/;
/** 연맹 대륙컵·올해의 선수상(T-10-096) — 대표팀 몫이라 구단 점수에 들지 않는다. */
const CONF_HONORS = Object.values(CONFEDS).flatMap((c) => [c.cup, c.poty]);
const LEAGUE_TITLE =
  /(리그|리가|분데스리가|세리에 A|에레디비시|리그 1|K리그1|K리그2|J1리그|MLS|K3리그) 우승$/;

/** 시즌 영예 한 줄의 구단 기여 점수. */
export function honorPoints(h: string): number {
  if (NATIONAL.test(h) || CONF_HONORS.some((n) => h.includes(n))) return 0;
  if (h.includes('발롱도르')) return 60;
  if (h.includes('챔피언스리그 우승') && !h.includes('AFC')) return 40;
  if (LEAGUE_TITLE.test(h) && !h.includes('컵')) return 25;
  if (h.includes('유로파리그 우승') || h.includes('AFC 챔피언스')) return 20;
  if (h.includes('컨퍼런스리그 우승')) return 12;
  if (/슈퍼컵|실드|수페르코파|슈퍼 ?컵/.test(h)) return 3;
  if (h.includes('우승')) return 8;
  if (/MVP|올해의 선수/.test(h)) return 15;
  if (/득점왕|골든부트|피치치|도움왕|골든슈|게르트 뮐러|카포칸노니에레/.test(h)) return 10;
  if (h.includes('FIFPRO')) return 8;
  if (/베스트 11|올해의 팀/.test(h)) return 4;
  if (h.includes('푸스카스')) return 5;
  return 2;
}

/** 판정에 쓰는 시즌 한 줄(web CareerRecord · 은퇴 스냅샷 career[]의 공통 부분). */
export interface RnSeason {
  year: number;
  club: string;
  clubId?: string | null | undefined;
  league: string;
  apps: number;
  goals: number;
  assists: number;
  cs?: number | null | undefined;
  honors: readonly string[];
  mil?: boolean | null | undefined;
}

/** 한 구단에서의 기여. */
export interface RnClub {
  /** 결번 자리의 구단. 옛 기록에서 이름으로도 찾지 못한 구단은 null(결번 대상 아님). */
  clubId: string | null;
  /** 마지막으로 뛴 시즌의 구단 이름. */
  club: string;
  seasons: number;
  /** 경기 기여(리그 배수 적용). */
  play: number;
  /** 구단 우승·개인상. */
  honors: number;
  /** 구단 애착 가산(RN_BOND). */
  bond: number;
  score: number;
}

/**
 * 구단별 기여를 점수 내림차순으로. resolve: clubId가 없는 옛 시즌의 구단 이름 → id(없으면 이름으로만 묶고
 * clubId는 null). 병역(상무)·고교·대학 시즌은 뺀다(병역은 연속 시즌도 끊지 않는다).
 */
export function clubContributions(
  pos: Pos,
  seasons: readonly RnSeason[],
  resolve: (name: string) => string | undefined = () => undefined,
): RnClub[] {
  const w = LEGEND_W[pos];
  const by = new Map<string, RnClub>();
  /** 프로 시즌을 연도 순으로 — 구단 애착(연속·복귀·은퇴 구단)을 센다. */
  const order: string[] = [];
  for (const r of [...seasons].sort((a, b) => a.year - b.year)) {
    // 게임에 없는 클럽 id는 이름으로 다시 찾는다(못 찾으면 결번 대상이 아니다).
    const id = (r.clubId && isDefaultClubId(r.clubId) ? r.clubId : resolve(r.club)) || null;
    // 고교·대학은 구단 기록이 아니라 뺀다(K3는 tier 0이지만 프로).
    const league = (id && leagueOfClub(id)) || LEAGUE_BY_NAME.get(r.league);
    if (r.mil || league?.amateur) continue;
    const key = id ?? `name:${r.club}`;
    order.push(key);
    let b = by.get(key);
    if (!b) {
      b = { clubId: id, club: r.club, seasons: 0, play: 0, honors: 0, bond: 0, score: 0 };
      by.set(key, b);
    }
    const cs = r.cs ?? 0;
    const m = 0.4 + 0.075 * (league?.tier ?? 1);
    b.seasons++;
    b.club = r.club;
    b.play += m * (6 + r.goals * w.g + r.assists * w.a + cs * w.cs + r.apps * 0.05);
    const honors = [...new Set(r.honors)].reduce((t, h) => t + honorPoints(h), 0);
    b.honors += Math.min(honors, RN_SEASON_HONOR_CAP);
  }
  for (const [key, b] of by) b.bond = (b.play + b.honors) * bondRate(order, key);
  const out = [...by.values()];
  for (const b of out) b.score = b.play + b.honors + b.bond;
  return out.sort((a, b) => b.score - a.score);
}

/** 그 구단의 애착 비율(RN_BOND). order: 프로 시즌의 구단 키(연도 순). */
function bondRate(order: readonly string[], key: string): number {
  if (order.every((k) => k === key)) return RN_BOND.oneClub;
  let run = 0;
  let longest = 0;
  let stints = 0;
  order.forEach((k, i) => {
    if (k !== key) {
      run = 0;
      return;
    }
    if (order[i - 1] !== key) stints++;
    longest = Math.max(longest, ++run);
  });
  const rate =
    (order.at(-1) === key ? RN_BOND.lastClub : 0) +
    (stints >= 2 ? RN_BOND.homecoming : 0) +
    (longest >= RN_BOND.longRunSeasons ? RN_BOND.longRun : 0);
  return Math.min(rate, RN_BOND.cap);
}

/** 결번 자격: 구단을 알고, 그 구단에서 RN_MIN_SEASONS 시즌 이상, 기여 점수가 기준(cut) 이상. */
export const rnQualifies = (c: RnClub, cut: number): boolean =>
  c.clubId != null && c.seasons >= RN_MIN_SEASONS && c.score >= cut;

/**
 * T-11-180 결번을 못 받은 이유(가장 큰 기여 구단 기준). 기준의 절반도 못 채웠으면 null — 대부분의 은퇴엔 띄우지 않는다.
 * 기준값을 그대로 내보내지 않게 점수는 기준 대비 10% 단위(최대 90%)로만 준다.
 */
export function rnMissOf(clubs: readonly RnClub[], cut: number): RnMiss | null {
  const best = clubs.find((c) => c.clubId != null);
  if (!best) return null;
  if (best.score >= cut)
    return best.seasons < RN_MIN_SEASONS
      ? { reason: 'seasons', club: best.club, seasons: best.seasons, need: RN_MIN_SEASONS }
      : null;
  const pct = Math.floor((best.score / cut) * 10) * 10;
  return pct >= 50 ? { reason: 'score', club: best.club, pct } : null;
}
export type RnMiss =
  | { reason: 'seasons'; club: string; seasons: number; need: number }
  | { reason: 'score'; club: string; pct: number };

/** 결번을 노릴 구단 — 가장 큰 기여 구단, 그 자리가 이미 찼으면 두 번째 구단(자격이 있을 때만). */
export const rnCandidates = (clubs: readonly RnClub[], cut: number): RnClub[] =>
  clubs.filter((c) => rnQualifies(c, cut)).slice(0, 2);
