// T-11-407 컵 경기 전 예상 승 · 무 · 패. 명단은 경기 1시간 전(lockAt)부터 경기가 끝날 때까지 바뀌지 않으므로(R1 명단 잠금 ·
// R2 판매 등록 · 감독 전향 막힘), 잠긴 뒤 한 번 계산해 cup_matches.odds_json에 두고 모두에게 같은 값을 보인다. 경기 한 판
// (simulateMatch)과 같은 matchSetup으로 계산해 값이 어긋나지 않는다.
import { CUP_ROUNDS, lockAt, type CupDef, type CupRound } from '@offside/contracts/cup';
import type { CupMatchOdds, CupOdds } from '@offside/contracts';
import { inArray } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { cupTeamOf } from '../db/repos/ownerTeams.js';
import { ownerTeams } from '../db/schema.js';
import type { CupMatchRow } from './cup.js';
import { lineupsOf, type Lineups } from './match.js';
import { matchOdds } from './sim.js';

/** 저장 모양: 홈 기준 승(h) · 무(d) · 패(a) 정수 %(합 100)와 기대 득점(xh · xa, 소수 첫째 자리). */
export type StoredOdds = { h: number; d: number; a: number; xh: number; xa: number };

/** cron 한 번에 계산할 경기 수. 경기마다 쿼리 2번(선발 · 감독)이라 32경기면 70번 안쪽이다. */
export const CUP_ODDS_PER_TICK = 32;

const round1 = (x: number) => Math.round(x * 10) / 10;

/** 두 팀 명단으로 중립 경기 예상을 낸다. atkK는 경기(playCupMatch)와 같은 밸런스 값(T-11-409). 정수 %로 반올림하고 합이 100이 되게 무승부로 맞춘다. */
export function oddsOfLineups(lineups: Lineups, season: number, atkK: number): StoredOdds {
  const o = matchOdds(lineups.home, lineups.away, season, {
    neutral: true,
    coaches: lineups.coaches,
    atkK,
  });
  const h = Math.round(o.win * 100);
  const a = Math.round(o.loss * 100);
  return { h, d: Math.max(0, 100 - h - a), a, xh: round1(o.homeXg), xa: round1(o.awayXg) };
}

export function parseOdds(json: string | null | undefined): StoredOdds | null {
  if (!json) return null;
  try {
    const o = JSON.parse(json) as Partial<StoredOdds>;
    return [o.h, o.d, o.a, o.xh, o.xa].every((x) => Number.isFinite(x)) ? (o as StoredOdds) : null;
  } catch {
    return null;
  }
}

/** 경기 목록 응답의 예상(홈 기준). */
export const matchOddsOf = (json: string | null | undefined): CupMatchOdds | null => {
  const o = parseOdds(json);
  return o ? { home: o.h, draw: o.d, away: o.a } : null;
};

/** 내 다음 경기 칸(T-11-405)의 예상 — 내 팀 기준으로 돌린다. */
export const mineOdds = (o: StoredOdds, homeMine: boolean): CupOdds => ({
  win: homeMine ? o.h : o.a,
  draw: o.d,
  loss: homeMine ? o.a : o.h,
  xg: { mine: homeMine ? o.xh : o.xa, opp: homeMine ? o.xa : o.xh },
});

/** 두 팀 중 이번 시즌 팀만(시즌이 지난 팀 · 없어진 팀은 몰수라 예상이 없다). T-11-570 컵 명단 프리셋이 있으면 그 편성으로. */
export async function cupTeamsOf(db: Db, cup: CupDef, ids: readonly string[]) {
  const rows = ids.length
    ? await db
        .select()
        .from(ownerTeams)
        .where(inArray(ownerTeams.id, [...ids]))
    : [];
  return (id: string | null) => {
    const t = id ? rows.find((r) => r.id === id) : undefined;
    return t && t.season === cup.season ? cupTeamOf(t) : undefined;
  };
}

/** 명단이 잠겼고 아직 치르지 않았으며 예상이 없는 경기(경기 시각이 된 경기는 playCupMatch가 함께 채운다). */
export const oddsDue = (matches: readonly CupMatchRow[], now: string, limit = CUP_ODDS_PER_TICK) =>
  matches
    .filter(
      (m) =>
        !m.playedAt &&
        !m.oddsJson &&
        m.homeTeamId &&
        m.awayTeamId &&
        lockAt(m.at) <= now &&
        m.at > now,
    )
    .sort(
      (a, b) =>
        a.at.localeCompare(b.at) ||
        CUP_ROUNDS.indexOf(a.round as CupRound) - CUP_ROUNDS.indexOf(b.round as CupRound) ||
        a.grp - b.grp ||
        a.slot - b.slot,
    )
    .slice(0, limit);

/** 잠긴 경기의 예상을 계산해 둔다. 쓴 경기 수를 돌려준다. 쓰기는 odds_json IS NULL일 때만이라 두 번 써도 같다. */
export async function fillCupOdds(
  db: Db,
  cup: CupDef,
  matches: readonly CupMatchRow[],
  now: string,
  atkKOf: () => Promise<number>,
  limit = CUP_ODDS_PER_TICK,
) {
  const due = oddsDue(matches, now, limit);
  if (!due.length) return 0;
  const atkK = await atkKOf();
  const team = await cupTeamsOf(db, cup, [
    ...new Set(due.flatMap((m) => [m.homeTeamId!, m.awayTeamId!])),
  ]);
  const d1 = db.$client;
  const stmts: D1PreparedStatement[] = [];
  for (const m of due) {
    const home = team(m.homeTeamId);
    const away = team(m.awayTeamId);
    if (!home || !away) continue;
    const odds = oddsOfLineups(await lineupsOf(db, cup.season, home, away), cup.season, atkK);
    stmts.push(
      d1
        .prepare(
          'UPDATE cup_matches SET odds_json = ? WHERE id = ? AND played_at IS NULL AND odds_json IS NULL',
        )
        .bind(JSON.stringify(odds), m.id),
    );
  }
  if (stmts.length) await d1.batch(stmts);
  return stmts.length;
}
