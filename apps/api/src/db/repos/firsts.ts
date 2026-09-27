import type { FirstsResponse } from '@offside/contracts';
import { eq, inArray, sql } from 'drizzle-orm';
import type { Db } from '../client.js';
import { runBatch } from './batch.js';
import { appMeta, careers, careerSeasons, serverFirsts, serverRecords } from '../schema.js';
import {
  RECORDS,
  evaluateCareer,
  evaluateRecords,
  firstsCatalog,
  type FirstCareer,
} from '../../firsts.js';

// T-10-027 서버 최초 기록 · T-10-056 서버 기록. 시즌·은퇴 업로드 때 그 커리어만 다시 판정해 "더 이른 달성"이면
// 최초 기록 자리를, "더 큰 값"이면 서버 기록 자리를 바꾼다. 판정 규칙이 바뀌거나 처음 배포될 때, 또는 기록을
// 가진 커리어가 지워졌을 때는 전체 커리어를 다시 훑는다 — 한 요청에 다 읽으면 Workers 무료 플랜 CPU(10ms)를
// 넘으므로 RESCAN_CHUNK명씩 나눠 공개 목록 조회 때마다 한 조각씩 진행한다(진행 위치는 app_meta).
export const BACKFILL_VERSION = '2';
const META_KEY = 'server_firsts_backfill';
/** 다시 훑는 중이면 마지막으로 판정한 careers rowid. */
const CURSOR_KEY = 'server_firsts_cursor';
const RESCAN_CHUNK = 150;
/** D1 바인딩 변수 한도(100) 아래로 IN 목록을 나눈다. */
const IN_CHUNK = 90;

type Claim = { id: string; careerId: string; at: string; year: number | null };
type RecordClaim = Claim & { value: number };

/** 같은 기록은 시각이 더 이른 쪽만 남긴다(동시 업로드·재계산 순서와 상관없이 결과가 같다). */
function upsertFirst(db: Db, c: Claim) {
  const set = { careerId: c.careerId, achievedAt: c.at, year: c.year };
  return db
    .insert(serverFirsts)
    .values({ id: c.id, ...set })
    .onConflictDoUpdate({
      target: serverFirsts.id,
      set,
      setWhere: sql`excluded.achieved_at < ${serverFirsts.achievedAt}`,
    });
}

/** 서버 기록은 더 큰 값만 자리를 바꾼다(같은 값이면 먼저 세운 쪽이 지킨다). */
function upsertRecord(db: Db, r: RecordClaim) {
  const set = { careerId: r.careerId, value: r.value, achievedAt: r.at, year: r.year };
  return db
    .insert(serverRecords)
    .values({ id: r.id, ...set })
    .onConflictDoUpdate({
      target: serverRecords.id,
      set,
      setWhere: sql`excluded.value > ${serverRecords.value}`,
    });
}

const chunks = <T>(xs: T[], n = IN_CHUNK): T[][] =>
  Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

const seasonColumns = {
  careerId: careerSeasons.careerId,
  year: careerSeasons.year,
  age: careerSeasons.age,
  club: careerSeasons.club,
  league: careerSeasons.league,
  apps: careerSeasons.apps,
  goals: careerSeasons.goals,
  assists: careerSeasons.assists,
  cs: careerSeasons.cs,
  caps: careerSeasons.caps,
  rating: careerSeasons.rating,
  ovr: careerSeasons.ovr,
  honorsJson: careerSeasons.honorsJson,
  mil: careerSeasons.mil,
  createdAt: careerSeasons.createdAt,
};
type SeasonRow = Pick<typeof careerSeasons.$inferSelect, keyof typeof seasonColumns>;

export function honorsOf(json: string): string[] {
  try {
    const v: unknown = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function toCareers(
  cs: { id: string; legendScore: number | null; retiredAt: string | null }[],
  rows: SeasonRow[],
): FirstCareer[] {
  const by = new Map<string, FirstCareer>(cs.map((c) => [c.id, { ...c, seasons: [] }]));
  for (const r of rows) {
    by.get(r.careerId)?.seasons.push({
      year: r.year,
      age: r.age,
      club: r.club,
      league: r.league,
      apps: r.apps,
      goals: r.goals,
      assists: r.assists,
      cs: r.cs,
      caps: r.caps,
      rating: r.rating,
      ovr: r.ovr,
      honors: honorsOf(r.honorsJson),
      mil: r.mil === 1,
      createdAt: r.createdAt,
    });
  }
  for (const c of by.values()) c.seasons.sort((a, b) => a.year - b.year);
  return [...by.values()];
}

const careerColumns = {
  id: careers.id,
  legendScore: careers.legendScore,
  retiredAt: careers.retiredAt,
};

/** 여러 커리어를 판정해, 지금 가진 기록보다 나은 것만 쓰는 문장들. */
async function claimStatements(db: Db, list: FirstCareer[]) {
  const firsts = new Map<string, Claim>();
  const records = new Map<string, RecordClaim>();
  for (const c of list) {
    for (const g of evaluateCareer(c)) {
      const b = firsts.get(g.id);
      if (!b || g.at < b.at) firsts.set(g.id, { ...g, careerId: c.id });
    }
    for (const r of evaluateRecords(c)) {
      const b = records.get(r.id);
      if (!b || r.value > b.value) records.set(r.id, { ...r, careerId: c.id });
    }
  }
  if (!firsts.size && !records.size) return [];
  const [heldRecords, ...heldFirsts] = await db.batch([
    db.select({ id: serverRecords.id, value: serverRecords.value }).from(serverRecords),
    ...chunks([...firsts.keys()]).map((ids) =>
      db
        .select({
          id: serverFirsts.id,
          careerId: serverFirsts.careerId,
          at: serverFirsts.achievedAt,
        })
        .from(serverFirsts)
        .where(inArray(serverFirsts.id, ids)),
    ),
  ]);
  const cur = new Map(heldFirsts.flat().map((h) => [h.id, h]));
  const top = new Map(heldRecords.map((r) => [r.id, r.value]));
  // 이미 이 커리어가 가졌거나 더 이른 기록이 있으면 쓰지 않는다.
  const wins = [...firsts.values()].filter((g) => {
    const h = cur.get(g.id);
    return !h || (h.careerId !== g.careerId && g.at < h.at);
  });
  const broken = [...records.values()].filter((r) => r.value > (top.get(r.id) ?? 0));
  return [...wins.map((g) => upsertFirst(db, g)), ...broken.map((r) => upsertRecord(db, r))];
}

/** 한 커리어를 다시 판정해 더 나은 기록이면 반영한다. 바뀐 게 있으면 true(목록 캐시를 지울지 판단용).
 * legendOnly: 은퇴 때는 새로 가능해지는 기록이 레전드 점수뿐이라 시즌을 읽지 않는다. */
export async function recordCareerFirsts(
  db: Db,
  careerId: string,
  { legendOnly = false } = {},
): Promise<boolean> {
  const [cs, rows] = legendOnly
    ? [await db.select(careerColumns).from(careers).where(eq(careers.id, careerId)), []]
    : await db.batch([
        db.select(careerColumns).from(careers).where(eq(careers.id, careerId)),
        db.select(seasonColumns).from(careerSeasons).where(eq(careerSeasons.careerId, careerId)),
      ]);
  const [career] = toCareers(cs, rows);
  if (!career) return false;
  const statements = await claimStatements(db, [career]);
  await runBatch(db, statements);
  return statements.length > 0;
}

/** 기록을 가진 커리어가 지워지면(프로필 삭제) 그 자리는 다음 업로더가 아니라 실제로 가장 이른 달성자(서버
 * 기록은 그다음 최고값)에게 가야 한다 — 재계산 표시를 지워 공개 목록 조회가 전체를 다시 훑게 한다. */
export const resetFirstsBackfillStatement = (db: Db) =>
  db.delete(appMeta).where(inArray(appMeta.key, [META_KEY, CURSOR_KEY]));

const setMeta = (db: Db, key: string, value: string) =>
  db
    .insert(appMeta)
    .values({ key, value })
    .onConflictDoUpdate({ target: appMeta.key, set: { value } });

/** 다시 훑는 중이면 다음 한 조각(chunk명)을 판정한다. 무언가 했으면 true. */
export async function ensureFirstsBackfilled(db: Db, chunk = RESCAN_CHUNK): Promise<boolean> {
  const meta = await db
    .select({ key: appMeta.key, value: appMeta.value })
    .from(appMeta)
    .where(inArray(appMeta.key, [META_KEY, CURSOR_KEY]));
  const m = new Map(meta.map((r) => [r.key, r.value]));
  if (m.get(META_KEY) === BACKFILL_VERSION) return false;
  const cursor = Number(m.get(CURSOR_KEY) ?? 0);
  const [cs, rows] = await db.batch([
    db
      .select({ ...careerColumns, rowid: sql<number>`rowid` })
      .from(careers)
      .where(sql`rowid > ${cursor}`)
      .orderBy(sql`rowid`)
      .limit(chunk),
    db
      .select(seasonColumns)
      .from(careerSeasons)
      .where(
        sql`${careerSeasons.careerId} in (select id from careers where rowid > ${cursor} order by rowid limit ${chunk})`,
      ),
  ]);
  const statements = await claimStatements(db, toCareers(cs, rows));
  const done = cs.length < chunk;
  await runBatch(db, [
    ...statements,
    ...(done
      ? [
          setMeta(db, META_KEY, BACKFILL_VERSION),
          db.delete(appMeta).where(eq(appMeta.key, CURSOR_KEY)),
        ]
      : [setMeta(db, CURSOR_KEY, String(cs[cs.length - 1]!.rowid))]),
  ]);
  return true;
}

/** 공개 목록: 규칙 전체(미달성 포함, 끝없는 단계는 다음 목표까지) + 서버 기록. 이름은 유저가 공개를 고른 경우에만. */
export async function listFirsts(db: Db): Promise<FirstsResponse> {
  const holder = { name: careers.publicName, pos: careers.pos, number: careers.shirtNumber };
  const [firstRows, recordRows] = await db.batch([
    db
      .select({
        id: serverFirsts.id,
        careerId: serverFirsts.careerId,
        achievedAt: serverFirsts.achievedAt,
        ...holder,
      })
      .from(serverFirsts)
      .innerJoin(careers, eq(careers.id, serverFirsts.careerId)),
    db
      .select({
        id: serverRecords.id,
        careerId: serverRecords.careerId,
        achievedAt: serverRecords.achievedAt,
        value: serverRecords.value,
        ...holder,
      })
      .from(serverRecords)
      .innerJoin(careers, eq(careers.id, serverRecords.careerId)),
  ]);
  const holderOf = (r: (typeof firstRows)[number]) => ({
    careerId: r.careerId,
    name: r.name,
    pos: r.pos,
    number: r.number,
  });
  const firsts = new Map(firstRows.map((r) => [r.id, r]));
  const records = new Map(recordRows.map((r) => [r.id, r]));
  return {
    items: firstsCatalog(firsts.keys()).map((d) => {
      const r = firsts.get(d.id);
      return {
        id: d.id,
        cat: d.cat,
        label: d.label,
        achievedAt: r?.achievedAt ?? null,
        holder: r ? holderOf(r) : null,
      };
    }),
    records: RECORDS.map((d) => {
      const r = records.get(d.id);
      return {
        id: d.id,
        label: d.label,
        unit: d.unit,
        value: r?.value ?? null,
        achievedAt: r?.achievedAt ?? null,
        holder: r ? holderOf(r) : null,
      };
    }),
  };
}
