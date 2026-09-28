import type { LegendSnapshot } from '@offside/contracts';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import type { Db } from '../client.js';
import { runBatch } from './batch.js';
import { appMeta, careers, careerSeasons, clubCustoms } from '../schema.js';

// T-10-081 T-10-066 이전 기록(구단 id 없이 이름만 남김)의 구단 id를 채운다. 기본 이름은 웹이 이름으로 엠블럼을
// 찾지만(clubByName), 유저가 구단 꾸미기로 바꿔 부른 이름('버밍엄 시티' 등)은 다른 유저 기기에서 어느 구단인지
// 알 수 없어 엠블럼이 빠진다. 그 기록을 올린 유저의 구단 꾸미기(club_customs: 구단 id → 바꾼 이름)로 이름을
// id로 되돌려 careers.last_club_id · career_seasons.club_id · 스냅샷(lastClubId · 시즌 · 우승)에 넣는다.
// 기본 이름은 건드리지 않는다(웹이 이미 찾는다). 여러 구단에 같은 이름을 붙였으면 어느 쪽인지 몰라 비운다.
// 첫 배포 때 한 번 — 공개 명예의 전당 목록 조회마다 CHUNK명씩 나아간다(진행 위치는 app_meta, firsts와 같은 방식).
const VERSION = '1';
const META_KEY = 'club_ids_backfill';
/** 진행 중이면 마지막으로 본 careers rowid. */
const CURSOR_KEY = 'club_ids_backfill_cursor';
/** 스냅샷 JSON을 읽고 다시 쓰므로 Workers 무료 플랜 CPU 안에 들도록 작게. D1 바인딩 한도(100)보다도 작다. */
const CHUNK = 40;

const setMeta = (db: Db, key: string, value: string) =>
  db
    .insert(appMeta)
    .values({ key, value })
    .onConflictDoUpdate({ target: appMeta.key, set: { value } });

/** 유저별 '바꾼 이름 → 구단 id'. 이름만 꺼내 온다(업로드 로고 이미지는 읽지 않는다). 겹치는 이름은 null. */
async function renamedClubs(
  db: Db,
  profileIds: string[],
): Promise<Map<string, Map<string, string | null>>> {
  const out = new Map<string, Map<string, string | null>>();
  if (!profileIds.length) return out;
  const rows = await db.all<{ profileId: string; id: string; name: string | null }>(sql`
    select c.profile_id as profileId, j.key as id, json_extract(j.value, '$.name') as name
    from ${clubCustoms} as c, json_each(c.clubs_json) as j
    where c.profile_id in ${profileIds}`);
  for (const r of rows) {
    const name = r.name?.trim();
    if (!name) continue;
    const m = out.get(r.profileId) ?? new Map<string, string | null>();
    m.set(name, m.has(name) && m.get(name) !== r.id ? null : r.id);
    out.set(r.profileId, m);
  }
  return out;
}

/** 스냅샷의 이름만 있는 구단 칸에 id를 넣는다. 바뀐 게 없으면 null. */
function fillSnapshot(
  s: LegendSnapshot,
  idOf: (name: string) => string | undefined,
): LegendSnapshot | null {
  let changed = false;
  const fill = <T extends { club: string; clubId?: string | undefined }>(row: T): T => {
    const id = row.clubId ? undefined : idOf(row.club);
    if (!id) return row;
    changed = true;
    return { ...row, clubId: id };
  };
  const lastClubId = s.lastClubId ?? idOf(s.lastClub);
  if (lastClubId && !s.lastClubId) changed = true;
  const next = {
    ...s,
    ...(lastClubId ? { lastClubId } : {}),
    career: s.career.map(fill),
    trophies: s.trophies.map(fill),
  };
  return changed ? next : null;
}

/** 채우는 중이면 다음 한 조각을 처리한다. 무언가 했으면 true. */
export async function ensureClubIdsBackfilled(db: Db, chunk = CHUNK): Promise<boolean> {
  const meta = await db
    .select({ key: appMeta.key, value: appMeta.value })
    .from(appMeta)
    .where(inArray(appMeta.key, [META_KEY, CURSOR_KEY]));
  const m = new Map(meta.map((r) => [r.key, r.value]));
  if (m.get(META_KEY) === VERSION) return false;
  const cursor = Number(m.get(CURSOR_KEY) ?? 0);
  const rows = await db
    .select({
      rowid: sql<number>`rowid`,
      id: careers.id,
      profileId: careers.profileId,
      lastClub: careers.lastClub,
      snapshotJson: careers.snapshotJson,
    })
    .from(careers)
    .where(and(sql`rowid > ${cursor}`, isNull(careers.lastClubId)))
    .orderBy(sql`rowid`)
    .limit(chunk);
  const ids = rows.map((r) => r.id);
  const [renamed, seasonClubs] = await Promise.all([
    renamedClubs(db, [...new Set(rows.map((r) => r.profileId))]),
    ids.length
      ? db
          .selectDistinct({ careerId: careerSeasons.careerId, club: careerSeasons.club })
          .from(careerSeasons)
          .where(and(inArray(careerSeasons.careerId, ids), isNull(careerSeasons.clubId)))
      : [],
  ]);
  const statements: BatchItem<'sqlite'>[] = [];
  for (const r of rows) {
    const names = renamed.get(r.profileId);
    if (!names) continue;
    const idOf = (name: string) => names.get(name.trim()) ?? undefined;
    const lastId = r.lastClub ? idOf(r.lastClub) : undefined;
    if (lastId)
      statements.push(db.update(careers).set({ lastClubId: lastId }).where(eq(careers.id, r.id)));
    for (const { club: name } of seasonClubs.filter((sc) => sc.careerId === r.id)) {
      const id = idOf(name);
      if (!id) continue;
      statements.push(
        db
          .update(careerSeasons)
          .set({ clubId: id })
          .where(
            and(
              eq(careerSeasons.careerId, r.id),
              eq(careerSeasons.club, name),
              isNull(careerSeasons.clubId),
            ),
          ),
      );
    }
    const snap = r.snapshotJson
      ? fillSnapshot(JSON.parse(r.snapshotJson) as LegendSnapshot, idOf)
      : null;
    if (snap)
      statements.push(
        db
          .update(careers)
          .set({ snapshotJson: JSON.stringify(snap) })
          .where(eq(careers.id, r.id)),
      );
  }
  const done = rows.length < chunk;
  await runBatch(db, [
    ...statements,
    ...(done
      ? [setMeta(db, META_KEY, VERSION), db.delete(appMeta).where(eq(appMeta.key, CURSOR_KEY))]
      : [setMeta(db, CURSOR_KEY, String(rows[rows.length - 1]!.rowid))]),
  ]);
  return true;
}
