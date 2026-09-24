import type { CareerMeta, CareerSeasonPayload, RetirementSummary } from '@offside/contracts';
import { and, eq, inArray } from 'drizzle-orm';
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
          // 같은 시즌을 다시 보내면 덮어써 결과는 같다(멱등). createdAt은 최초값을 유지한다.
        },
      }),
  ]);
}

export type PutRetirementInput = {
  careerId: string;
  summary: RetirementSummary;
  now: string;
};

/** `PUT /v1/careers/:careerId/retirement`. 소유권 확인은 라우트가 미리 끝낸다. */
export async function putRetirement(db: Db, input: PutRetirementInput): Promise<void> {
  const { careerId, summary, now } = input;
  await db
    .update(careers)
    .set({
      status: 'retired',
      retiredAt: now,
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
    })
    .where(eq(careers.id, careerId));
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
  return db.select().from(careerSeasons).where(and(eq(careerSeasons.careerId, careerId)));
}
