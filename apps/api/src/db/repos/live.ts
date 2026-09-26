import type { LiveEvent, LiveStats } from '@offside/contracts';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import type { Db } from '../client.js';
import { careers, careerSeasons } from '../schema.js';
import { isPublicRetired } from './careers.js';
import { kstDays } from './admin.js';
import { honorsOf } from './firsts.js';

// T-10-030 홈 라이브 현황. 시각은 모두 ISO 문자열(UTC)이라 문자열 비교가 곧 시간 비교다.
const MIN = 60_000;
/** 이 시간 안에 시즌을 올린 진행 중 커리어를 '지금 뛰는 중'으로 센다. */
const PLAYING_WINDOW_MS = 20 * MIN;
/** 피드가 이만큼 차지 않으면 기간을 넓힌다: 1시간 → 24시간 → 7일(가장 넓은 기간으로 한 번만 읽고 거른다). */
const FEED_MIN = 4;
const FEED_MAX = 12;
const WINDOWS_MS = [60 * MIN, 24 * 60 * MIN];
const FEED_SPAN_MS = 7 * 24 * 60 * MIN;

export async function liveStats(db: Db, nowMs: number): Promise<LiveStats> {
  // 오늘 = 한국 시각 자정부터(운영 대시보드와 같은 기준).
  const today = kstDays(new Date(nowMs), 1).startIso;
  const recent = new Date(nowMs - PLAYING_WINDOW_MS).toISOString();
  const n = sql<number>`count(*)`;
  const [[playing], [seasons], [created], [retired]] = await Promise.all([
    db
      .select({ n })
      .from(careers)
      .where(and(eq(careers.status, 'active'), gte(careers.updatedAt, recent))),
    db.select({ n }).from(careerSeasons).where(gte(careerSeasons.createdAt, today)),
    db.select({ n }).from(careers).where(gte(careers.createdAt, today)),
    db
      .select({ n })
      .from(careers)
      .where(and(eq(careers.status, 'retired'), gte(careers.retiredAt, today))),
  ]);
  return {
    playing: Number(playing?.n ?? 0),
    seasonsToday: Number(seasons?.n ?? 0),
    newToday: Number(created?.n ?? 0),
    retiredToday: Number(retired?.n ?? 0),
  };
}

export async function liveFeed(db: Db, nowMs: number): Promise<LiveEvent[]> {
  const since = new Date(nowMs - FEED_SPAN_MS).toISOString();
  const [seasons, retires] = await Promise.all([
    // 한 선수가 피드를 채우지 않게 선수당 최신 시즌 하나만(SQLite는 max()와 함께 고른 나머지 컬럼을 그 행에서
    // 가져온다). 은퇴한 선수는 은퇴 소식만 남기므로 진행 중 커리어만 본다.
    db
      .select({
        at: sql<string>`max(${careerSeasons.createdAt})`,
        pos: careers.pos,
        club: careerSeasons.club,
        league: careerSeasons.league,
        apps: careerSeasons.apps,
        goals: careerSeasons.goals,
        assists: careerSeasons.assists,
        cs: careerSeasons.cs,
        honorsJson: careerSeasons.honorsJson,
        year: careerSeasons.year,
        startYear: careers.startYear,
      })
      .from(careerSeasons)
      .innerJoin(careers, eq(careers.id, careerSeasons.careerId))
      .where(and(gte(careerSeasons.createdAt, since), eq(careers.status, 'active')))
      .groupBy(careerSeasons.careerId)
      .orderBy(desc(sql`max(${careerSeasons.createdAt})`))
      .limit(FEED_MAX),
    db
      .select({
        at: careers.retiredAt,
        careerId: careers.id,
        name: careers.publicName,
        pos: careers.pos,
        number: careers.shirtNumber,
        score: careers.legendScore,
        lastClub: careers.lastClub,
      })
      .from(careers)
      .where(and(isPublicRetired, gte(careers.retiredAt, since)))
      .orderBy(desc(careers.retiredAt))
      .limit(FEED_MAX),
  ]);
  const feed: LiveEvent[] = [
    ...seasons.map(({ honorsJson, year, startYear, ...s }) => ({
      kind: 'season' as const,
      ...s,
      honor: honorsOf(honorsJson)[0] ?? null,
      first: year === startYear,
    })),
    ...retires.map((r) => ({ kind: 'retire' as const, ...r, at: r.at!, score: r.score! })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, FEED_MAX);
  // 최신순이라 짧은 기간의 소식은 앞부분이다 — 그 기간만으로 충분히 차면 거기까지만 보여 준다.
  for (const w of WINDOWS_MS) {
    const cut = new Date(nowMs - w).toISOString();
    const inWindow = feed.filter((e) => e.at >= cut);
    if (inWindow.length >= FEED_MIN) return inWindow;
  }
  return feed;
}
