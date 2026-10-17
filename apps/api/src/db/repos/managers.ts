// T-11-310 감독 커리어 저장소. 감독 커리어는 기기에서 돌고 서버는 시작값(origin · 시드)과 끝낸 결과(감독 카드)만 가진다.
// 카드는 cards.manager로 감독 분류를 표시한다 — 선발 · 판매 · 방출 · 잠금 쿼리가 이 칸을 본다.
import {
  ManagerOriginSchema,
  ManagerResultSchema,
  type ManagerCareer,
  type ManagerOrigin,
  type ManagerResult,
  type TeamCoach,
} from '@offside/contracts';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Db } from '../client.js';
import { cards, careers, managerCareers } from '../schema.js';
import { newId } from '../ids.js';
import { retryTransientWrite } from '../retry.js';

/** 프로 시즌(병역 · 고교 · 대학 제외) 조건. 클럽 id가 없는 옛 시즌은 리그 이름으로 거른다. */
const PRO_SEASON = `s.mil = 0 AND coalesce(s.club_id, '') NOT LIKE 'hs-%' AND coalesce(s.club_id, '') NOT LIKE 'uni-%'
  AND s.league NOT IN ('고교 리그', 'U리그 (대학)')`; // i18n-ignore 저장값(리그 이름)

/** 감독 시작값의 재료(은퇴 요약 + 시즌 수 · 구단 수). 옛 기록이라 모르는 값은 0 · null. */
export async function managerOriginOf(db: Db, careerId: string): Promise<ManagerOrigin | null> {
  const row = await db.$client
    .prepare(
      `SELECT k.pos, k.dpos, k.peak, k.legend_score legendScore, c.apps, c.trophies, c.caps, c.retire_age retireAge,
              k.nation,
              (SELECT count(*) FROM career_seasons s WHERE s.career_id = k.career_id AND ${PRO_SEASON}) seasons,
              (SELECT count(DISTINCT coalesce(s.club_id, s.club)) FROM career_seasons s
                WHERE s.career_id = k.career_id AND ${PRO_SEASON}) clubs
         FROM cards k LEFT JOIN careers c ON c.id = k.career_id WHERE k.career_id = ?`,
    )
    .bind(careerId)
    .first<Record<string, number | string | null>>();
  if (!row) return null;
  const n = (v: unknown) => (typeof v === 'number' && v > 0 ? Math.round(v) : 0);
  return ManagerOriginSchema.parse({
    pos: row.pos,
    dpos: row.dpos ?? null,
    seasons: n(row.seasons),
    apps: n(row.apps),
    clubs: n(row.clubs),
    trophies: n(row.trophies),
    caps: n(row.caps),
    peak: n(row.peak),
    legendScore: n(row.legendScore),
    retireAge: typeof row.retireAge === 'number' ? row.retireAge : null,
    nation: typeof row.nation === 'string' ? row.nation : null,
  });
}

/** 전향할 카드: 주인 · 감독 여부 · 숨김. */
export async function cardForManager(db: Db, careerId: string) {
  const [row] = await db
    .select({
      ownerId: cards.ownerId,
      manager: cards.manager,
      hidden: sql<number>`coalesce(${careers.hidden}, 0)`,
      cardValue: cards.cardValue,
    })
    .from(cards)
    .leftJoin(careers, eq(careers.id, cards.careerId))
    .where(eq(cards.careerId, careerId));
  return row;
}

/**
 * 감독 커리어 시작. 1) 내 카드 · 아직 감독 아님 · 진행 중 커리어 없음일 때만 행을 넣고 2) 넣었으면 카드를 감독으로 표시하고
 * 3) 열린 판매 등록을 내린다. 한 batch(트랜잭션). 진행 중 커리어가 이미 있으면 유니크 인덱스(active)에 막혀 batch 전체가
 * 되돌아간다 — 부르는 쪽이 'active'로 받는다.
 */
export async function startManagerCareer(
  db: Db,
  r: { profileId: string; careerId: string; seed: number; origin: ManagerOrigin; now: string },
): Promise<string | null> {
  const d1 = db.$client;
  const id = newId('mgr');
  const won = `EXISTS (SELECT 1 FROM manager_careers WHERE id = ?)`;
  // Keep this ID and every statement stable across a response-lost retry.
  const statements = [
    d1
      .prepare(
        `INSERT INTO manager_careers (id, profile_id, career_id, status, seed, origin_json, created_at)
         SELECT ?, ?, ?, 'active', ?, ?, ? WHERE EXISTS
           (SELECT 1 FROM cards WHERE career_id = ? AND owner_id = ? AND manager = 0)`,
      )
      .bind(
        id,
        r.profileId,
        r.careerId,
        r.seed,
        JSON.stringify(r.origin),
        r.now,
        r.careerId,
        r.profileId,
      ),
    d1
      .prepare(`UPDATE cards SET manager = 1, updated_at = ? WHERE career_id = ? AND ${won}`)
      .bind(r.now, r.careerId, id),
    d1
      .prepare(
        `UPDATE market_listings SET status = 'cancelled', closed_at = ?
         WHERE career_id = ? AND status = 'open' AND ${won}`,
      )
      .bind(r.now, r.careerId, id),
    d1
      .prepare('SELECT id FROM manager_careers WHERE id = ? AND profile_id = ? AND career_id = ?')
      .bind(id, r.profileId, r.careerId),
  ];
  const results = await retryTransientWrite(() => d1.batch<{ id: string }>(statements));
  // A replay after commit inserts zero rows because the card is already a manager.
  return results[3]!.results[0]?.id ?? null;
}

const isUnique = (e: unknown) =>
  /UNIQUE constraint failed/i.test(String((e as Error)?.message ?? e));
/** 진행 중 커리어가 이미 있어 막힌 경우인지(D1 UNIQUE 위반). */
export const isActiveConflict = isUnique;

/** 진행 중인 감독 커리어를 포기한다: 행을 지우고 카드를 원래 선수로 되돌린다(선발에는 자동으로 넣지 않는다). */
export async function abandonManagerCareer(
  db: Db,
  r: { id: string; profileId: string; now: string },
): Promise<boolean> {
  const d1 = db.$client;
  const row = await d1
    .prepare(
      `SELECT career_id careerId FROM manager_careers WHERE id = ? AND profile_id = ? AND status = 'active'`,
    )
    .bind(r.id, r.profileId)
    .first<{ careerId: string }>();
  if (!row) return false;
  const results = await d1.batch([
    d1
      .prepare(`DELETE FROM manager_careers WHERE id = ? AND profile_id = ? AND status = 'active'`)
      .bind(r.id, r.profileId),
    d1
      .prepare(
        `UPDATE cards SET manager = 0, updated_at = ?
         WHERE career_id = ? AND NOT EXISTS (SELECT 1 FROM manager_careers WHERE career_id = ?)`,
      )
      .bind(r.now, row.careerId, row.careerId),
  ]);
  return results[0]!.meta.changes === 1;
}

/** 감독 커리어를 끝낸다(결과를 적는다). 진행 중인 내 커리어일 때만. 바꿨으면 true. */
export async function finishManagerCareer(
  db: Db,
  r: { id: string; profileId: string; result: ManagerResult; season: number; now: string },
): Promise<boolean> {
  const res = await db
    .update(managerCareers)
    .set({
      status: 'done',
      resultJson: JSON.stringify(r.result),
      serviceSeason: r.season,
      finishedAt: r.now,
    })
    .where(
      and(
        eq(managerCareers.id, r.id),
        eq(managerCareers.profileId, r.profileId),
        eq(managerCareers.status, 'active'),
      ),
    )
    .returning({ id: managerCareers.id });
  return res.length === 1;
}

/** 목록 상한(감독 카드는 한 사람이 많이 만들지 않는다). */
export const MANAGERS_LIMIT = 200;

const rowCols = {
  id: managerCareers.id,
  careerId: managerCareers.careerId,
  status: managerCareers.status,
  seed: managerCareers.seed,
  originJson: managerCareers.originJson,
  resultJson: managerCareers.resultJson,
  createdAt: managerCareers.createdAt,
  finishedAt: managerCareers.finishedAt,
  publicName: careers.publicName,
  number: cards.number,
  look: careers.look,
  pos: cards.pos,
};
type Row = {
  id: string;
  careerId: string;
  status: 'active' | 'done';
  seed: number;
  originJson: string;
  resultJson: string | null;
  createdAt: string;
  finishedAt: string | null;
  publicName: string | null;
  number: number | null;
  look: string | null;
  pos: string;
};

const parseJson = (s: string | null): unknown => {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};
const resultOf = (s: string | null): ManagerResult | null => {
  const r = ManagerResultSchema.safeParse(parseJson(s));
  return r.success ? r.data : null;
};

function toCareer(r: Row): ManagerCareer {
  return {
    id: r.id,
    careerId: r.careerId,
    status: r.status,
    seed: r.seed,
    origin: ManagerOriginSchema.parse(parseJson(r.originJson)),
    result: resultOf(r.resultJson),
    publicName: r.publicName,
    number: r.number,
    ...(r.look ? { look: r.look } : {}),
    startedAt: r.createdAt,
    finishedAt: r.finishedAt,
  };
}

/** 내 감독 커리어(진행 중 하나 + 끝낸 감독 카드, 최근 순). */
export async function listManagers(db: Db, profileId: string) {
  const rows = (await db
    .select(rowCols)
    .from(managerCareers)
    .innerJoin(cards, eq(cards.careerId, managerCareers.careerId))
    .leftJoin(careers, eq(careers.id, managerCareers.careerId))
    .where(eq(managerCareers.profileId, profileId))
    .orderBy(desc(managerCareers.createdAt))
    .limit(MANAGERS_LIMIT + 1)) as Row[];
  const list = rows.map(toCareer);
  return {
    active: list.find((m) => m.status === 'active') ?? null,
    managers: list.filter((m) => m.status === 'done' && m.result),
  };
}

/** 감독 커리어 한 건(내 것만). */
export async function managerCareerOf(db: Db, id: string, profileId: string) {
  const [row] = (await db
    .select(rowCols)
    .from(managerCareers)
    .innerJoin(cards, eq(cards.careerId, managerCareers.careerId))
    .leftJoin(careers, eq(careers.id, managerCareers.careerId))
    .where(and(eq(managerCareers.id, id), eq(managerCareers.profileId, profileId)))) as Row[];
  return row ? toCareer(row) : null;
}

/**
 * 감독 칸에 그릴 감독(끝낸 커리어만). 팀 화면 · 경기에서 두 팀 감독을 한 번에 읽는다. ownerOf를 주면 그 구단주의 감독만
 * 돌려준다(감독 카드는 거래되지 않아 끝낸 사람 = 가진 사람이다).
 */
export async function coachesByIds(
  db: Db,
  ids: readonly (string | null | undefined)[],
): Promise<Map<string, TeamCoach & { profileId: string }>> {
  const want = [...new Set(ids.filter((x): x is string => !!x))];
  const out = new Map<string, TeamCoach & { profileId: string }>();
  if (!want.length) return out;
  const rows = await db
    .select({ ...rowCols, profileId: managerCareers.profileId })
    .from(managerCareers)
    .innerJoin(cards, eq(cards.careerId, managerCareers.careerId))
    .leftJoin(careers, eq(careers.id, managerCareers.careerId))
    .where(and(inArray(managerCareers.careerId, want), eq(managerCareers.status, 'done')));
  for (const r of rows as (Row & { profileId: string })[]) {
    const res = resultOf(r.resultJson);
    if (!res) continue;
    out.set(r.careerId, {
      profileId: r.profileId,
      careerId: r.careerId,
      publicName: r.publicName,
      number: r.number,
      pos: r.pos as TeamCoach['pos'],
      ...(r.look ? { look: r.look } : {}),
      mastery: res.mastery,
      style: res.style,
      specials: res.specials,
      grade: res.grade,
      ending: res.ending,
    });
  }
  return out;
}

/** T-11-310 감독 업적 재료: 그 시즌에 끝낸 내 감독 결과. */
export async function seasonManagersOf(db: Db, profileId: string, season: number) {
  const rows = await db
    .select({ resultJson: managerCareers.resultJson, finishedAt: managerCareers.finishedAt })
    .from(managerCareers)
    .where(
      and(
        eq(managerCareers.profileId, profileId),
        eq(managerCareers.status, 'done'),
        eq(managerCareers.serviceSeason, season),
      ),
    )
    .limit(MANAGERS_LIMIT);
  return rows.flatMap((r) => {
    const res = resultOf(r.resultJson);
    return res ? [{ ...res, finishedAt: r.finishedAt! }] : [];
  });
}

/** T-11-310 · T-11-335 팀 감독 칸에 든 그 구단주의 감독(끝낸 감독만, 없거나 남의 카드면 null). 내 팀 · 남의 팀 프로필이 같이 쓴다. */
export async function teamCoachOf(
  db: Db,
  row: { coachId: string | null; profileId: string },
): Promise<TeamCoach | null> {
  if (!row.coachId) return null;
  const c = (await coachesByIds(db, [row.coachId])).get(row.coachId);
  if (!c) return null;
  const { profileId, ...coach } = c;
  return profileId === row.profileId ? coach : null;
}
