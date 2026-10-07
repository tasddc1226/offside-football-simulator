// ───────── 레전드 점수 · 은퇴 스냅샷 (T-11-126) ─────────
// 첫 화면(app-core legend·career)이 쓰는 순수 계산만 둔다. season.ts에 두면 홈이 시즌 엔진을 끌어온다.
import type { LegendSnapshot } from '@offside/contracts';
import { controlPoints, legendAwardCount, legendTerms } from '@offside/contracts/hof-rules';
import type { GameState, LegendSource } from './types.js';

/** 30인 후보 기록과 구분한 실제 발롱도르 수상 횟수. */
export const ballonWinsOf = (s: Pick<LegendSource, 'awards'>): number =>
  s.awards.filter((x) => x.t === '발롱도르').length; // i18n-ignore 저장값

/** 레전드 점수의 각 항. 합을 반올림한 값이 legendScore()다. */
export function legendTermsOf(s: LegendSource): ReturnType<typeof legendTerms> {
  const t = s.career.reduce(
    (a, r) => ({ g: a.g + r.goals, a: a.a + r.assists, p: a.p + r.apps, cs: a.cs + (r.cs || 0) }),
    { g: 0, a: 0, p: 0, cs: 0 },
  );
  return legendTerms(
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
      ballon: ballonWinsOf(s),
      ballonRankPoints: (s.ballon || []).reduce((tt, b) => tt + Math.max(0, 31 - b.rank), 0),
      worldCups: s.trophies.filter((x) => x.t === 'FIFA 월드컵 우승').length, // i18n-ignore 저장값
      control: controlPoints(s.career),
    },
    s.dpos,
  );
}
export function legendScore(s: LegendSource): number {
  return Math.round(Object.values(legendTermsOf(s)).reduce((sum, v) => sum + v, 0));
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
