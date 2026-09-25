import type { LiveEvent, LiveStats } from '@offside/contracts';
import { and, desc, eq, gte, isNotNull, sql } from 'drizzle-orm';
import type { Db } from '../client.js';
import { careers, careerSeasons } from '../schema.js';

// T-10-030 홈 라이브 현황. 시각은 모두 ISO 문자열(UTC)이라 문자열 비교가 곧 시간 비교다.
const MIN = 60_000;
/** 이 시간 안에 시즌을 올린 진행 중 커리어를 '지금 뛰는 중'으로 센다. */
export const PLAYING_WINDOW_MS = 20 * MIN;
/** 피드가 이만큼 차지 않으면 기간을 넓힌다: 1시간 → 24시간 → 7일. */
const FEED_MIN = 4;
const FEED_MAX = 12;
/** 선수당 한 줄만 남기므로 시즌은 넉넉히 읽는다(오프라인에서 몰아 올린 시즌이 한꺼번에 들어온다). */
const SEASON_SCAN = 60;
const WINDOWS_MS = [60 * MIN, 24 * 60 * MIN, 7 * 24 * 60 * MIN];

/** 한국 시각(UTC+9) 오늘 자정의 UTC ISO. */
export function kstMidnightIso(nowMs: number): string {
  const KST = 9 * 60 * MIN;
  const d = new Date(nowMs + KST);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - KST).toISOString();
}

export async function liveStats(db: Db, nowMs: number): Promise<LiveStats> {
  const today = kstMidnightIso(nowMs);
  const recent = new Date(nowMs - PLAYING_WINDOW_MS).toISOString();
  const n = sql<number>`count(*)`;
  const [[playing], [seasons], [created], [retired]] = await Promise.all([
    db.select({ n }).from(careers).where(and(eq(careers.status, 'active'), gte(careers.updatedAt, recent))),
    db.select({ n }).from(careerSeasons).where(gte(careerSeasons.createdAt, today)),
    db.select({ n }).from(careers).where(gte(careers.createdAt, today)),
    db.select({ n }).from(careers).where(and(eq(careers.status, 'retired'), gte(careers.retiredAt, today))),
  ]);
  return {
    playing: Number(playing?.n ?? 0),
    seasonsToday: Number(seasons?.n ?? 0),
    newToday: Number(created?.n ?? 0),
    retiredToday: Number(retired?.n ?? 0),
  };
}

function firstHonor(json: string): string | null {
  try {
    const v: unknown = JSON.parse(json);
    return Array.isArray(v) && typeof v[0] === 'string' ? v[0] : null;
  } catch {
    return null;
  }
}

async function feedSince(db: Db, since: string): Promise<LiveEvent[]> {
  const [seasons, retires] = await Promise.all([
    db
      .select({
        careerId: careerSeasons.careerId,
        at: careerSeasons.createdAt,
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
      .where(gte(careerSeasons.createdAt, since))
      .orderBy(desc(careerSeasons.createdAt), desc(careerSeasons.year))
      .limit(SEASON_SCAN),
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
      .where(and(eq(careers.status, 'retired'), isNotNull(careers.legendScore), gte(careers.retiredAt, since)))
      .orderBy(desc(careers.retiredAt))
      .limit(FEED_MAX),
  ]);
  // 한 선수가 피드를 채우지 않게 선수당 최신 시즌 하나만 두고, 은퇴한 선수는 은퇴 소식만 남긴다.
  const seen = new Set(retires.map((r) => r.careerId));
  const latest = seasons.filter((s) => !seen.has(s.careerId) && (seen.add(s.careerId), true));
  const events: LiveEvent[] = [
    ...latest.map(({ careerId: _id, honorsJson, year, startYear, ...s }) => ({
      kind: 'season' as const,
      ...s,
      honor: firstHonor(honorsJson),
      first: year === startYear,
    })),
    ...retires.map((r) => ({ kind: 'retire' as const, ...r, at: r.at!, score: r.score! })),
  ];
  return events.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)).slice(0, FEED_MAX);
}

export async function liveFeed(db: Db, nowMs: number): Promise<LiveEvent[]> {
  let feed: LiveEvent[] = [];
  for (const w of WINDOWS_MS) {
    feed = await feedSince(db, new Date(nowMs - w).toISOString());
    if (feed.length >= FEED_MIN) break;
  }
  return feed;
}
