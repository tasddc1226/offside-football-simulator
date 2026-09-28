import type {
  CareerMeta,
  CareerSeasonPayload,
  HofSort,
  LegendSnapshot,
  PublicHofEntry,
  RetirementSummary,
} from '@offside/contracts';
import { HOF_MIN_RETIRE_AGE } from '@offside/contracts/hof-rules';
import type { ServiceSeason } from '@offside/contracts/service-seasons';
import { DETAIL_GROUP } from '@offside/contracts/positions';
import {
  and,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  sql,
  type AnyColumn,
  type SQL,
} from 'drizzle-orm';
import type { Db } from '../client.js';
import { runBatch } from './batch.js';
import { kstDays } from './admin.js';
import { honorsOf } from './firsts.js';
import { appMeta, careers, careerSeasons, goalsPlusAssists, retiredNumbers } from '../schema.js';

export type CareerRow = typeof careers.$inferSelect;

export async function getCareerOwner(db: Db, careerId: string): Promise<string | undefined> {
  const [row] = await db
    .select({ profileId: careers.profileId })
    .from(careers)
    .where(eq(careers.id, careerId));
  return row?.profileId;
}

export type PutCareerSeasonInput = {
  careerId: string;
  profileId: string;
  year: number;
  meta: CareerMeta;
  season: CareerSeasonPayload;
  eventsJson: string;
  /** T-10-065 공개 이름. undefined(옛 클라이언트)면 그대로 둔다. */
  publicName?: string | null | undefined;
  /** 자동 플레이 탐지용 조작 요약(JSON). undefined(옛 클라이언트·다시 보낸 기록)면 그대로 둔다. */
  signalsJson?: string | undefined;
  now: string;
};

/**
 * `PUT /v1/careers/:careerId/seasons/:year`. `careers` upsert는 `status`를 `set`에서 빼서 이미
 * `retired`인 행을 다시 `active`로 되돌리지 않는다(브리프: "NEVER downgrade retired→active"). 두 upsert를
 * D1 batch(단일 트랜잭션)로 묶어 원자적으로 반영한다. 호출 전 소유권은 라우트가 `getCareerOwner`로
 * 이미 확인했다고 가정한다.
 */
export async function putCareerSeason(db: Db, input: PutCareerSeasonInput): Promise<void> {
  const { careerId, profileId, year, meta, season, eventsJson, publicName, signalsJson, now } =
    input;
  const signals = signalsJson !== undefined ? { signalsJson } : {};
  const name = publicName !== undefined ? { publicName } : {};
  // 은퇴한 커리어의 공개 이름은 은퇴 PUT(명예의 전당 토글)만 바꾼다 — 늦게 도착한 시즌 업로드가 되돌리지 않게.
  const keepRetiredName =
    publicName !== undefined
      ? {
          publicName: sql`case when ${careers.status} = 'retired' then ${careers.publicName} else ${publicName} end`,
        }
      : {};
  // T-10-006 시즌 상세 — 옛 페이로드엔 없으므로 없으면 NULL(기록 없음)로 둔다.
  const detail = {
    cs: season.cs ?? null,
    lgApps: season.lgApps ?? null,
    lgGoals: season.lgGoals ?? null,
    caps: season.caps ?? null,
    clubId: season.clubId ?? null,
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
        dpos: meta.dpos && DETAIL_GROUP[meta.dpos] === meta.pos ? meta.dpos : null,
        foot: meta.foot,
        type: meta.type,
        trait: meta.trait,
        startYear: meta.startYear,
        status: 'active',
        appVersion: meta.appVersion,
        ...name,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: careers.id,
        set: {
          // 포지션·주발·유형·특성·시작 연도는 커리어를 만들 때 정해져 바뀌지 않는다 — 처음 값을 지킨다(뒤늦게
          // 포지션을 바꿔 레전드 점수·결번 가중을 고르지 못하게).
          appVersion: meta.appVersion,
          ...keepRetiredName,
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
        ...signals,
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
          ...signals,
          // 같은 시즌을 다시 보내면 덮어써 결과는 같다(멱등). createdAt은 최초값을 유지한다.
        },
        // 은퇴한 커리어의 시즌은 고치지 않는다(은퇴 요약·결번 판정의 근거). 늦게 도착한 빠진 시즌은 새 행이라 들어간다.
        setWhere: sql`(select ${careers.status} from ${careers} where ${careers.id} = ${careerId}) <> 'retired'`,
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

/**
 * 한국 시각 날짜별 은퇴 수를 담는 app_meta 키. 홈 라이브 현황이 오늘 은퇴 수를 count(*)로 세면 오늘 은퇴한
 * 커리어 수만큼 행을 읽으므로(T-10-055), 은퇴할 때 이 키를 1 올리고 현황은 한 행만 읽는다. 프로필 삭제로
 * 커리어가 지워져도 빼지 않는다(홈 현황 숫자라 허용).
 */
export const retiredCountKey = (at: Date) => `retired:${kstDays(at, 1).days[0]}`;

/** `PUT /v1/careers/:careerId/retirement`의 첫 은퇴. 소유권 확인과 요약 보정(plausibility.ts)은 라우트가 미리
 * 끝낸다. 다시 보낸 은퇴(이름 공개 토글·대표 칭호)는 `updateRetired`로 간다. */
export async function putRetirement(db: Db, input: PutRetirementInput): Promise<void> {
  const { careerId, summary, publicName, snapshot, now } = input;
  await runBatch(db, [
    // 처음 은퇴할 때만 센다 — 같은 커리어의 첫 은퇴가 동시에 두 번 와도 retired_at이 이미 있으면 아무 행도 넣지
    // 않는다. 같은 트랜잭션에서 아래 update보다 먼저 돌아야 retired_at이 비어 있는 것을 본다.
    db
      .insert(appMeta)
      .select(
        db
          .select({
            key: sql<string>`${retiredCountKey(new Date(now))}`.as('key'),
            value: sql<string>`'1'`.as('value'),
          })
          .from(careers)
          .where(and(eq(careers.id, careerId), isNull(careers.retiredAt))),
      )
      .onConflictDoUpdate({
        target: appMeta.key,
        set: { value: sql`cast(${appMeta.value} as integer) + 1` },
      }),
    db
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
        // 옛 클라이언트는 칭호·클럽 id를 보내지 않는다 — 보낸 경우에만 쓴다.
        ...(summary.title !== undefined ? { title: summary.title } : {}),
        ...(summary.lastClubId !== undefined ? { lastClubId: summary.lastClubId } : {}),
        ...(publicName !== undefined ? { publicName } : {}),
        ...(snapshot
          ? { snapshotJson: JSON.stringify(snapshot), shirtNumber: snapshot.number }
          : {}),
      })
      .where(eq(careers.id, careerId)),
  ]);
}

// ───────── T-10-005 공개 명예의 전당 (로그인 불필요 · 읽기 전용) ─────────

const publicColumns = {
  id: careers.id,
  name: careers.publicName,
  pos: careers.pos,
  dpos: careers.dpos,
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
  lastClubId: careers.lastClubId,
  retiredAt: careers.retiredAt,
  hasDetail: sql<number>`${careers.snapshotJson} is not null`,
  title: careers.title,
  // T-10-076 영구결번(retired_numbers를 left join한 쿼리에서만 쓴다).
  rnClubId: retiredNumbers.clubId,
  rnClub: retiredNumbers.club,
  rnNumber: retiredNumbers.number,
  rnSeq: retiredNumbers.seq,
};
type PublicRow = { [K in keyof typeof publicColumns]: unknown };

function toPublicEntry(r: PublicRow): PublicHofEntry {
  const n = (v: unknown) => Number(v ?? 0);
  return {
    id: String(r.id),
    name: (r.name as string | null) ?? null,
    pos: r.pos as PublicHofEntry['pos'],
    dpos: (r.dpos as PublicHofEntry['dpos']) ?? null,
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
    lastClubId: (r.lastClubId as string | null) ?? null,
    retiredAt: String(r.retiredAt ?? ''),
    hasDetail: Boolean(r.hasDetail),
    title: (r.title as string | null) ?? null,
    retiredNumber:
      r.rnClubId == null
        ? null
        : {
            clubId: String(r.rnClubId),
            club: String(r.rnClub),
            number: Number(r.rnNumber),
            seq: Number(r.rnSeq),
          },
  };
}
const withRetiredNumber = eq(retiredNumbers.careerId, careers.id);

/** 공개 명예의 전당(목록·상세·공유 링크·홈 라이브 은퇴 소식)에 오르는 은퇴. 짧은 커리어(T-10-032)는 내 선수에만 남는다. */
/** 내 선수 목록은 짧은 커리어도 보여 준다. */
const isOwnRetired = and(eq(careers.status, 'retired'), isNotNull(careers.legendScore));
export const isPublicRetired = and(isOwnRetired, gte(careers.retireAge, HOF_MIN_RETIRE_AGE));

const HOF_SORT: Record<HofSort, AnyColumn | SQL> = {
  score: careers.legendScore,
  goals: careers.goals,
  assists: careers.assists,
  ga: goalsPlusAssists(careers),
  apps: careers.apps,
  trophies: careers.trophies,
  awards: careers.awards,
  ballon: careers.ballon,
  caps: careers.caps,
  peak: careers.peak,
};

/** 전체 유저의 은퇴 선수를 sort 기록 순으로(같으면 레전드 점수 · 먼저 은퇴), page(1부터)번째 limit명과 전체 인원.
 * score가 아니면 그 기록이 0인 선수는 뺀다(발롱도르 0회끼리 순위를 매기지 않는다). */
export async function listPublicHof(
  db: Db,
  limit: number,
  page = 1,
  sort: HofSort = 'score',
  season?: ServiceSeason,
): Promise<{ entries: PublicHofEntry[]; total: number }> {
  const by = HOF_SORT[sort];
  const where = and(
    isPublicRetired,
    sort === 'score' ? undefined : sql`${by} > 0`,
    season && inSeason(season),
  );
  const [rows, [count]] = await Promise.all([
    db
      .select(publicColumns)
      .from(careers)
      .leftJoin(retiredNumbers, withRetiredNumber)
      .where(where)
      .orderBy(desc(by), desc(careers.legendScore), careers.retiredAt)
      .limit(limit)
      .offset((page - 1) * limit),
    db
      .select({ n: sql<number>`count(*)` })
      .from(careers)
      .where(where),
  ]);
  return { entries: rows.map(toPublicEntry), total: Number(count?.n ?? 0) };
}

/**
 * T-10-090 시즌 순위에 오르는 커리어 — 개막 뒤 서버에 처음 올라온(첫 시즌 업로드) 커리어가 마감 전에 은퇴했다.
 * created_at·retired_at은 nowIso() 형식이라 문자열 비교가 시각 비교다.
 */
function inSeason(s: ServiceSeason): SQL | undefined {
  const started = gte(careers.createdAt, s.startsAt);
  return s.endsAt === null
    ? started
    : and(started, lt(careers.createdAt, s.endsAt), lt(careers.retiredAt, s.endsAt));
}

export async function getPublicHof(
  db: Db,
  careerId: string,
): Promise<{ entry: PublicHofEntry; snapshot: LegendSnapshot | null } | undefined> {
  const [row] = await db
    .select({ ...publicColumns, snapshotJson: careers.snapshotJson })
    .from(careers)
    .leftJoin(retiredNumbers, withRetiredNumber)
    .where(and(eq(careers.id, careerId), isPublicRetired));
  if (!row) return undefined;
  const { snapshotJson, ...rest } = row;
  return {
    entry: toPublicEntry(rest),
    snapshot: snapshotJson ? (JSON.parse(snapshotJson) as LegendSnapshot) : null,
  };
}

/** T-10-013. 한 프로필의 은퇴 선수(명예의 전당 '내 선수'). */
export async function listOwnHof(
  db: Db,
  profileId: string,
  limit = 500,
): Promise<PublicHofEntry[]> {
  const rows = await db
    .select(publicColumns)
    .from(careers)
    .leftJoin(retiredNumbers, withRetiredNumber)
    .where(and(eq(careers.profileId, profileId), isOwnRetired))
    .orderBy(desc(careers.legendScore), careers.retiredAt)
    .limit(limit);
  return rows.map(toPublicEntry);
}

/** T-10-013. 커리어 소유권을 통째로 옮긴다(익명 프로필 → 로그인한 계정). 옮긴 수를 돌려준다. */
export async function moveCareers(
  db: Db,
  fromProfileId: string,
  toProfileId: string,
): Promise<number> {
  const moved = await db
    .update(careers)
    .set({ profileId: toProfileId })
    .where(eq(careers.profileId, fromProfileId))
    .returning({ id: careers.id });
  return moved.length;
}

/** 프로필 삭제 시 커리어·시즌 데이터를 명시적으로 지운다(소프트 삭제라 FK CASCADE가 트리거되지
 * 않으므로, `executeProfileDeletion`의 batch에 이 두 statement를 함께 넣어 쓴다). */
export function deleteCareersStatements(db: Db, profileId: string) {
  const ownedCareerIds = db
    .select({ id: careers.id })
    .from(careers)
    .where(eq(careers.profileId, profileId));
  return [
    db.delete(careerSeasons).where(inArray(careerSeasons.careerId, ownedCareerIds)),
    db.delete(careers).where(eq(careers.profileId, profileId)),
  ] as const;
}

/**
 * 이미 은퇴한 커리어를 다시 보냈을 때(이름 공개 토글·대표 칭호 바꾸기): 공개 이름과 대표 칭호만 바꾸고, 상세
 * 스냅샷은 비어 있을 때만 채운다. 대표 칭호는 은퇴 때 올라온 스냅샷의 획득 칭호 중 하나일 때만 바꾼다. 은퇴
 * 요약은 첫 은퇴 때 정해져 바뀌지 않는다.
 */
export async function updateRetired(
  db: Db,
  input: Pick<PutRetirementInput, 'careerId' | 'publicName' | 'snapshot' | 'now'> & {
    title: string | null | undefined;
  },
): Promise<void> {
  const { careerId, publicName, snapshot, title, now } = input;
  await db
    .update(careers)
    .set({
      updatedAt: now,
      ...(publicName !== undefined ? { publicName } : {}),
      ...(title
        ? {
            title: sql`case when exists (select 1 from json_each(${careers.snapshotJson}, '$.titles') where json_extract(value, '$.id') = ${title}) then ${title} else ${careers.title} end`,
          }
        : {}),
      ...(snapshot
        ? {
            snapshotJson: sql`coalesce(${careers.snapshotJson}, ${JSON.stringify(snapshot)})`,
            shirtNumber: sql`coalesce(${careers.shirtNumber}, ${snapshot.number})`,
          }
        : {}),
    })
    .where(eq(careers.id, careerId));
}

const storedSeasonColumns = {
  careerId: careerSeasons.careerId,
  year: careerSeasons.year,
  age: careerSeasons.age,
  club: careerSeasons.club,
  clubId: careerSeasons.clubId,
  league: careerSeasons.league,
  apps: careerSeasons.apps,
  goals: careerSeasons.goals,
  assists: careerSeasons.assists,
  cs: careerSeasons.cs,
  caps: careerSeasons.caps,
  ovr: careerSeasons.ovr,
  honorsJson: careerSeasons.honorsJson,
  mil: careerSeasons.mil,
};
export type StoredSeasonRow = Omit<
  Pick<typeof careerSeasons.$inferSelect, keyof typeof storedSeasonColumns>,
  'honorsJson' | 'mil'
> & { honors: string[]; mil: boolean };

/** 커리어별 받아 둔 시즌 기록 — 은퇴 요약 보정(plausibility.ts)과 영구결번 판정의 근거. */
export async function storedSeasonsOf(
  db: Db,
  careerIds: string[],
): Promise<Map<string, StoredSeasonRow[]>> {
  const out = new Map<string, StoredSeasonRow[]>();
  if (!careerIds.length) return out;
  const rows = await db
    .select(storedSeasonColumns)
    .from(careerSeasons)
    .where(inArray(careerSeasons.careerId, careerIds));
  for (const { honorsJson, mil, ...r } of rows) {
    const list = out.get(r.careerId) ?? [];
    list.push({ ...r, honors: honorsOf(honorsJson), mil: mil === 1 });
    out.set(r.careerId, list);
  }
  return out;
}

/** 은퇴 PUT이 보는 커리어의 소유자·상태·포지션(스냅샷 JSON까지 읽지 않는다). */
export async function getCareerHead(db: Db, careerId: string) {
  const [row] = await db
    .select({
      profileId: careers.profileId,
      status: careers.status,
      pos: careers.pos,
      dpos: careers.dpos,
    })
    .from(careers)
    .where(eq(careers.id, careerId));
  return row;
}

/** 테스트 전용 헬퍼: 특정 커리어의 존재 여부·상태 확인. */
export async function getCareer(db: Db, careerId: string): Promise<CareerRow | undefined> {
  const [row] = await db.select().from(careers).where(eq(careers.id, careerId));
  return row;
}

export async function listCareerSeasons(db: Db, careerId: string) {
  return db.select().from(careerSeasons).where(eq(careerSeasons.careerId, careerId));
}
