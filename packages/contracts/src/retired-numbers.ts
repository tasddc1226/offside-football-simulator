/**
 * T-10-076 영구결번. 한 구단에서 레전드급 업적을 남기고 은퇴한 선수에게 그 구단의 그 등번호를 서버 전체에서
 * 영구히 준다(구단·번호마다 한 명, 먼저 자격을 채운 선수). zod가 없는 서브패스(`@offside/contracts/retired-numbers`)라
 * 서버 판정(apps/api db/repos/retiredNumbers.ts)과 웹 은퇴 화면의 결번 심사가 같은 점수를 쓴다.
 *
 * 구단 기여 점수 = 시즌마다 (6 + 골·도움·무실점 포지션 가중 + 출전 × 0.05) × 리그 배수 + 그 시즌 구단 우승·개인상 점수.
 * 대표팀 대회·협회 상은 구단 업적이 아니라 0점. 기준(RN_CUT)은 운영 명예의 전당 1,542명에서 상위 1%(15명)의
 * 경계값이다(2026-09-27 보정).
 */

/** 결번 기준 점수(상위 1%). */
export const RN_CUT = 827;
/** 그 구단에서 뛴 최소 시즌 수. */
export const RN_MIN_SEASONS = 6;
/** 결번 심사 카드를 보여 주는 하한(기준의 60%) — 아깝게 못 받은 선수에게 얼마나 남았는지 알려 준다. */
export const RN_NEAR = 0.6;

type Pos = 'FW' | 'MF' | 'DF' | 'GK';

/** 리그 이름 → 등급(web game/data.ts LEAGUES의 tier). 고교·대학은 구단 기록이 아니라 뺀다(K3는 tier 0이지만 프로). */
export const RN_LEAGUE_TIER: Record<string, number> = {
  '고교 리그': 0,
  'U리그 (대학)': 0,
  K3리그: 0,
  K리그2: 1,
  K리그1: 2,
  J1리그: 3,
  MLS: 3,
  에레디비시: 4,
  '리그 1': 5,
  분데스리가: 6,
  '세리에 A': 6,
  라리가: 7,
  프리미어리그: 8,
};
const AMATEUR = new Set(['고교 리그', 'U리그 (대학)']);

/** 포지션별 골·도움·무실점 가중(web game/season.ts LEGEND_W와 같다). */
const W: Record<Pos, { g: number; a: number; cs: number }> = {
  FW: { g: 0.42, a: 0.35, cs: 0 },
  MF: { g: 0.65, a: 0.75, cs: 0 },
  DF: { g: 0.9, a: 0.5, cs: 0.9 },
  GK: { g: 1, a: 0.6, cs: 0.95 },
};

const NATIONAL =
  /아시안컵|월드컵|올림픽|아시안게임|네이션스|유로 |코파 아메리카|대한축구협회|국제선수|대회 MVP|대회 베스트|AFC 올해의 선수|동아시안|U-/;
const LEAGUE_TITLE =
  /(리그|리가|분데스리가|세리에 A|에레디비시|리그 1|K리그1|K리그2|J1리그|MLS|K3리그) 우승$/;

/** 시즌 영예 한 줄의 구단 기여 점수. */
export function honorPoints(h: string): number {
  if (NATIONAL.test(h)) return 0;
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
  from: number;
  to: number;
  apps: number;
  goals: number;
  assists: number;
  cs: number;
  /** 경기 기여(리그 배수 적용). */
  play: number;
  /** 구단 우승·개인상. */
  honors: number;
  score: number;
}

/**
 * 구단별 기여를 점수 내림차순으로. resolve: clubId가 없는 옛 시즌의 구단 이름 → id(없으면 이름으로만 묶고
 * clubId는 null). 병역(상무)·고교·대학 시즌은 뺀다.
 */
export function clubContributions(
  pos: Pos,
  seasons: readonly RnSeason[],
  resolve: (name: string) => string | undefined = () => undefined,
): RnClub[] {
  const w = W[pos];
  const by = new Map<string, RnClub>();
  for (const r of seasons) {
    if (r.mil || AMATEUR.has(r.league)) continue;
    const id = r.clubId || resolve(r.club) || null;
    const key = id ?? `name:${r.club}`;
    let b = by.get(key);
    if (!b) {
      b = {
        clubId: id,
        club: r.club,
        seasons: 0,
        from: r.year,
        to: r.year,
        apps: 0,
        goals: 0,
        assists: 0,
        cs: 0,
        play: 0,
        honors: 0,
        score: 0,
      };
      by.set(key, b);
    }
    const cs = r.cs ?? 0;
    const m = 0.4 + 0.075 * (RN_LEAGUE_TIER[r.league] ?? 1);
    b.seasons++;
    b.club = r.club;
    b.from = Math.min(b.from, r.year);
    b.to = Math.max(b.to, r.year);
    b.apps += r.apps;
    b.goals += r.goals;
    b.assists += r.assists;
    b.cs += cs;
    b.play += m * (6 + r.goals * w.g + r.assists * w.a + cs * w.cs + r.apps * 0.05);
    b.honors += r.honors.reduce((t, h) => t + honorPoints(h), 0);
  }
  const out = [...by.values()];
  for (const b of out) b.score = b.play + b.honors;
  return out.sort((a, b) => b.score - a.score);
}

/** 결번 자격: 구단을 알고, 그 구단에서 RN_MIN_SEASONS 시즌 이상, 기여 점수가 기준 이상. */
export const rnQualifies = (c: RnClub): boolean =>
  c.clubId != null && c.seasons >= RN_MIN_SEASONS && c.score >= RN_CUT;

/** 결번을 노릴 구단 — 가장 큰 기여 구단, 그 자리가 이미 찼으면 두 번째 구단(자격이 있을 때만). */
export const rnCandidates = (clubs: readonly RnClub[]): RnClub[] =>
  clubs.filter(rnQualifies).slice(0, 2);
