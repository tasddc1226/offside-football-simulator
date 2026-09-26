import type { ServerFirst } from '@offside/contracts';
import { eq, inArray, sql } from 'drizzle-orm';
import type { Db } from '../client.js';
import { runBatch } from './batch.js';
import { appMeta, careers, careerSeasons, serverFirsts } from '../schema.js';
import { FIRSTS, evaluateCareer, type FirstCareer } from '../../firsts.js';

// T-10-027 서버 최초 기록. 시즌·은퇴 업로드 때 그 커리어만 다시 판정해 "더 이른 달성"이면 자리를 바꾸고,
// 판정 규칙(FIRSTS)이 바뀌거나 처음 배포될 때는 BACKFILL_VERSION을 올려 전체 커리어를 한 번 다시 훑는다.
export const BACKFILL_VERSION = '1';
const META_KEY = 'server_firsts_backfill';

type Claim = { id: string; careerId: string; at: string; year: number | null };

/** earlierOnly면 같은 기록은 시각이 더 이른 쪽만 남긴다(동시 업로드 순서와 상관없이 결과가 같다).
 * 전체 재계산(소급)은 계산 결과가 곧 정본이라 그대로 덮어쓴다. */
function upsertFirst(db: Db, c: Claim, earlierOnly: boolean) {
  const set = { careerId: c.careerId, achievedAt: c.at, year: c.year };
  return db
    .insert(serverFirsts)
    .values({ id: c.id, ...set })
    .onConflictDoUpdate({ target: serverFirsts.id, set, ...(earlierOnly ? { setWhere: sql`excluded.achieved_at < ${serverFirsts.achievedAt}` } : {}) });
}

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

function toCareers(cs: { id: string; legendScore: number | null; retiredAt: string | null }[], rows: SeasonRow[]): FirstCareer[] {
  const by = new Map<string, FirstCareer>(cs.map((c) => [c.id, { ...c, seasons: [] }]));
  for (const r of rows) {
    by.get(r.careerId)?.seasons.push({
      year: r.year, age: r.age, club: r.club, league: r.league, apps: r.apps, goals: r.goals, assists: r.assists,
      cs: r.cs, caps: r.caps, rating: r.rating, ovr: r.ovr, honors: honorsOf(r.honorsJson), mil: r.mil === 1, createdAt: r.createdAt,
    });
  }
  for (const c of by.values()) c.seasons.sort((a, b) => a.year - b.year);
  return [...by.values()];
}

const careerColumns = { id: careers.id, legendScore: careers.legendScore, retiredAt: careers.retiredAt };

/** 한 커리어를 다시 판정해 더 이른 기록이면 반영한다. 바뀐 게 있으면 true(목록 캐시를 지울지 판단용).
 * legendOnly: 은퇴 때는 새로 가능해지는 기록이 레전드 점수뿐이라 시즌을 읽지 않는다. */
export async function recordCareerFirsts(db: Db, careerId: string, { legendOnly = false } = {}): Promise<boolean> {
  const [cs, rows] = legendOnly
    ? [await db.select(careerColumns).from(careers).where(eq(careers.id, careerId)), []]
    : await db.batch([
        db.select(careerColumns).from(careers).where(eq(careers.id, careerId)),
        db.select(seasonColumns).from(careerSeasons).where(eq(careerSeasons.careerId, careerId)),
      ]);
  const [career] = toCareers(cs, rows);
  if (!career) return false;
  const got = evaluateCareer(career);
  if (!got.length) return false;
  const held = await db
    .select({ id: serverFirsts.id, careerId: serverFirsts.careerId, at: serverFirsts.achievedAt })
    .from(serverFirsts)
    .where(inArray(serverFirsts.id, got.map((g) => g.id)));
  const cur = new Map(held.map((h) => [h.id, h]));
  // 이미 이 커리어가 가졌거나 더 이른 기록이 있으면 쓰지 않는다.
  const wins = got.filter((g) => {
    const h = cur.get(g.id);
    return !h || (h.careerId !== careerId && g.at < h.at);
  });
  await runBatch(db, wins.map((g) => upsertFirst(db, { ...g, careerId }, true)));
  return wins.length > 0;
}

/** 기록을 가진 커리어가 지워지면(프로필 삭제) 그 자리는 다음 업로더가 아니라 실제로 가장 이른 달성자에게
 * 가야 한다 — 소급 표시를 지워 다음 목록 조회 때 전체를 다시 계산하게 한다. */
export const resetFirstsBackfillStatement = (db: Db) => db.delete(appMeta).where(eq(appMeta.key, META_KEY));

/** 규칙 버전이 바뀌었으면 모든 커리어를 다시 훑어 채운다(첫 배포 때 이전 기록 소급 포함). */
export async function ensureFirstsBackfilled(db: Db): Promise<void> {
  const [meta] = await db.select({ value: appMeta.value }).from(appMeta).where(eq(appMeta.key, META_KEY));
  if (meta?.value !== BACKFILL_VERSION) await recomputeFirsts(db);
}

/** 모든 커리어를 다시 훑어 최초 기록을 채우고 소급 표시를 남긴다. */
export async function recomputeFirsts(db: Db): Promise<void> {
  const [cs, rows] = await db.batch([db.select(careerColumns).from(careers), db.select(seasonColumns).from(careerSeasons)]);
  const best = new Map<string, Claim>();
  for (const c of toCareers(cs, rows)) {
    for (const g of evaluateCareer(c)) {
      const b = best.get(g.id);
      if (!b || g.at < b.at) best.set(g.id, { ...g, careerId: c.id });
    }
  }
  // 규칙에서 빠졌거나 이제 아무도 채우지 못한 기록은 지운다(재계산 결과가 곧 정본).
  const stale = FIRSTS.map((d) => d.id).filter((id) => !best.has(id));
  await runBatch(db, [
    ...[...best.values()].map((c) => upsertFirst(db, c, false)),
    ...(stale.length ? [db.delete(serverFirsts).where(inArray(serverFirsts.id, stale))] : []),
    db.insert(appMeta).values({ key: META_KEY, value: BACKFILL_VERSION }).onConflictDoUpdate({ target: appMeta.key, set: { value: BACKFILL_VERSION } }),
  ]);
}

/** 공개 목록: 규칙 전체(미달성 포함) + 달성자. 이름은 유저가 공개를 고른 경우에만. */
export async function listFirsts(db: Db): Promise<ServerFirst[]> {
  const rows = await db
    .select({
      id: serverFirsts.id,
      careerId: serverFirsts.careerId,
      achievedAt: serverFirsts.achievedAt,
      name: careers.publicName,
      pos: careers.pos,
      number: careers.shirtNumber,
    })
    .from(serverFirsts)
    .innerJoin(careers, eq(careers.id, serverFirsts.careerId));
  const by = new Map(rows.map((r) => [r.id, r]));
  return FIRSTS.map((d): ServerFirst => {
    const r = by.get(d.id);
    return {
      id: d.id,
      cat: d.cat,
      label: d.label,
      achievedAt: r?.achievedAt ?? null,
      holder: r ? { careerId: r.careerId, name: r.name, pos: r.pos, number: r.number } : null,
    };
  });
}
