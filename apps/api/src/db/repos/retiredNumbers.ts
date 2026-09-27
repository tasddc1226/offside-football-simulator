import type {
  LegendSnapshot,
  RetiredNumberResult,
  RetiredNumbersResponse,
} from '@offside/contracts';
import { defaultClubIds } from '@offside/contracts/club-names';
import { clubContributions, rnCandidates, type RnClub } from '@offside/contracts/retired-numbers';
import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import type { Db } from '../client.js';
import { runBatch } from './batch.js';
import { isPublicRetired } from './careers.js';
import { appMeta, careers, clubCustoms, retiredNumbers } from '../schema.js';

// T-10-076 영구결번. 은퇴 PUT(이름 공개 토글 재전송 포함) 때 그 커리어를 심사해, 자격이 있고 이름을 공개했으면
// 가장 큰 기여 구단의 그 등번호를 잡는다 — 이미 찼으면 두 번째 구단(자격이 있을 때만). 자리는 먼저 자격을 채운
// 커리어가 가져가고(INSERT … ON CONFLICT DO NOTHING) 취소되지 않는다. 판정 규칙은 @offside/contracts/retired-numbers.
// 처음 배포될 때는 기존 공개 은퇴 기록을 은퇴 시각 순서로 한 번 훑어 결번을 채운다(서버 최초 기록처럼 RESCAN_CHUNK명씩,
// 진행 위치는 app_meta). 다 훑기 전의 은퇴 PUT은 한 조각을 진행시키고 pending을 돌려준다 — 은퇴 시각이 더 늦은 새
// 은퇴가 옛 은퇴보다 먼저 자리를 잡지 않게.
export const BACKFILL_VERSION = '1';
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
  snapshotJson: careers.snapshotJson,
  retiredAt: careers.retiredAt,
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

/** 결번을 노릴 구단(0–2개)과 등번호. 스냅샷이 없거나 번호가 없으면 null. */
function candidatesOf(
  row: JudgeRow,
  clubsJson: string | undefined,
): { number: number; clubs: RnClub[] } | null {
  if (!row.snapshotJson) return null;
  let snap: LegendSnapshot;
  try {
    snap = JSON.parse(row.snapshotJson) as LegendSnapshot;
  } catch {
    return null;
  }
  if (!(snap.number >= 1)) return null;
  const renamed = renamedIds(clubsJson);
  const clubs = rnCandidates(
    clubContributions(row.pos, snap.career, (n) => renamed.get(n) ?? DEFAULT_IDS.get(n)),
  );
  return clubs.length ? { number: snap.number, clubs } : null;
}

/** 후보 구단 순서대로 자리를 잡는 문장들. 앞 문장이 자리를 잡으면 뒤 문장은 career_id 유일성에 걸려 아무것도 하지 않는다. */
const claimStatements = (
  db: Db,
  careerId: string,
  c: { number: number; clubs: RnClub[] },
  at: string,
) =>
  c.clubs.map((club) =>
    db
      .insert(retiredNumbers)
      .values({
        clubId: club.clubId!,
        number: c.number,
        careerId,
        club: club.club,
        score: Math.round(club.score),
        seq: sql`(select coalesce(max(${retiredNumbers.seq}), 0) + 1 from ${retiredNumbers})`,
        grantedAt: at,
      })
      .onConflictDoNothing(),
  );

const setMeta = (db: Db, key: string, value: string) =>
  db
    .insert(appMeta)
    .values({ key, value })
    .onConflictDoUpdate({ target: appMeta.key, set: { value } });

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

/** 기존 공개 은퇴를 은퇴 시각 순서로 한 조각 심사한다. 아직 다 훑지 못했으면 true. */
export async function ensureRetiredNumbersBackfilled(
  db: Db,
  chunk = RESCAN_CHUNK,
): Promise<boolean> {
  const meta = await db
    .select({ key: appMeta.key, value: appMeta.value })
    .from(appMeta)
    .where(inArray(appMeta.key, [META_KEY, CURSOR_KEY]));
  const m = new Map(meta.map((r) => [r.key, r.value]));
  if (m.get(META_KEY) === BACKFILL_VERSION) return false;
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
  const customs = await clubsJsonOf(db, [...new Set(rows.map((r) => r.profileId))]);
  const statements = rows.flatMap((r) => {
    const c = candidatesOf(r, customs.get(r.profileId));
    return c ? claimStatements(db, r.id, c, r.retiredAt!) : [];
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

const slotColumns = {
  clubId: retiredNumbers.clubId,
  club: retiredNumbers.club,
  number: retiredNumbers.number,
  seq: retiredNumbers.seq,
  score: retiredNumbers.score,
};

/** 은퇴 PUT 뒤에 부른다. 자격이 없으면(또는 공개 명예의 전당 밖의 짧은 커리어면) null. */
export async function judgeRetiredNumber(
  db: Db,
  careerId: string,
  now: string,
): Promise<RetiredNumberResult | null> {
  if (await ensureRetiredNumbersBackfilled(db)) return { kind: 'pending' };
  const [held, [row]] = await db.batch([
    db.select(slotColumns).from(retiredNumbers).where(eq(retiredNumbers.careerId, careerId)),
    db
      .select(judgeColumns)
      .from(careers)
      .where(and(eq(careers.id, careerId), isPublicRetired)),
  ]);
  // 이미 가진 자리는 이름을 다시 숨겨도 그대로다.
  if (held[0]) return { kind: 'granted', ...held[0] };
  if (!row) return null;
  const customs = await clubsJsonOf(db, [row.profileId]);
  const c = candidatesOf(row, customs.get(row.profileId));
  if (!c) return null;
  const best = c.clubs[0]!;
  const slot = { clubId: best.clubId!, club: best.club, number: c.number };
  const score = Math.round(best.score);
  if (!row.publicName) return { kind: 'anonymous', ...slot, score };
  await runBatch(db, claimStatements(db, careerId, c, now));
  const [[mine], [holder]] = await db.batch([
    db.select(slotColumns).from(retiredNumbers).where(eq(retiredNumbers.careerId, careerId)),
    db
      .select({ name: careers.publicName })
      .from(retiredNumbers)
      .innerJoin(careers, eq(careers.id, retiredNumbers.careerId))
      .where(and(eq(retiredNumbers.clubId, slot.clubId), eq(retiredNumbers.number, slot.number))),
  ]);
  if (mine) return { kind: 'granted', ...mine };
  return { kind: 'taken', ...slot, holder: holder?.name ?? null, score };
}

/** 서버 전체 영구결번(결번 순). */
export async function listRetiredNumbers(db: Db): Promise<RetiredNumbersResponse> {
  const items = await db
    .select({
      ...slotColumns,
      grantedAt: retiredNumbers.grantedAt,
      careerId: retiredNumbers.careerId,
      name: careers.publicName,
      pos: careers.pos,
    })
    .from(retiredNumbers)
    .innerJoin(careers, eq(careers.id, retiredNumbers.careerId))
    .orderBy(retiredNumbers.seq);
  return { items };
}
