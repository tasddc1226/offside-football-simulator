import type { LiveEvent, LiveStats } from '@offside/contracts';
import { LIVE_FEED_MAX as FEED_MAX } from '@offside/contracts/polling';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import type { Db } from '../client.js';
import { appMeta, careers, careerSeasons } from '../schema.js';
import { isPublicRetired, retiredCountKey } from './careers.js';
import { kstDays } from './admin.js';
import { honorsOf } from './firsts.js';

// T-10-030 홈 라이브 현황. 시각은 모두 ISO 문자열(UTC)이라 문자열 비교가 곧 시간 비교다.
const MIN = 60_000;
/** 이 시간 안에 시즌을 올린 진행 중 커리어를 '지금 뛰는 중'으로 센다. */
const PLAYING_WINDOW_MS = 20 * MIN;
/** 피드가 이만큼 차지 않으면 기간을 넓힌다: 1시간 → 24시간 → 7일(가장 넓은 기간으로 한 번만 읽고 거른다). */
const FEED_MIN = 4;
const WINDOWS_MS = [60 * MIN, 24 * 60 * MIN];
const FEED_SPAN_MS = 7 * 24 * 60 * MIN;

/**
 * created_at이 since 이후인 행 수. count(*)는 그 행 수만큼 읽는다(하루 수천 — D1 무료 한도를 가장 많이 쓰던 곳).
 * 행은 올라온 순서대로 rowid가 붙고 업로드는 upsert(onConflictDoUpdate, careers.ts)라 rowid가 바뀌지 않으므로
 * '마지막 rowid − since 뒤 첫 rowid + 1'로 두 행만 읽는다. 그사이 지워진 행(프로필 삭제)만큼 조금 크게 나올 수
 * 있는데 홈 현황 숫자라 괜찮다. since 뒤 행이 없으면 NULL.
 */
const countSince = (t: typeof careers | typeof careerSeasons, since: string) =>
  sql<
    number | null
  >`(select max(rowid) from ${t}) - (select rowid from ${t} where ${t.createdAt} >= ${since} order by ${t.createdAt} limit 1) + 1`;

export async function liveStats(db: Db, nowMs: number): Promise<LiveStats> {
  // 오늘 = 한국 시각 자정부터(운영 대시보드와 같은 기준).
  const today = kstDays(new Date(nowMs), 1).startIso;
  const recent = new Date(nowMs - PLAYING_WINDOW_MS).toISOString();
  const [[playing], daily, [retired]] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)` })
      .from(careers)
      .where(and(eq(careers.status, 'active'), gte(careers.updatedAt, recent))),
    db.get<{ seasons: number | null; created: number | null }>(
      sql`select ${countSince(careerSeasons, today)} as seasons, ${countSince(careers, today)} as created`,
    ),
    db
      .select({ n: appMeta.value })
      .from(appMeta)
      .where(eq(appMeta.key, retiredCountKey(new Date(nowMs)))),
  ]);
  return {
    playing: Number(playing?.n ?? 0),
    seasonsToday: Number(daily?.seasons ?? 0),
    newToday: Number(daily?.created ?? 0),
    retiredToday: Number(retired?.n ?? 0),
  };
}

/** 시즌 소식 한 줄의 열. 진행 중 커리어의 마지막 시즌에 커리어를 붙인다(careerId는 내보내지 않는다). */
const seasonCols = {
  at: careerSeasons.createdAt,
  name: careers.publicName,
  pos: careers.pos,
  club: careerSeasons.club,
  clubId: careerSeasons.clubId,
  league: careerSeasons.league,
  apps: careerSeasons.apps,
  goals: careerSeasons.goals,
  assists: careerSeasons.assists,
  cs: careerSeasons.cs,
  honorsJson: careerSeasons.honorsJson,
  year: careerSeasons.year,
  startYear: careers.startYear,
};
const retireCols = {
  at: careers.retiredAt,
  careerId: careers.id,
  name: careers.publicName,
  pos: careers.pos,
  number: careers.shirtNumber,
  score: careers.legendScore,
  lastClub: careers.lastClub,
  lastClubId: careers.lastClubId,
};

const seasonRows = (db: Db) =>
  db
    .select(seasonCols)
    .from(careers)
    .innerJoin(
      careerSeasons,
      and(
        eq(careerSeasons.careerId, careers.id),
        eq(
          careerSeasons.year,
          sql`(select max(s2.year) from career_seasons s2 where s2.career_id = ${careers.id})`,
        ),
      ),
    );

const retireRows = (db: Db) => db.select(retireCols).from(careers);

type SeasonRow = Awaited<ReturnType<typeof seasonRows>>[number];
type RetireRow = Awaited<ReturnType<typeof retireRows>>[number];

const seasonEvent = ({ honorsJson, year, startYear, ...s }: SeasonRow): LiveEvent => ({
  kind: 'season',
  ...s,
  honor: honorsOf(honorsJson)[0] ?? null,
  first: year === startYear,
});
const retireEvent = (r: RetireRow): LiveEvent => ({
  kind: 'retire',
  ...r,
  at: r.at!,
  score: r.score!,
});

/**
 * T-10-072 방금 올라온 기록 하나를 피드와 같은 모양으로 — 실시간으로 홈에 밀어 줄 소식. 피드에 올라가지 않을
 * 기록(마지막 시즌이 아니거나, 짧은 커리어 은퇴)과 다시 보낸 기록(시각이 now가 아니다)은 undefined.
 */
export async function liveEventOf(
  db: Db,
  kind: LiveEvent['kind'],
  careerId: string,
  now: string,
): Promise<LiveEvent | undefined> {
  if (kind === 'season') {
    const [row] = await seasonRows(db).where(
      and(
        eq(careers.id, careerId),
        eq(careers.status, 'active'),
        eq(careers.hidden, 0),
        eq(careerSeasons.createdAt, now),
      ),
    );
    return row && seasonEvent(row);
  }
  const [row] = await retireRows(db).where(
    and(eq(careers.id, careerId), isPublicRetired, eq(careers.retiredAt, now)),
  );
  return row && retireEvent(row);
}

export async function liveFeed(db: Db, nowMs: number): Promise<LiveEvent[]> {
  const since = new Date(nowMs - FEED_SPAN_MS).toISOString();
  const [seasons, retires] = await Promise.all([
    // 진행 중 커리어만, 선수당 마지막 시즌 하나만. 시즌을 올리면 커리어 updated_at이 바뀌므로 (status, updated_at)
    // 인덱스로 최근 12명을 골라 마지막 시즌을 붙인다. created_at 앞의 +는 그 인덱스를 막아 커리어부터 훑게 한다.
    seasonRows(db)
      .where(
        and(
          eq(careers.status, 'active'),
          eq(careers.hidden, 0),
          gte(careers.updatedAt, since),
          gte(sql`+${careerSeasons.createdAt}`, since),
        ),
      )
      .orderBy(desc(careers.updatedAt))
      .limit(FEED_MAX),
    retireRows(db)
      .where(and(isPublicRetired, gte(careers.retiredAt, since)))
      .orderBy(desc(careers.retiredAt))
      .limit(FEED_MAX),
  ]);
  const feed: LiveEvent[] = [...seasons.map(seasonEvent), ...retires.map(retireEvent)]
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
