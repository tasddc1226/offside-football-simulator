import type {
  CareerMeta,
  CareerPos,
  CareerSeasonPayload,
  HofSort,
  LegendSnapshot,
  PublicHofEntry,
  RetirementSummary,
} from '@offside/contracts';
import { HOF_MIN_RETIRE_AGE, WALL_OF_HONOR_TITLE_ID } from '@offside/contracts/hof-rules';
import { cardValue, releasePayout, retireValue } from '@offside/contracts/market-value';
import { firstUploadSeasonAt, type ServiceSeason } from '@offside/contracts/service-seasons';
import {
  dposFor,
  FACE_ATTRS,
  type DetailPos,
  type PeakProfile,
} from '@offside/contracts/positions';
import {
  and,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  notExists,
  sql,
  type AnyColumn,
  type SQL,
} from 'drizzle-orm';
import { readSnapshotJson } from '../../careerSnapshots.js';
import type { Bindings } from '../../env.js';
import type { Db } from '../client.js';
import { runBatch } from './batch.js';
import { sha256Hex } from '../hash.js';
import { retryTransientWrite } from '../retry.js';
import { kstDay } from '../../time.js';
import { honorsOf, hideCareerStatements } from './firsts.js';
import {
  appMeta,
  cards,
  careers,
  careerSeasons,
  goalsPlusAssists,
  managerCareers,
  ownerFunds,
  ownerTeams,
  profiles,
  retiredNumbers,
  seasonTelemetry,
} from '../schema.js';

export const verifiedRetiredTitle = (
  row: { title: string | null; wallOfHonorJson: string | null } | undefined,
): string | null =>
  !row || (row.title === WALL_OF_HONOR_TITLE_ID && !row.wallOfHonorJson) ? null : row.title;

/** Overlay server evidence on every public snapshot; old forged snapshots are sanitized too. */
export function verifiedSnapshot(snapshot: LegendSnapshot, granted: boolean): LegendSnapshot {
  const titles = (snapshot.titles ?? []).filter((t) => t.id !== WALL_OF_HONOR_TITLE_ID);
  if (granted) {
    // Reserve the schema's final slot for the server title even for a full client list.
    titles.length = Math.min(titles.length, 199);
    titles.push({ id: WALL_OF_HONOR_TITLE_ID, year: 0 });
  }
  return { ...snapshot, titles };
}

export type CareerRow = typeof careers.$inferSelect;

/** 공개 이름 갱신(upsert·update의 set). undefined(옛 클라이언트)면 그대로 두고, 운영자가 가린 이름(이름 신고,
 *  name_hidden_at)은 다시 채우지 않는다. keepRetired면 은퇴한 커리어의 이름도 그대로 둔다. */
function publicNameSet(
  publicName: string | null | undefined,
  opts: { keepRetired?: boolean } = {},
) {
  if (publicName === undefined) return {};
  const locked = opts.keepRetired
    ? sql`${careers.nameHiddenAt} is not null or ${careers.status} = 'retired'`
    : sql`${careers.nameHiddenAt} is not null`;
  return { publicName: sql`case when ${locked} then ${careers.publicName} else ${publicName} end` };
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
  /** 나이별 OVR 상한을 크게 넘겨 보낸 시즌이면 같은 batch에서 커리어를 숨긴다(저장 땐 상한으로 잘려 나중엔 알 수 없다, T-11-037). */
  hide?: boolean | undefined;
  now: string;
  uploadRevision?: number;
};

/**
 * `PUT /v1/careers/:careerId/seasons/:year`. `careers` upsert는 `status`를 `set`에서 빼서 이미
 * `retired`인 행을 다시 `active`로 되돌리지 않는다(브리프: "NEVER downgrade retired→active"). 두 upsert를
 * D1 batch(단일 트랜잭션)로 묶어 원자적으로 반영한다. 호출 전 소유권은 라우트가 batch로 읽은 커리어 헤더로
 * 이미 확인했다고 가정한다.
 */
export async function putCareerSeason(
  db: Db,
  input: PutCareerSeasonInput,
): Promise<'active' | 'retired'> {
  const {
    careerId,
    profileId,
    year,
    meta,
    season,
    eventsJson,
    publicName,
    signalsJson,
    hide,
    now,
  } = input;
  const signals = signalsJson !== undefined ? { signalsJson } : {};
  // T-11-048 시즌 성장 기록(세부 능력치 s0·s1 포함, T-11-097b)과 선택 로그는 T-11-207부터 season_telemetry에
  // 업로드마다 덧붙인다. career_seasons의 두 열은 새 행엔 비워 두고, 옛 행의 값은 덮어쓰지 않는다(기존 보관 작업이 옮긴다).
  const events = eventsJson === '[]' ? null : eventsJson;
  const growthJson = season.growth ? JSON.stringify(season.growth) : null;
  const name = publicName !== undefined ? { publicName } : {};
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

  const dpos = dposFor(meta.pos, meta.dpos);
  const uploadHash = await sha256Hex(
    JSON.stringify({ meta, season, eventsJson, publicName, signalsJson }),
  );
  const revision = input.uploadRevision ?? 0;
  // Check inside the same transaction, before updating the season. This also covers
  // a committed write whose HTTP response was lost, and concurrent duplicate PUTs.
  const accept = sql`not exists (select 1 from career_seasons where career_id = ${careerId}
    and year = ${year} and (upload_hash = ${uploadHash}
      or (${revision} > 0 and upload_revision >= ${revision})))`;
  const results = await retryTransientWrite(() =>
    runBatch(db, [
      db
        .insert(careers)
        .values({
          id: careerId,
          profileId,
          pos: meta.pos,
          dpos,
          nation: meta.nation ?? null,
          height: meta.height ?? null,
          weight: meta.weight ?? null,
          foot: meta.foot,
          type: meta.type,
          trait: meta.trait,
          startYear: meta.startYear,
          status: 'active',
          appVersion: meta.appVersion,
          pot: meta.pot ?? null,
          ...name,
          // 처음 올라온 시각의 시즌(0 = 프리시즌, 시즌 사이 휴식기면 NULL) — onConflict set에 없어 바뀌지 않는다.
          // T-11-095 세부 포지션 없이 만든 프리시즌 선수는 개막 뒤에 처음 올라와도 프리시즌이다.
          serviceSeason: firstUploadSeasonAt(now, dpos !== null),
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: careers.id,
          setWhere: accept,
          set: {
            // 포지션·주발·유형·특성·시작 연도는 커리어를 만들 때 정해져 바뀌지 않는다 — 처음 값을 지킨다(뒤늦게
            // 포지션을 바꿔 레전드 점수·결번 가중을 고르지 못하게).
            appVersion: meta.appVersion,
            // 처음 스카우트 평가는 비어 있을 때만 채운다(첫 시즌 업로드가 늦게 와도 한 번만).
            ...(meta.pot !== undefined && { pot: sql`coalesce(${careers.pot}, ${meta.pot})` }),
            // 은퇴한 커리어의 공개 이름은 은퇴 PUT(명예의 전당 토글)만 바꾼다 — 늦게 도착한 시즌 업로드가 되돌리지 않게.
            ...publicNameSet(publicName, { keepRetired: true }),
            updatedAt: now,
            // status는 의도적으로 뺀다 — 이미 retired인 커리어가 이 라우트로 다시 active가 되지 않는다.
          },
        })
        .returning({ status: careers.status }),
      ...(events !== null || growthJson !== null
        ? [
            db.insert(seasonTelemetry).select(sql`select null, ${careerId}, ${year},
          ${season.age}, ${season.ovr}, ${events}, ${growthJson}, ${now} where ${accept}`),
          ]
        : []),
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
          eventsJson: '[]',
          uploadHash,
          uploadRevision: revision,
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
            ...detail,
            ...signals,
            uploadHash,
            uploadRevision: revision > 0 ? revision : sql`${careerSeasons.uploadRevision}`,
            // 같은 시즌을 다시 보내면 덮어써 결과는 같다(멱등). createdAt은 최초값을 유지한다.
          },
          // 은퇴한 커리어의 시즌은 고치지 않는다(은퇴 요약·결번 판정의 근거). 늦게 도착한 빠진 시즌은 새 행이라 들어간다.
          setWhere: sql`${accept} and (select ${careers.status} from ${careers} where ${careers.id} = ${careerId}) <> 'retired'`,
        }),
      // 맨 뒤에 둔다 — 위 upsert가 행을 만든 뒤여야 숨김이 새 커리어에도 닿는다.
      ...(hide
        ? hideCareerStatements(
            db,
            careerId,
            sql`exists (select 1 from career_seasons where career_id = ${careerId} and year = ${year} and upload_hash = ${uploadHash})`,
          )
        : []),
      db.select({ status: careers.status }).from(careers).where(eq(careers.id, careerId)),
    ]),
  );
  return (results.at(-1) as { status: 'active' | 'retired' }[])[0]!.status;
}

export type PutRetirementInput = {
  careerId: string;
  summary: RetirementSummary;
  /** undefined면 기존 값을 그대로 둔다(옛 클라이언트 본문). null이면 익명으로 되돌린다. */
  publicName?: string | null | undefined;
  snapshot?: LegendSnapshot | undefined;
  /** T-10-092 최고 시점 능력치(plausibility.ts boundProfile로 자른 값). 옛 클라이언트는 없다. */
  profile?: PeakProfile | undefined;
  /** T-11-030 은퇴 때 공개된 실제 잠재력(관찰 전용). 옛 클라이언트는 없다. */
  potReal?: number | undefined;
  /** T-11-191 도트 선수 꾸미기 코드. 은퇴 업로드에서는 최초만 적고, 이후 변경은 외형 전용 API에서 처리한다. */
  look?: string | undefined;
  /** T-11-163 은퇴 장려금 비율(밸런스 marketRetireBonusRate). */
  bonusRate: number;
  /** T-11-311 스냅샷을 먼저 R2에 썼으면 그 키(careerSnapshots.putSnapshot). 없으면 snapshot_json에 둔다. */
  snapshotKey?: string | null | undefined;
  now: string;
};

/**
 * 한국 시각 날짜별 은퇴 수를 담는 app_meta 키. 홈 라이브 현황이 오늘 은퇴 수를 count(*)로 세면 오늘 은퇴한
 * 커리어 수만큼 행을 읽으므로(T-10-055), 은퇴할 때 이 키를 1 올리고 현황은 한 행만 읽는다. 프로필 삭제로
 * 커리어가 지워져도 빼지 않는다(홈 현황 숫자라 허용).
 */
export const retiredCountKey = (at: Date) => `retired:${kstDay(at.toISOString())}`;

/** T-11-276 은퇴 PUT이 쓴 직후의 칭호·명예의 벽(응답 칭호를 다시 읽지 않고 쓰기 결과에서 받는다). */
export type RetiredHead = { title: string | null; wallOfHonorJson: string | null };
const retiredHead = { title: careers.title, wallOfHonorJson: careers.wallOfHonorJson };

/** `PUT /v1/careers/:careerId/retirement`의 첫 은퇴. 소유권 확인과 요약 보정(plausibility.ts)은 라우트가 미리
 * 끝낸다. 다시 보낸 은퇴(이름 공개 토글·대표 칭호)는 `updateRetired`로 간다. 쓴 뒤의 칭호·명예의 벽을 돌려준다. */
export async function putRetirement(
  db: Db,
  input: PutRetirementInput,
): Promise<RetiredHead | undefined> {
  const {
    careerId,
    summary,
    publicName,
    snapshot,
    snapshotKey,
    profile,
    potReal,
    look,
    bonusRate,
    now,
  } = input;
  const value = snapshot ? cardValue(snapshot.career, summary.peak) : null;
  // T-11-163 은퇴 장려금: 기준가가 있는 카드만(스냅샷 없는 옛 기록은 거래도 하지 않는다).
  const bonus = value === null ? 0 : releasePayout(value, bonusRate);
  const results = await runBatch(db, [
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
        ...(summary.title !== undefined
          ? { title: summary.title === WALL_OF_HONOR_TITLE_ID ? null : summary.title }
          : {}),
        ...(summary.lastClubId !== undefined ? { lastClubId: summary.lastClubId } : {}),
        ...publicNameSet(publicName),
        ...(snapshot
          ? {
              ...(snapshotKey
                ? { snapshotKey, snapshotJson: null }
                : { snapshotJson: JSON.stringify(verifiedSnapshot(snapshot, false)) }),
              shirtNumber: snapshot.number,
              value: retireValue(snapshot.career, summary.legendScore),
            }
          : {}),
        ...(profile ? { peakProfile: JSON.stringify(profile) } : {}),
        ...(potReal !== undefined ? { potReal } : {}),
        // A delayed first-retirement request must not overwrite the one-time edited/transferred look.
        ...(look
          ? {
              look: sql`CASE WHEN ${careers.status} <> 'retired' AND ${careers.retiredLookUsed} = 0 THEN ${look} ELSE ${careers.look} END`,
            }
          : {}),
      })
      .where(eq(careers.id, careerId))
      .returning(retiredHead),
    // T-11-163 은퇴 장려금. 아래 카드 insert보다 먼저 — 카드가 아직 없을 때(이 커리어의 첫 은퇴)만 한 번 준다.
    ...(bonus > 0
      ? [
          db
            .insert(ownerFunds)
            .select(
              db
                .select({
                  profileId: careers.profileId,
                  balance: sql<number>`${bonus}`.as('balance'),
                  updatedAt: sql<string>`${now}`.as('updated_at'),
                })
                .from(careers)
                .where(
                  and(
                    eq(careers.id, careerId),
                    isNotNull(careers.peak),
                    notExists(
                      db
                        .select({ x: sql`1` })
                        .from(cards)
                        .where(eq(cards.careerId, careerId)),
                    ),
                  ),
                ),
            )
            .onConflictDoUpdate({
              target: ownerFunds.profileId,
              set: {
                balance: sql`${ownerFunds.balance} + excluded.balance`,
                updatedAt: sql`excluded.updated_at`,
              },
            }),
        ]
      : []),
    // T-11-080 카드 한 장. 위 update가 쓴 값을 복사한다(같은 커리어를 다시 보내도 PK라 한 장뿐).
    db
      .insert(cards)
      .select(
        db
          .select({
            careerId: careers.id,
            ownerId: careers.profileId,
            serviceSeason: sql<number>`coalesce(${careers.serviceSeason}, 0)`.as('service_season'),
            pos: careers.pos,
            dpos: careers.dpos,
            nation: careers.nation,
            number: careers.shirtNumber,
            peak: sql<number>`${careers.peak}`.as('peak'),
            legendScore: sql<number>`coalesce(${careers.legendScore}, 0)`.as('legend_score'),
            peakProfile: careers.peakProfile,
            cardValue: sql<number | null>`${value}`.as('card_value'),
            retireValue: sql<number>`coalesce(${careers.value}, 0)`.as('retire_value'),
            transfers: sql<number>`0`.as('transfers'),
            releasedAt: sql<string | null>`null`.as('released_at'),
            releasedValue: sql<number | null>`null`.as('released_value'),
            bonusValue: sql<number | null>`${bonus > 0 ? bonus : null}`.as('bonus_value'),
            locked: sql<boolean>`0`.as('locked'),
            manager: sql<boolean>`0`.as('manager'),
            createdAt: sql<string>`${now}`.as('created_at'),
            updatedAt: sql<string>`${now}`.as('updated_at'),
          })
          .from(careers)
          .where(and(eq(careers.id, careerId), isNotNull(careers.peak))),
      )
      .onConflictDoNothing(),
  ]);
  return (results[1] as RetiredHead[])[0];
}

// ───────── T-10-005 공개 명예의 전당 (로그인 불필요 · 읽기 전용) ─────────

const publicColumns = {
  id: careers.id,
  name: careers.publicName,
  pos: careers.pos,
  dpos: careers.dpos,
  nation: careers.nation,
  number: careers.shirtNumber,
  retireAge: careers.retireAge,
  peak: careers.peak,
  potReal: careers.potReal,
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
  look: careers.look,
  retiredAt: careers.retiredAt,
  hasDetail: sql<number>`${careers.snapshotJson} is not null or ${careers.snapshotKey} is not null`,
  title: careers.title,
  wallOfHonor: sql<number>`${careers.wallOfHonorJson} is not null`,
  value: careers.value,
  serviceSeason: careers.serviceSeason,
  // T-10-076 영구결번(retired_numbers를 left join한 쿼리에서만 쓴다).
  rnClubId: retiredNumbers.clubId,
  rnClub: retiredNumbers.club,
  rnNumber: retiredNumbers.number,
  rnSeq: retiredNumbers.seq,
};
type PublicRow = { [K in keyof typeof publicColumns]: unknown };

/**
 * T-11-297 키운 구단주(공개 목록·상세에서만 — profiles·owner_teams를 left join한 쿼리). 닉네임은 프로필의 공개 닉네임,
 * 팀은 그 구단주의 가장 최근 시즌 팀(구단주 프로필을 팀 id로 연다). 둘 다 PK·유니크 인덱스(profile_id, season)로 찾는다.
 */
const raiserColumns = {
  raiserNickname: profiles.nickname,
  raiserTeamId: ownerTeams.id,
  raiserTeamName: ownerTeams.name,
};
type RaiserRow = { [K in keyof typeof raiserColumns]: unknown };
const withRaiserProfile = eq(profiles.id, careers.profileId);
const withRaiserTeam = and(
  eq(ownerTeams.profileId, careers.profileId),
  eq(
    ownerTeams.season,
    sql`(select max(t.season) from owner_teams t where t.profile_id = ${careers.profileId})`,
  ),
);

/** 익명 선수(이름 비공개)는 구단주도 숨긴다. 닉네임·팀이 둘 다 없으면 null. */
function raiserOf(r: Partial<RaiserRow> & { name: unknown }): PublicHofEntry['raiser'] {
  if (r.name == null) return null;
  const nickname = (r.raiserNickname as string | null | undefined) ?? null;
  const teamId = (r.raiserTeamId as string | null | undefined) ?? null;
  if (nickname == null && teamId == null) return null;
  return {
    nickname,
    teamId,
    teamName: teamId ? String(r.raiserTeamName ?? '') : null,
  };
}

/** T-11-297 은퇴 때 남긴 최고 시점 대표 능력치 6개. 모양이 틀리거나 없으면 null. */
export function peakAttrsOf(json: unknown): PublicHofEntry['attrs'] {
  if (typeof json !== 'string' || !json) return null;
  try {
    const attrs = (JSON.parse(json) as Partial<PeakProfile>).attrs;
    if (!attrs || !FACE_ATTRS.every((k) => Number.isFinite(attrs[k]))) return null;
    return Object.fromEntries(FACE_ATTRS.map((k) => [k, Math.round(attrs[k])])) as NonNullable<
      PublicHofEntry['attrs']
    >;
  } catch {
    return null;
  }
}

function toPublicEntry(r: PublicRow & Partial<RaiserRow>): PublicHofEntry {
  const n = (v: unknown) => Number(v ?? 0);
  return {
    ...('raiserNickname' in r ? { raiser: raiserOf(r) } : {}),
    id: String(r.id),
    name: (r.name as string | null) ?? null,
    pos: r.pos as PublicHofEntry['pos'],
    dpos: dposFor(r.pos as PublicHofEntry['pos'], r.dpos as string | null),
    nation: (r.nation as string | null) ?? null,
    number: r.number == null ? null : Number(r.number),
    retireAge: n(r.retireAge),
    peak: n(r.peak),
    ...(r.potReal != null ? { potReal: Number(r.potReal) } : {}),
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
    ...(r.look ? { look: String(r.look) } : {}),
    retiredAt: String(r.retiredAt ?? ''),
    hasDetail: Boolean(r.hasDetail),
    title:
      r.title === WALL_OF_HONOR_TITLE_ID && !r.wallOfHonor
        ? null
        : ((r.title as string | null) ?? null),
    wallOfHonor: Boolean(r.wallOfHonor),
    value: r.value == null ? null : Number(r.value),
    season: r.serviceSeason == null ? null : Number(r.serviceSeason),
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
export const isPublicRetired = and(
  isOwnRetired,
  gte(careers.retireAge, HOF_MIN_RETIRE_AGE),
  eq(careers.hidden, 0),
);

const HOF_SORT: Record<HofSort, AnyColumn | SQL> = {
  score: careers.legendScore,
  value: careers.value,
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
 * score가 아니면 그 기록이 0인 선수는 뺀다(발롱도르 0회끼리 순위를 매기지 않는다).
 * T-10-101 q가 있으면 공개 이름에 q가 들어간 선수만 — 각 선수에 검색 전 순위(rank)를 붙인다.
 * T-11-018 pos가 있으면 그 포지션 안의 순위다. */
export async function listPublicHof(
  db: Db,
  limit: number,
  page = 1,
  sort: HofSort = 'score',
  season?: ServiceSeason,
  q?: string,
  pos?: CareerPos,
  dpos?: DetailPos,
  /** T-11-257 전체 인원 세기를 감싼다(라우트가 엣지 캐시에 담는다). 기본은 매번 센다. */
  cachedTotal: (load: () => Promise<number>) => Promise<number> = (load) => load(),
): Promise<{ entries: PublicHofEntry[]; total: number }> {
  const by = HOF_SORT[sort];
  const ranked = and(
    isPublicRetired,
    sort === 'score' ? undefined : sql`${by} > 0`,
    season && inSeason(season),
    pos && eq(careers.pos, pos),
    dpos && eq(careers.dpos, dpos),
  );
  const where = q
    ? and(
        ranked,
        sql`${careers.publicName} like ${`%${q.replace(/[\\%_]/g, '\\$&')}%`} escape '\\'`,
      )
    : ranked;
  // Do not repeat legend_score for score sorting: SQLite otherwise sorts the duplicate suffix.
  const order =
    sort === 'score'
      ? [desc(by), careers.retiredAt]
      : [desc(by), desc(careers.legendScore), careers.retiredAt];
  const rankSource =
    sort === 'score'
      ? season
        ? sql`${careers} INDEXED BY careers_hof_season_score_order_idx`
        : sql`${careers} INDEXED BY careers_hof_score_order_idx`
      : careers;
  // Primary-anchored read sessions send later reads to a caught-up replica.
  // Await the page before count so its bookmark is established first.
  // For score sorting, filter/page on the covering index before fetching display columns.
  const pageIds = db
    .select({ id: sql<string>`${careers.id}`.as('hof_career_id') })
    .from(rankSource)
    .where(where)
    .orderBy(...order)
    .limit(limit)
    .offset((page - 1) * limit)
    .as('hof_page');
  const query = db
    .select({ ...publicColumns, ...raiserColumns })
    .from(careers)
    .leftJoin(retiredNumbers, withRetiredNumber)
    .leftJoin(profiles, withRaiserProfile)
    .leftJoin(ownerTeams, withRaiserTeam)
    .$dynamic();
  const rows = await (sort === 'score'
    ? query.innerJoin(pageIds, eq(careers.id, sql`"hof_page"."hof_career_id"`)).orderBy(...order)
    : query
        .where(where)
        .orderBy(...order)
        .limit(limit)
        .offset((page - 1) * limit));
  const total = await cachedTotal(async () => {
    const [count] = await db
      .select({ n: sql<number>`count(*)` })
      .from(
        q
          ? rankSource
          : dpos
            ? sql`${careers} INDEXED BY careers_hof_dpos_idx`
            : sql`${careers} INDEXED BY careers_hof_count_idx`,
      )
      .where(where);
    return Number(count?.n ?? 0);
  });
  const entries = rows.map(toPublicEntry);
  if (q && entries.length) {
    // 찾은 선수(최대 limit명)만 전체 순위에서 몇 위인지 — id·순번만 읽는 창 함수 한 번.
    const all = db
      .select({
        id: sql<string>`${careers.id}`.as('id'),
        rk: sql<number>`row_number() over (order by ${sql.join([...order], sql`, `)})`.as('rk'),
      })
      .from(rankSource)
      .where(ranked)
      .as('ranked');
    const ranks = await db
      .select({ id: all.id, rk: all.rk })
      .from(all)
      .where(
        inArray(
          all.id,
          entries.map((e) => e.id),
        ),
      );
    const at = new Map(ranks.map((r) => [r.id, Number(r.rk)]));
    for (const e of entries) e.rank = at.get(e.id);
  }
  return { entries, total };
}

/**
 * T-10-090 시즌 순위에 오르는 커리어 — 그 시즌에 처음 올라온 커리어(careers.service_season)가 마감 전에 은퇴했다.
 * retired_at은 nowIso() 형식이라 문자열 비교가 시각 비교다.
 */
function inSeason(s: ServiceSeason): SQL | undefined {
  const joined = eq(careers.serviceSeason, s.id);
  return s.endsAt === null ? joined : and(joined, lt(careers.retiredAt, s.endsAt));
}

export async function getPublicHof(
  db: Db,
  careerId: string,
  env: Pick<Bindings, 'BACKUP'>,
): Promise<{ entry: PublicHofEntry; snapshot: LegendSnapshot | null } | undefined> {
  const [row] = await db
    .select({
      ...publicColumns,
      ...raiserColumns,
      snapshotJson: careers.snapshotJson,
      snapshotKey: careers.snapshotKey,
      peakProfile: careers.peakProfile,
    })
    .from(careers)
    .leftJoin(retiredNumbers, withRetiredNumber)
    .leftJoin(profiles, withRaiserProfile)
    .leftJoin(ownerTeams, withRaiserTeam)
    .where(and(eq(careers.id, careerId), isPublicRetired));
  if (!row) return undefined;
  const { snapshotJson: inD1, snapshotKey, peakProfile, ...rest } = row;
  const snapshotJson = await readSnapshotJson(env, { snapshotJson: inD1, snapshotKey });
  return {
    entry: { ...toPublicEntry(rest), attrs: peakAttrsOf(peakProfile) },
    snapshot: snapshotJson
      ? verifiedSnapshot(JSON.parse(snapshotJson) as LegendSnapshot, Boolean(rest.wallOfHonor))
      : null,
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

/** Same visibility/order/cap as listOwnHof, without player display fields or JSON decoding. */
export async function listOwnSummary(db: Db, profileId: string) {
  const rows = await db
    .select({
      id: careers.id,
      season: careers.serviceSeason,
      legendScore: careers.legendScore,
      retiredNumber: retiredNumbers.number,
    })
    .from(careers)
    .leftJoin(retiredNumbers, withRetiredNumber)
    .where(and(eq(careers.profileId, profileId), isOwnRetired))
    .orderBy(desc(careers.legendScore), careers.retiredAt)
    .limit(500);
  return rows.map((row) => ({ ...row, legendScore: row.legendScore ?? 0 }));
}

/** T-10-013. 커리어 소유권을 통째로 옮긴다(익명 프로필 → 로그인한 계정). 옮긴 수를 돌려준다. */
export async function moveCareers(
  db: Db,
  fromProfileId: string,
  toProfileId: string,
): Promise<number> {
  // T-11-080 카드 주인도 같이 옮긴다(익명 프로필에는 방출·이적이 없어 카드는 모두 직접 키운 선수다).
  const [moved] = await db.batch([
    db
      .update(careers)
      .set({ profileId: toProfileId })
      .where(eq(careers.profileId, fromProfileId))
      .returning({ id: careers.id }),
    db.update(cards).set({ ownerId: toProfileId }).where(eq(cards.ownerId, fromProfileId)),
  ]);
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
    // T-11-080 지금 가진 카드도 지운다. 다른 구단주에게 넘어간 카드는 그 구단주의 것이라 남는다.
    db.delete(cards).where(eq(cards.ownerId, profileId)),
    // T-11-310 감독 커리어(진행 중 · 끝낸 감독 카드)도 지운다.
    db.delete(managerCareers).where(eq(managerCareers.profileId, profileId)),
  ] as const;
}

/**
 * 이미 은퇴한 커리어를 다시 보냈을 때(이름 공개 토글·대표 칭호 바꾸기): 공개 이름과 대표 칭호만 바꾸고, 상세
 * 스냅샷은 비어 있을 때만 채운다. 대표 칭호는 은퇴 때 올라온 스냅샷의 획득 칭호 중 하나일 때만 바꾼다. 은퇴
 * 요약은 첫 은퇴 때 정해져 바뀌지 않는다.
 */
export async function updateRetired(
  db: Db,
  input: Pick<
    PutRetirementInput,
    'careerId' | 'publicName' | 'snapshot' | 'snapshotKey' | 'now'
  > & {
    title: string | null | undefined;
    /** T-11-311 R2에 둔 스냅샷의 획득 칭호 id(D1 snapshot_json이 비어 있을 때 대표 칭호 확인용). */
    snapshotTitleIds?: readonly string[] | undefined;
  },
): Promise<RetiredHead | undefined> {
  const { careerId, publicName, snapshot, snapshotKey, title, snapshotTitleIds = [], now } = input;
  const [row] = await db
    .update(careers)
    .set({
      updatedAt: now,
      // T-11-377 이미 공개한 이름은 은퇴 기록을 다시 보내도 다른 이름으로 바뀌지 않는다(이름 변경권으로만 바꾼다). 비우기 ·
      // 비어 있던 이름 처음 붙이기는 그대로 된다.
      ...(publicName === undefined
        ? {}
        : {
            publicName: sql`case when ${careers.nameHiddenAt} is not null or (${careers.publicName} is not null and ${publicName} is not null) then ${careers.publicName} else ${publicName} end`,
          }),
      ...(title
        ? {
            title: sql`case when (${title} = ${WALL_OF_HONOR_TITLE_ID} and ${careers.wallOfHonorJson} is not null) or (${title} <> ${WALL_OF_HONOR_TITLE_ID} and (exists (select 1 from json_each(${careers.snapshotJson}, '$.titles') where json_extract(value, '$.id') = ${title}) or ${title} in (select value from json_each(${JSON.stringify(snapshotTitleIds)})))) then ${title} else ${careers.title} end`,
          }
        : {}),
      ...(snapshot
        ? {
            // 상세가 이미 있으면(D1이든 R2든) 그대로 둔다. 키는 상세가 없을 때만 라우트가 R2에 먼저 써서 넘긴다.
            ...(snapshotKey
              ? {
                  snapshotKey: sql`case when ${careers.snapshotJson} is null then coalesce(${careers.snapshotKey}, ${snapshotKey}) else ${careers.snapshotKey} end`,
                }
              : {
                  snapshotJson: sql`case when ${careers.snapshotKey} is null then coalesce(${careers.snapshotJson}, ${JSON.stringify(verifiedSnapshot(snapshot, false))}) else ${careers.snapshotJson} end`,
                }),
            // A late client snapshot cannot establish a historical retirement number.
          }
        : {}),
    })
    .where(eq(careers.id, careerId))
    .returning(retiredHead);
  return row;
}

/**
 * T-11-266 은퇴 때 익명으로 올라간 내 선수에게 이름을 붙인다(이름은 기기에만 있어 기기가 보낸다). 내가 키운 은퇴
 * 커리어 중 이름이 비어 있고 운영자가 가리지 않은 것만 채운다. 이미 공개된 이름은 바꾸지 않는다. 붙인 커리어 id를 돌려준다.
 */
export async function publishCareerNames(
  db: Db,
  profileId: string,
  items: { careerId: string; publicName: string }[],
  now: string,
): Promise<string[]> {
  const rows = (await runBatch(
    db,
    items.map((x) =>
      db
        .update(careers)
        .set({ publicName: x.publicName, updatedAt: now })
        .where(
          and(
            eq(careers.id, x.careerId),
            eq(careers.profileId, profileId),
            eq(careers.status, 'retired'),
            isNull(careers.publicName),
            isNull(careers.nameHiddenAt),
          ),
        )
        .returning({ id: careers.id }),
    ),
  )) as { id: string }[][];
  return rows.flatMap((r) => r.map((x) => x.id));
}

/** T-11-266 내가 키운 은퇴 선수 중 서버에 이름이 없고 운영자가 가리지 않은 커리어 id. 카드를 팔았거나 방출했어도 들어간다. */
export async function listAnonRetiredIds(
  db: Db,
  profileId: string,
  limit: number,
): Promise<string[]> {
  const rows = await db
    .select({ id: careers.id })
    .from(careers)
    .where(
      and(
        eq(careers.profileId, profileId),
        eq(careers.status, 'retired'),
        isNull(careers.publicName),
        isNull(careers.nameHiddenAt),
      ),
    )
    .limit(limit);
  return rows.map((r) => r.id);
}

const storedSeasonColumns = {
  careerId: careerSeasons.careerId,
  createdAt: careerSeasons.createdAt,
  year: careerSeasons.year,
  age: careerSeasons.age,
  club: careerSeasons.club,
  clubId: careerSeasons.clubId,
  league: careerSeasons.league,
  apps: careerSeasons.apps,
  goals: careerSeasons.goals,
  assists: careerSeasons.assists,
  rating: careerSeasons.rating,
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

/** 받아 둔 시즌 기록 조회문(다른 읽기와 한 batch로 보낼 때). 결과는 groupStoredSeasons로 묶는다. */
export const storedSeasonsQuery = (db: Db, careerIds: string[]) =>
  db
    .select(storedSeasonColumns)
    .from(careerSeasons)
    .where(inArray(careerSeasons.careerId, careerIds));

export function groupStoredSeasons(
  rows: Awaited<ReturnType<typeof storedSeasonsQuery>>,
): Map<string, StoredSeasonRow[]> {
  const out = new Map<string, StoredSeasonRow[]>();
  for (const { honorsJson, mil, ...r } of rows) {
    const list = out.get(r.careerId) ?? [];
    list.push({ ...r, honors: honorsOf(honorsJson), mil: mil === 1 });
    out.set(r.careerId, list);
  }
  return out;
}

/** 커리어별 받아 둔 시즌 기록 — 은퇴 요약 보정(plausibility.ts)과 영구결번 판정의 근거. */
export async function storedSeasonsOf(
  db: Db,
  careerIds: string[],
): Promise<Map<string, StoredSeasonRow[]>> {
  if (!careerIds.length) return new Map();
  return groupStoredSeasons(await storedSeasonsQuery(db, careerIds));
}

/** T-11-097 한 시즌의 저장된 OVR(성장 기록 조작 판정의 '지난 시즌'). 없으면 null. 업로드마다 부르므로 storedSeasonsOf처럼
 * 커리어 시즌 전부를 읽지 않고 기본 키 한 줄만 읽는다. */
export const seasonOvrQuery = (db: Db, careerId: string, year: number) =>
  db
    .select({ ovr: careerSeasons.ovr })
    .from(careerSeasons)
    .where(and(eq(careerSeasons.careerId, careerId), eq(careerSeasons.year, year)));

/** 은퇴 PUT이 보는 커리어의 소유자·상태·포지션(스냅샷 JSON까지 읽지 않는다). 조회문 — 다른 읽기와 한 batch로 보낼 수 있다. */
export const careerHeadQuery = (db: Db, careerId: string) =>
  db
    .select({
      profileId: careers.profileId,
      detailArchiveKey: careers.detailArchiveKey,
      updatedAt: careers.updatedAt,
      snapshotKey: careers.snapshotKey,
      hasSnapshot: sql<number>`${careers.snapshotJson} is not null or ${careers.snapshotKey} is not null`,
      title: careers.title,
      wallOfHonorJson: careers.wallOfHonorJson,
      status: careers.status,
      pos: careers.pos,
      dpos: careers.dpos,
      serviceSeason: careers.serviceSeason,
    })
    .from(careers)
    .where(eq(careers.id, careerId));

export async function getCareerHead(db: Db, careerId: string) {
  const [row] = await careerHeadQuery(db, careerId);
  return row;
}

/** 커리어 한 행(존재 여부·상태 확인). */
export async function getCareer(db: Db, careerId: string): Promise<CareerRow | undefined> {
  const [row] = await db.select().from(careers).where(eq(careers.id, careerId));
  return row;
}

/**
 * T-11-243 retired_look_used holds the art round a change was spent in. Round 1 was the dot
 * character; the layered character is round 2, so every retiree gets one more free change.
 * Older rounds read as unused without rewriting existing rows.
 */
export const RETIRED_LOOK_ROUND = 2;

/** Appearance-only update. Retirement dates, snapshots, rankings and financial values stay untouched. */
export async function retiredLookPolicy(db: Db, careerId: string) {
  const [row] = await db
    .select({
      careerId: careers.id,
      look: careers.look,
      used: careers.retiredLookUsed,
      transfers: cards.transfers,
    })
    .from(careers)
    .leftJoin(cards, eq(cards.careerId, careers.id))
    .where(eq(careers.id, careerId));
  if (!row) return undefined;
  const lockedReason =
    (row.transfers ?? 0) > 0
      ? ('transferred' as const)
      : row.used >= RETIRED_LOOK_ROUND
        ? ('used' as const)
        : null;
  return {
    careerId: row.careerId,
    look: row.look,
    remaining: lockedReason ? (0 as const) : (1 as const),
    lockedReason,
  };
}

export async function updateRetiredLook(
  db: Db,
  careerId: string,
  profileId: string,
  look: string | null,
) {
  const [row] = await db
    .update(careers)
    .set({ look, retiredLookUsed: RETIRED_LOOK_ROUND })
    .where(
      and(
        eq(careers.id, careerId),
        eq(careers.profileId, profileId),
        eq(careers.status, 'retired'),
        lt(careers.retiredLookUsed, RETIRED_LOOK_ROUND),
        // Checked in the write itself: concurrent saves and market purchases cannot bypass it.
        notExists(
          db
            .select({ id: cards.careerId })
            .from(cards)
            .where(and(eq(cards.careerId, careers.id), gte(cards.transfers, 1))),
        ),
      ),
    )
    .returning({ careerId: careers.id, look: careers.look });
  return row;
}
