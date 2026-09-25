import type { CareerMeta, CareerSeasonPayload, LegendSnapshot, PublicHofEntry, RetirementSummary } from '@offside/contracts';
import { and, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import type { Db } from '../client.js';
import { runBatch } from './batch.js';
import { careers, careerSeasons } from '../schema.js';

export type CareerRow = typeof careers.$inferSelect;

export async function getCareerOwner(db: Db, careerId: string): Promise<string | undefined> {
  const [row] = await db.select({ profileId: careers.profileId }).from(careers).where(eq(careers.id, careerId));
  return row?.profileId;
}

export type PutCareerSeasonInput = {
  careerId: string;
  profileId: string;
  year: number;
  meta: CareerMeta;
  season: CareerSeasonPayload;
  eventsJson: string;
  now: string;
};

/**
 * `PUT /v1/careers/:careerId/seasons/:year`. `careers` upsert는 `status`를 `set`에서 빼서 이미
 * `retired`인 행을 다시 `active`로 되돌리지 않는다(브리프: "NEVER downgrade retired→active"). 두 upsert를
 * D1 batch(단일 트랜잭션)로 묶어 원자적으로 반영한다. 호출 전 소유권은 라우트가 `getCareerOwner`로
 * 이미 확인했다고 가정한다.
 */
export async function putCareerSeason(db: Db, input: PutCareerSeasonInput): Promise<void> {
  const { careerId, profileId, year, meta, season, eventsJson, now } = input;
  // T-10-006 시즌 상세 — 옛 페이로드엔 없으므로 없으면 NULL(기록 없음)로 둔다.
  const detail = {
    cs: season.cs ?? null,
    lgApps: season.lgApps ?? null,
    lgGoals: season.lgGoals ?? null,
    caps: season.caps ?? null,
    compsJson: season.comps ? JSON.stringify(season.comps) : null,
    chJson: season.ch ? JSON.stringify(season.ch) : null,
  };

  await runBatch(db, [
    db
      .insert(careers)
      .values({
        id: careerId,
        profileId,
        pos: meta.pos,
        foot: meta.foot,
        type: meta.type,
        trait: meta.trait,
        startYear: meta.startYear,
        status: 'active',
        appVersion: meta.appVersion,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: careers.id,
        set: {
          pos: meta.pos,
          foot: meta.foot,
          type: meta.type,
          trait: meta.trait,
          startYear: meta.startYear,
          appVersion: meta.appVersion,
          updatedAt: now,
          // status는 의도적으로 뺀다 — 이미 retired인 커리어가 이 라우트로 다시 active가 되지 않는다.
        },
      }),
    db
      .insert(careerSeasons)
      .values({
        careerId,
        year,
        age: season.age,
        club: season.club,
        league: season.league,
        apps: season.apps,
        goals: season.goals,
        assists: season.assists,
        rating: season.rating,
        rank: String(season.rank),
        ovr: season.ovr,
        honorsJson: JSON.stringify(season.honors),
        mil: season.mil ? 1 : 0,
        eventsJson,
        ...detail,
        createdAt: now,
      })
      .onConflictDoUpdate({
        target: [careerSeasons.careerId, careerSeasons.year],
        set: {
          age: season.age,
          club: season.club,
          league: season.league,
          apps: season.apps,
          goals: season.goals,
          assists: season.assists,
          rating: season.rating,
          rank: String(season.rank),
          ovr: season.ovr,
          honorsJson: JSON.stringify(season.honors),
          mil: season.mil ? 1 : 0,
          eventsJson,
          ...detail,
          // 같은 시즌을 다시 보내면 덮어써 결과는 같다(멱등). createdAt은 최초값을 유지한다.
        },
      }),
  ]);
}

export type PutRetirementInput = {
  careerId: string;
  summary: RetirementSummary;
  /** undefined면 기존 값을 그대로 둔다(옛 클라이언트 본문). null이면 익명으로 되돌린다. */
  publicName?: string | null | undefined;
  snapshot?: LegendSnapshot | undefined;
  now: string;
};

/** `PUT /v1/careers/:careerId/retirement`. 소유권 확인은 라우트가 미리 끝낸다. 같은 커리어로 다시
 * 보내도(이름 공개 토글) 최초 은퇴 시각은 바뀌지 않는다. */
export async function putRetirement(db: Db, input: PutRetirementInput): Promise<void> {
  const { careerId, summary, publicName, snapshot, now } = input;
  await db
    .update(careers)
    .set({
      status: 'retired',
      retiredAt: sql`coalesce(${careers.retiredAt}, ${now})`,
      updatedAt: now,
      retireAge: summary.retireAge,
      peak: summary.peak,
      legendScore: summary.legendScore,
      apps: summary.apps,
      goals: summary.goals,
      assists: summary.assists,
      trophies: summary.trophies,
      awards: summary.awards,
      caps: summary.caps,
      ballon: summary.ballon,
      lastClub: summary.lastClub,
      ...(publicName !== undefined ? { publicName } : {}),
      ...(snapshot ? { snapshotJson: JSON.stringify(snapshot), shirtNumber: snapshot.number } : {}),
    })
    .where(eq(careers.id, careerId));
}

// ───────── T-10-005 공개 명예의 전당 (로그인 불필요 · 읽기 전용) ─────────

const publicColumns = {
  id: careers.id,
  name: careers.publicName,
  pos: careers.pos,
  number: careers.shirtNumber,
  retireAge: careers.retireAge,
  peak: careers.peak,
  legendScore: careers.legendScore,
  apps: careers.apps,
  goals: careers.goals,
  assists: careers.assists,
  trophies: careers.trophies,
  awards: careers.awards,
  caps: careers.caps,
  ballon: careers.ballon,
  lastClub: careers.lastClub,
  retiredAt: careers.retiredAt,
  hasDetail: sql<number>`${careers.snapshotJson} is not null`,
};
type PublicRow = { [K in keyof typeof publicColumns]: unknown };

function toPublicEntry(r: PublicRow): PublicHofEntry {
  const n = (v: unknown) => Number(v ?? 0);
  return {
    id: String(r.id),
    name: (r.name as string | null) ?? null,
    pos: r.pos as PublicHofEntry['pos'],
    number: r.number == null ? null : Number(r.number),
    retireAge: n(r.retireAge),
    peak: n(r.peak),
    legendScore: n(r.legendScore),
    apps: n(r.apps),
    goals: n(r.goals),
    assists: n(r.assists),
    trophies: n(r.trophies),
    awards: n(r.awards),
    caps: n(r.caps),
    ballon: n(r.ballon),
    lastClub: String(r.lastClub ?? ''),
    retiredAt: String(r.retiredAt ?? ''),
    hasDetail: Boolean(r.hasDetail),
  };
}

const isPublicRetired = and(eq(careers.status, 'retired'), isNotNull(careers.legendScore));

/** 전체 유저의 은퇴 선수를 레전드 점수 순으로. */
export async function listPublicHof(db: Db, limit: number): Promise<PublicHofEntry[]> {
  const rows = await db.select(publicColumns).from(careers).where(isPublicRetired).orderBy(desc(careers.legendScore), careers.retiredAt).limit(limit);
  return rows.map(toPublicEntry);
}

export async function getPublicHof(db: Db, careerId: string): Promise<{ entry: PublicHofEntry; snapshot: LegendSnapshot | null } | undefined> {
  const [row] = await db
    .select({ ...publicColumns, snapshotJson: careers.snapshotJson })
    .from(careers)
    .where(and(eq(careers.id, careerId), isPublicRetired));
  if (!row) return undefined;
  const { snapshotJson, ...rest } = row;
  return { entry: toPublicEntry(rest), snapshot: snapshotJson ? (JSON.parse(snapshotJson) as LegendSnapshot) : null };
}

/** T-10-013. 한 프로필의 은퇴 선수(명예의 전당 '내 선수'). */
export async function listOwnHof(db: Db, profileId: string, limit = 100): Promise<PublicHofEntry[]> {
  const rows = await db
    .select(publicColumns)
    .from(careers)
    .where(and(eq(careers.profileId, profileId), isPublicRetired))
    .orderBy(desc(careers.legendScore), careers.retiredAt)
    .limit(limit);
  return rows.map(toPublicEntry);
}

/** T-10-013. 커리어 소유권을 통째로 옮긴다(익명 프로필 → 로그인한 계정). 옮긴 수를 돌려준다. */
export async function moveCareers(db: Db, fromProfileId: string, toProfileId: string): Promise<number> {
  const moved = await db.update(careers).set({ profileId: toProfileId }).where(eq(careers.profileId, fromProfileId)).returning({ id: careers.id });
  return moved.length;
}

/** 프로필 삭제 시 커리어·시즌 데이터를 명시적으로 지운다(소프트 삭제라 FK CASCADE가 트리거되지
 * 않으므로, `executeProfileDeletion`의 batch에 이 두 statement를 함께 넣어 쓴다). */
export function deleteCareersStatements(db: Db, profileId: string) {
  const ownedCareerIds = db.select({ id: careers.id }).from(careers).where(eq(careers.profileId, profileId));
  return [
    db.delete(careerSeasons).where(inArray(careerSeasons.careerId, ownedCareerIds)),
    db.delete(careers).where(eq(careers.profileId, profileId)),
  ] as const;
}

/** 테스트 전용 헬퍼: 특정 커리어의 존재 여부·상태 확인. */
export async function getCareer(db: Db, careerId: string): Promise<CareerRow | undefined> {
  const [row] = await db.select().from(careers).where(eq(careers.id, careerId));
  return row;
}

export async function listCareerSeasons(db: Db, careerId: string) {
  return db.select().from(careerSeasons).where(eq(careerSeasons.careerId, careerId));
}
