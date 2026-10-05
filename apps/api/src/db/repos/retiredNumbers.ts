import {
  RETIRED_PAGE,
  type LiveRetiredNumber,
  type RetiredNumberResult,
  type RetiredNumbersResponse,
  type RetiredNumbersSummary,
} from '@offside/contracts';
import { defaultClubIds } from '@offside/contracts/club-names';
import {
  clubContributions,
  rnCandidates,
  rnCut,
  type RnClub,
} from '@offside/contracts/retired-numbers';
import { and, asc, desc, eq, inArray, isNotNull, lt, sql } from 'drizzle-orm';
import type { Db } from '../client.js';
import { runBatch } from './batch.js';
import { isPublicRetired, storedSeasonsOf, type StoredSeasonRow } from './careers.js';
import { setMeta } from './firsts.js';
import { appMeta, careers, clubCustoms, retiredNumbers } from '../schema.js';
import { lifeSeasons } from '../../plausibility.js';

// T-10-076 영구결번. 은퇴 PUT(이름 공개 토글 재전송 포함) 때 그 커리어를 심사해, 자격이 있고 이름을 공개했으면
// 가장 큰 기여 구단의 그 등번호를 잡는다 — 이미 찼으면 두 번째 구단(자격이 있을 때만). 자리는 먼저 자격을 채운
// 커리어가 가져가고(INSERT … ON CONFLICT DO NOTHING) 취소되지 않는다. 판정 규칙은 @offside/contracts/retired-numbers,
// 근거는 서버가 받아 둔 시즌 기록(career_seasons) — 은퇴 때 함께 오는 스냅샷은 클라이언트가 고칠 수 있어 쓰지 않는다.
// 처음 배포될 때는 기존 공개 은퇴 기록을 은퇴 시각 순서로 한 번 훑어 결번을 채운다(서버 최초 기록처럼 RESCAN_CHUNK명씩,
// 진행 위치는 app_meta). 다 훑기 전의 은퇴 PUT은 한 조각을 진행시키고 pending을 돌려준다 — 은퇴 시각이 더 늦은 새
// 은퇴가 옛 은퇴보다 먼저 자리를 잡지 않게.
// T-11-029 결번은 시즌마다 따로 센다. 시즌은 커리어의 service_season(NULL이면 0 = 프리시즌) — 시즌 1 선수도 프리시즌
// 선수와 같은 구단·번호를 받고, seq도 시즌 안에서 센다.
const BACKFILL_VERSION = '1';
const META_KEY = 'retired_numbers_backfill';
/** 다시 훑는 중이면 마지막으로 판정한 `${retiredAt}\t${id}`. */
const CURSOR_KEY = 'retired_numbers_cursor';
const RESCAN_CHUNK = 40;

/** 기본 클럽 이름 → id(옛 기록엔 clubId가 없다). */
const DEFAULT_IDS = defaultClubIds();

const judgeColumns = {
  id: careers.id,
  profileId: careers.profileId,
  pos: careers.pos,
  publicName: careers.publicName,
  shirtNumber: careers.shirtNumber,
  retireAge: careers.retireAge,
  retiredAt: careers.retiredAt,
  serviceSeason: careers.serviceSeason,
};
type JudgeRow = Pick<typeof careers.$inferSelect, keyof typeof judgeColumns>;

/** 유저가 바꾼 구단 이름 → id(club_customs). 옛 시즌 기록의 바뀐 이름을 찾는 데 쓴다. */
function renamedIds(clubsJson: string | undefined): Map<string, string> {
  const out = new Map<string, string>();
  if (!clubsJson) return out;
  try {
    const v = JSON.parse(clubsJson) as Record<string, { name?: unknown }>;
    for (const [id, c] of Object.entries(v)) if (typeof c?.name === 'string') out.set(c.name, id);
  } catch {
    /* 깨진 값은 기본 이름으로만 찾는다. */
  }
  return out;
}

/** 결번을 노릴 구단(0–2개)과 등번호. 등번호가 없으면 null. 은퇴 나이 뒤의 시즌(은퇴 뒤 덧붙인 행)은 세지 않는다. */
function candidatesOf(
  row: JudgeRow,
  seasons: StoredSeasonRow[] | undefined,
  clubsJson: string | undefined,
): { number: number; clubs: RnClub[] } | null {
  const number = row.shirtNumber;
  if (number === null || !(number >= 1) || !seasons) return null;
  const renamed = renamedIds(clubsJson);
  const life = lifeSeasons(seasons, row.retireAge);
  const clubs = rnCandidates(
    clubContributions(row.pos, life, (n) => renamed.get(n) ?? DEFAULT_IDS.get(n)),
    rnCut(row.pos, seasonOf(row)),
  );
  return clubs.length ? { number, clubs } : null;
}

/** 결번 시즌 — 커리어가 처음 올라온 시즌(NULL = 시즌 사이 휴식기는 프리시즌으로 센다). */
const seasonOf = (row: Pick<JudgeRow, 'serviceSeason'>) => row.serviceSeason ?? 0;

/** 후보 구단 순서대로 자리를 잡는 문장들. 앞 문장이 자리를 잡으면 뒤 문장은 career_id 유일성에 걸려 아무것도 하지 않는다. */
const claimStatements = (
  db: Db,
  careerId: string,
  season: number,
  c: { number: number; clubs: RnClub[] },
  at: string,
) =>
  c.clubs.map((club) =>
    db
      .insert(retiredNumbers)
      .values({
        season,
        clubId: club.clubId!,
        number: c.number,
        careerId,
        club: club.club,
        score: Math.round(club.score),
        seq: sql`(select coalesce(max(${retiredNumbers.seq}), 0) + 1 from ${retiredNumbers} where ${retiredNumbers.season} = ${season})`,
        grantedAt: at,
      })
      .onConflictDoNothing(),
  );

const clubsJsonOf = async (db: Db, profileIds: string[]) =>
  new Map(
    profileIds.length
      ? (
          await db
            .select({ id: clubCustoms.profileId, json: clubCustoms.clubsJson })
            .from(clubCustoms)
            .where(inArray(clubCustoms.profileId, profileIds))
        ).map((r) => [r.id, r.json])
      : [],
  );

const backfillMeta = (db: Db) =>
  db
    .select({ key: appMeta.key, value: appMeta.value })
    .from(appMeta)
    .where(inArray(appMeta.key, [META_KEY, CURSOR_KEY]));
const backfilled = (meta: { key: string; value: string }[]) =>
  meta.some((r) => r.key === META_KEY && r.value === BACKFILL_VERSION);

/** 기존 공개 은퇴를 은퇴 시각 순서로 한 조각 심사한다. 아직 다 훑지 못했으면 true. */
export async function ensureRetiredNumbersBackfilled(
  db: Db,
  chunk = RESCAN_CHUNK,
): Promise<boolean> {
  const meta = await backfillMeta(db);
  if (backfilled(meta)) return false;
  const m = new Map(meta.map((r) => [r.key, r.value]));
  const [at = '', id = ''] = (m.get(CURSOR_KEY) ?? '').split('\t');
  const rows = await db
    .select(judgeColumns)
    .from(careers)
    .where(
      and(
        isPublicRetired,
        isNotNull(careers.publicName),
        sql`(${careers.retiredAt} > ${at} or (${careers.retiredAt} = ${at} and ${careers.id} > ${id}))`,
      ),
    )
    .orderBy(careers.retiredAt, careers.id)
    .limit(chunk);
  const [customs, seasons] = await Promise.all([
    clubsJsonOf(db, [...new Set(rows.map((r) => r.profileId))]),
    storedSeasonsOf(
      db,
      rows.map((r) => r.id),
    ),
  ]);
  const statements = rows.flatMap((r) => {
    const c = candidatesOf(r, seasons.get(r.id), customs.get(r.profileId));
    return c ? claimStatements(db, r.id, seasonOf(r), c, r.retiredAt!) : [];
  });
  const done = rows.length < chunk;
  const last = rows.at(-1);
  await runBatch(db, [
    ...statements,
    ...(done
      ? [
          setMeta(db, META_KEY, BACKFILL_VERSION),
          db.delete(appMeta).where(eq(appMeta.key, CURSOR_KEY)),
        ]
      : [setMeta(db, CURSOR_KEY, `${last!.retiredAt}\t${last!.id}`)]),
  ]);
  return !done;
}

const slotOf = ({
  clubId,
  club,
  number,
  seq,
}: {
  clubId: string;
  club: string;
  number: number;
  seq: number;
}) => ({
  clubId,
  club,
  number,
  seq,
});

const slotColumns = {
  clubId: retiredNumbers.clubId,
  club: retiredNumbers.club,
  number: retiredNumbers.number,
  seq: retiredNumbers.seq,
};

/**
 * 심사 결과. season은 결번이 속한 시즌(자리를 가졌거나 잡았을 때만 — 지울 목록 캐시의 시즌). claimed는 이번 심사가
 * 막 자리를 잡았을 때만 있다(홈 라이브로 알린다).
 */
type Judged = {
  result: RetiredNumberResult | null;
  season?: number;
  claimed?: LiveRetiredNumber;
};

/** 은퇴 PUT 뒤에 부른다. 자격이 없으면(또는 공개 명예의 전당 밖의 짧은 커리어면) result가 null. */
export async function judgeRetiredNumber(db: Db, careerId: string, now: string): Promise<Judged> {
  const heldBy = () =>
    db
      .select({ ...slotColumns, season: retiredNumbers.season })
      .from(retiredNumbers)
      .where(eq(retiredNumbers.careerId, careerId));
  const [meta, held, [row]] = await db.batch([
    backfillMeta(db),
    heldBy(),
    db
      .select(judgeColumns)
      .from(careers)
      .where(and(eq(careers.id, careerId), isPublicRetired)),
  ]);
  if (!backfilled(meta) && (await ensureRetiredNumbersBackfilled(db))) {
    return { result: { kind: 'pending' } };
  }
  // 이미 가진 자리는 이름을 다시 숨겨도 그대로다.
  if (held[0]) {
    return { result: { kind: 'granted', ...slotOf(held[0]) }, season: held[0].season };
  }
  if (!row) return { result: null };
  const [customs, seasons] = await Promise.all([
    clubsJsonOf(db, [row.profileId]),
    storedSeasonsOf(db, [careerId]),
  ]);
  const c = candidatesOf(row, seasons.get(careerId), customs.get(row.profileId));
  if (!c) return { result: null };
  const best = c.clubs[0]!;
  const season = seasonOf(row);
  const slot = { clubId: best.clubId!, club: best.club, number: c.number };
  if (!row.publicName) return { result: { kind: 'anonymous', ...slot } };
  // 자리 잡기와 결과 확인을 한 번에 보낸다(batch는 한 트랜잭션이라 뒤의 select가 앞의 insert를 본다).
  const results = await runBatch(db, [
    ...claimStatements(db, careerId, season, c, now),
    heldBy(),
    db
      .select({ name: careers.publicName })
      .from(retiredNumbers)
      .innerJoin(careers, eq(careers.id, retiredNumbers.careerId))
      .where(
        and(
          eq(retiredNumbers.season, season),
          eq(retiredNumbers.clubId, slot.clubId),
          eq(retiredNumbers.number, slot.number),
        ),
      ),
  ]);
  const [heldNow] = results.at(-2) as typeof held;
  const [holder] = results.at(-1) as { name: string | null }[];
  if (heldNow) {
    const mine = slotOf(heldNow);
    const claimed = { careerId, name: row.publicName, pos: row.pos, ...mine, season, at: now };
    return { result: { kind: 'granted', ...mine }, season, claimed };
  }
  return { result: { kind: 'taken', ...slot, holder: holder?.name ?? null } };
}

const itemColumns = {
  ...slotColumns,
  grantedAt: retiredNumbers.grantedAt,
  careerId: retiredNumbers.careerId,
  name: careers.publicName,
  pos: careers.pos,
};
const itemsOf = (db: Db) =>
  db
    .select(itemColumns)
    .from(retiredNumbers)
    .innerJoin(careers, eq(careers.id, retiredNumbers.careerId));

/**
 * 한 시즌의 영구결번(결번 순). T-11-101 clubId면 그 구단만, 등번호 순. 벽 첫 화면은 요약(summarizeRetiredNumbers)만 받고,
 * 전체 목록은 결번 심사 결과를 모르는 옛 기록(내 선수)과 아직 업데이트하지 않은 앱이 쓴다.
 */
export async function listRetiredNumbers(
  db: Db,
  season: number,
  clubId?: string,
): Promise<RetiredNumbersResponse> {
  const items = await itemsOf(db)
    .where(
      and(
        eq(retiredNumbers.season, season),
        clubId === undefined ? undefined : eq(retiredNumbers.clubId, clubId),
      ),
    )
    .orderBy(clubId === undefined ? retiredNumbers.seq : retiredNumbers.number);
  return { season, items };
}

/** T-11-101 최신순 한 페이지 — before(0이면 처음)보다 앞선 결번 RETIRED_PAGE개. next는 다음 페이지의 before. */
export async function pageRetiredNumbers(
  db: Db,
  season: number,
  before: number,
): Promise<RetiredNumbersResponse> {
  const rows = await itemsOf(db)
    .where(
      and(
        eq(retiredNumbers.season, season),
        before > 0 ? lt(retiredNumbers.seq, before) : undefined,
      ),
    )
    .orderBy(desc(retiredNumbers.seq))
    .limit(RETIRED_PAGE + 1);
  const items = rows.slice(0, RETIRED_PAGE);
  return { season, items, next: rows.length > RETIRED_PAGE ? items.at(-1)!.seq : null };
}

/** 벽 첫 화면에 보이는 최근 결번 수. */
const RECENT_ON_SUMMARY = 8;

/** T-11-101 벽 첫 화면 — 구단별 결번 수(많은 구단 먼저, 같으면 먼저 결번을 낸 구단)와 최근 결번 몇 개. */
export async function summarizeRetiredNumbers(
  db: Db,
  season: number,
): Promise<RetiredNumbersSummary> {
  const count = sql<number>`count(*)`;
  const [clubs, items] = await db.batch([
    db
      .select({
        clubId: retiredNumbers.clubId,
        club: sql<string>`min(${retiredNumbers.club})`,
        count,
      })
      .from(retiredNumbers)
      .where(eq(retiredNumbers.season, season))
      .groupBy(retiredNumbers.clubId)
      .orderBy(desc(count), asc(sql`min(${retiredNumbers.seq})`)),
    itemsOf(db)
      .where(eq(retiredNumbers.season, season))
      .orderBy(desc(retiredNumbers.seq))
      .limit(RECENT_ON_SUMMARY),
  ]);
  return {
    season,
    total: clubs.reduce((n, c) => n + c.count, 0),
    clubs,
    recent: items,
  };
}
