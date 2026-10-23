import type { Best11Change, Best11Player, Best11Ranked, Best11Response } from '@offside/contracts';
import { careersByIds, teamPlayerCard } from './ownerTeams.js';
import {
  BEST11_SLOTS,
  BEST11_TOP,
  best11Admits,
  best11Gate,
  best11Keep,
  best11Raw,
  rankBest11,
  type Best11Candidate,
  type Best11Gate,
  type Best11Raw,
  type Best11Scored,
  type Best11Slot,
} from '@offside/contracts/best11-rules';
import type { DetailPos } from '@offside/contracts/positions';
import { SERVICE_SEASONS, seasonById } from '@offside/contracts/service-seasons';
import { and, desc, eq, inArray, isNotNull, isNull, lt, notExists, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import type { BatchItem } from 'drizzle-orm/batch';
import type { Db } from '../client.js';
import { retryTransientRead, retryTransientWrite } from '../retry.js';
import { runBatch } from './batch.js';
import { isPublicRetired, storedSeasonsOf, type StoredSeasonRow } from './careers.js';
import { best11Candidates, best11Changes, best11Seasons, best11Slots, careers } from '../schema.js';

// T-11-463 시즌 BEST 11. 은퇴할 때 그 선수의 세 기둥 원점수를 매기고(받아 둔 시즌 기록 기준, 보낸 숫자를 믿지 않는다),
// 순위를 바꿀 수 있으면 후보에 넣은 뒤 그 시즌 11자리를 다시 채운다. 자리마다 상위 BEST11_POOL명과 정규화 기준만 남겨
// 다시 계산은 늘 수백 줄 안에서 끝난다. 매일 단계가 빠진 은퇴(이름을 나중에 공개 · 계산 실패)를 채우고, 숨김 · 이름 비공개를
// 걸러 내고, 마감한 시즌을 확정한다. 확정한 시즌은 바뀌지 않는다. 규칙은 @offside/contracts/best11-rules.

/** D1 한 문장의 바인딩 상한(100) 아래로 나눈다. */
const CHUNK = 90;
const chunks = <T>(xs: readonly T[], n = CHUNK) =>
  Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

/** 화면에 보여 줄 최근 자리 변화 수. */
const CHANGES = 20;
/** 매일 단계가 세부 포지션마다 살펴볼 레전드 점수 상위 은퇴 수(검증에서 뽑힌 선수는 모두 9위 안). */
export const BEST11_SCAN = 400;
/** 매일 단계 한 번(5분 cron)에 살펴볼 세부 포지션 수. */
const SCAN_DPOS_PER_STEP = 3;

const toSeasons = (rows: readonly StoredSeasonRow[]) =>
  rows.map((s) => ({
    league: s.league,
    apps: s.apps,
    goals: s.goals,
    assists: s.assists,
    cs: s.cs,
    rating: s.rating,
    honors: s.honors,
  }));

/** 은퇴 시각이 그 시즌 안인가(마감 뒤 은퇴는 그 시즌 순위에 넣지 않는다, 명예의 전당 시즌 순위와 같은 규칙). */
function seasonOfRetirement(season: number | null, retiredAt: string): number | null {
  if (!season || season < 1) return null;
  const s = seasonById(season);
  if (!s || retiredAt < s.startsAt || (s.endsAt !== null && retiredAt >= s.endsAt)) return null;
  return season;
}

/** 이름이 공개돼 BEST 11에 오를 수 있는 은퇴(숨김 아님 · 이름 비공개 아님 · 명예의 전당 기준). */
const showable = and(isPublicRetired, isNotNull(careers.publicName), isNull(careers.nameHiddenAt));

const showableSql = sql<number>`case when ${showable} then 1 else 0 end`;

const candidateColumns = {
  careerId: best11Candidates.careerId,
  ownerId: best11Candidates.profileId,
  dpos: best11Candidates.dpos,
  retiredAt: best11Candidates.retiredAt,
  rawJson: best11Candidates.rawJson,
  ok: showableSql,
  name: careers.publicName,
  nation: careers.nation,
  peak: careers.peak,
};
type CandidateRow = {
  careerId: string;
  ownerId: string;
  dpos: string;
  retiredAt: string;
  rawJson: string;
  ok: number;
  name: string | null;
  nation: string | null;
  peak: number | null;
};
type Cand = Best11Candidate & {
  name: string;
  nation: string | null;
  peak: number;
};

const candidatesQuery = (db: Db, season: number) =>
  db
    .select(candidateColumns)
    .from(best11Candidates)
    .innerJoin(careers, eq(careers.id, best11Candidates.careerId))
    .where(eq(best11Candidates.season, season));

function toCand(r: CandidateRow): Cand | null {
  if (!r.ok || !r.name) return null;
  try {
    return {
      careerId: r.careerId,
      ownerId: r.ownerId,
      dpos: r.dpos as DetailPos,
      retiredAt: r.retiredAt,
      raw: JSON.parse(r.rawJson) as Best11Raw,
      name: r.name,
      nation: r.nation,
      peak: r.peak ?? 0,
    };
  } catch {
    return null;
  }
}

const readGate = (json: string | null | undefined): Best11Gate | null => {
  if (!json) return null;
  try {
    return JSON.parse(json) as Best11Gate;
  } catch {
    return null;
  }
};

/**
 * 시즌 11자리를 다시 채운다. 후보를 줄이고(자격을 잃은 줄 · 순위 밖), 바뀐 자리를 쓰고, 변화 기록을 남긴다.
 * 확정한 시즌이면 아무것도 하지 않는다. 자리 주인이 바뀌었으면 true.
 */
export async function recomputeBest11(
  db: Db,
  season: number,
  now: string,
  finalize = false,
): Promise<boolean> {
  const [rows, stored, [state]] = await retryTransientRead(() =>
    db.batch([
      candidatesQuery(db, season),
      db.select().from(best11Slots).where(eq(best11Slots.season, season)),
      db.select().from(best11Seasons).where(eq(best11Seasons.season, season)),
    ]),
  );
  if (state?.finalAt) return false;
  const valid = rows.map(toCand).filter((c): c is Cand => c !== null);
  const keep = best11Keep(valid);
  const kept = valid.filter((c) => keep.has(c.careerId));
  const { pick } = rankBest11(kept);
  const drop = rows.filter((r) => !keep.has(r.careerId)).map((r) => r.careerId);
  const bySlot = new Map(stored.map((s) => [s.slot, s]));
  const writes: BatchItem<'sqlite'>[] = [];
  let changed = false;
  for (const slot of BEST11_SLOTS) {
    const next = pick[slot];
    const prev = bySlot.get(slot);
    if (!next) {
      if (prev) {
        changed = true;
        writes.push(
          db
            .delete(best11Slots)
            .where(and(eq(best11Slots.season, season), eq(best11Slots.slot, slot))),
          db.insert(best11Changes).values({
            season,
            slot,
            inCareerId: null,
            outCareerId: prev.careerId,
            at: now,
          }),
        );
      }
      continue;
    }
    const moved = prev?.careerId !== next.c.careerId;
    if (moved) {
      changed = true;
      writes.push(
        db.insert(best11Changes).values({
          season,
          slot,
          inCareerId: next.c.careerId,
          outCareerId: prev?.careerId ?? null,
          at: now,
        }),
      );
    }
    if (moved || prev?.score !== next.index)
      writes.push(
        db
          .insert(best11Slots)
          .values({
            season,
            slot,
            careerId: next.c.careerId,
            score: next.index,
            since: moved ? now : prev!.since,
          })
          .onConflictDoUpdate({
            target: [best11Slots.season, best11Slots.slot],
            set: { careerId: next.c.careerId, score: next.index, since: moved ? now : prev!.since },
          }),
      );
  }
  for (const ids of chunks(drop))
    writes.push(db.delete(best11Candidates).where(inArray(best11Candidates.careerId, ids)));
  const gateJson = JSON.stringify(best11Gate(kept));
  const finalAt = finalize ? now : null;
  writes.push(
    db
      .insert(best11Seasons)
      .values({ season, updatedAt: now, gateJson, finalAt })
      .onConflictDoUpdate({
        target: best11Seasons.season,
        set: { updatedAt: changed || !state ? now : state.updatedAt, gateJson, finalAt },
        // 다른 요청이 먼저 확정했으면 덮지 않는다.
        setWhere: isNull(best11Seasons.finalAt),
      }),
  );
  await retryTransientWrite(() => runBatch(db, writes));
  return changed;
}

export interface Best11Offer {
  careerId: string;
  profileId: string;
  dpos: DetailPos | null;
  serviceSeason: number | null;
  retiredAt: string;
  seasons: readonly StoredSeasonRow[];
}

/**
 * 은퇴 한 명을 후보로 낸다(은퇴 PUT 응답 뒤). 자격이 없거나, 시즌이 확정됐거나, 순위를 바꿀 수 없으면 쓰지 않는다.
 * 후보에 넣었으면 그 시즌을 다시 채운다. 다시 채울 시즌 id(자리 주인이 바뀌었을 때만) 또는 null.
 */
export async function offerBest11(db: Db, offer: Best11Offer, now: string): Promise<number | null> {
  const season = seasonOfRetirement(offer.serviceSeason, offer.retiredAt);
  if (season === null || !offer.dpos) return null;
  const raw = best11Raw(offer.dpos, toSeasons(offer.seasons));
  if (!raw) return null;
  const [state] = await retryTransientRead(() =>
    db.select().from(best11Seasons).where(eq(best11Seasons.season, season)),
  );
  if (state?.finalAt || !best11Admits(readGate(state?.gateJson), offer.dpos, raw)) return null;
  await retryTransientWrite(() =>
    db
      .insert(best11Candidates)
      .values({
        careerId: offer.careerId,
        season,
        profileId: offer.profileId,
        dpos: offer.dpos!,
        retiredAt: offer.retiredAt,
        rawJson: JSON.stringify(raw),
        createdAt: now,
      })
      .onConflictDoUpdate({
        target: best11Candidates.careerId,
        set: { rawJson: JSON.stringify(raw), profileId: offer.profileId },
      }),
  );
  return (await recomputeBest11(db, season, now)) ? season : null;
}

/** 은퇴 PUT이 부른다: 이름이 공개된 은퇴 기록이면 후보로 낸다. 바뀐 시즌 id 또는 null. 실패는 삼키지 않는다(waitUntil이 삼킨다). */
export async function offerRetiredBest11(
  db: Db,
  career: { id: string; dpos: string | null },
  seasons: readonly StoredSeasonRow[],
  now: string,
): Promise<number | null> {
  // 경기 수 · 전성기 시즌 자격은 받아 둔 시즌으로 먼저 본다. 대부분의 은퇴는 여기서 끝나 D1 왕복이 늘지 않는다.
  if (!career.dpos || !best11Raw(career.dpos as DetailPos, toSeasons(seasons))) return null;
  const careerId = career.id;
  const [row] = await retryTransientRead(() =>
    db
      .select({
        profileId: careers.profileId,
        dpos: careers.dpos,
        serviceSeason: careers.serviceSeason,
        retiredAt: careers.retiredAt,
        ok: showableSql,
      })
      .from(careers)
      .where(eq(careers.id, careerId)),
  );
  if (!row?.ok || !row.retiredAt) return null;
  return offerBest11(
    db,
    {
      careerId,
      profileId: row.profileId,
      dpos: row.dpos as DetailPos | null,
      serviceSeason: row.serviceSeason,
      retiredAt: row.retiredAt,
      seasons,
    },
    now,
  );
}

const DPOS_ORDER: readonly DetailPos[] = [
  'GK',
  'CB',
  'SW',
  'LB',
  'RB',
  'LWB',
  'RWB',
  'FB',
  'DM',
  'CM',
  'AM',
  'LM',
  'RM',
  'LW',
  'RW',
  'W',
  'ST',
  'CF',
  'SS',
];

export type Best11DailyCursor = { season: number; dpos: number };

/**
 * 매일 단계 한 번: 마감한 시즌 확정 → 열린 시즌의 세부 포지션 SCAN_DPOS_PER_STEP개를 살펴 빠진 후보를 채운다 → 끝에 다시 채운다.
 * done이면 오늘 할 일을 다 했다. cursor는 다음 번에 이어 갈 자리.
 */
export async function runBest11Daily(
  db: Db,
  now: string,
  prior?: Best11DailyCursor,
): Promise<{ done: boolean; cursor?: Best11DailyCursor; finalized: number[]; added: number }> {
  const finalized: number[] = [];
  for (const s of SERVICE_SEASONS) {
    if (s.id < 1 || s.endsAt === null || s.endsAt > now) continue;
    const [state] = await retryTransientRead(() =>
      db
        .select({ finalAt: best11Seasons.finalAt })
        .from(best11Seasons)
        .where(eq(best11Seasons.season, s.id)),
    );
    if (state?.finalAt) continue;
    await recomputeBest11(db, s.id, now, true);
    finalized.push(s.id);
  }
  const open = SERVICE_SEASONS.find(
    (s) => s.id >= 1 && s.startsAt <= now && (s.endsAt === null || s.endsAt > now),
  );
  if (!open) return { done: true, finalized, added: 0 };
  // 살펴볼 은퇴가 있었던 세부 포지션만 센다(빈 포지션은 조회 한 번이라 한 번에 넘긴다).
  let next = prior?.season === open.id ? prior.dpos : 0;
  let added = 0;
  let worked = 0;
  while (next < DPOS_ORDER.length && worked < SCAN_DPOS_PER_STEP) {
    const r = await scanDpos(db, open.id, open.endsAt, DPOS_ORDER[next]!, now);
    added += r.added;
    if (r.read) worked++;
    next++;
  }
  if (next < DPOS_ORDER.length)
    return { done: false, cursor: { season: open.id, dpos: next }, finalized, added };
  // 다 살펴봤으면 한 번 다시 채운다(숨김 · 이름 비공개로 자격을 잃은 후보도 여기서 빠진다).
  await recomputeBest11(db, open.id, now);
  return { done: true, finalized, added };
}

/** 세부 포지션 하나: 레전드 상위 BEST11_SCAN명 중 아직 후보가 아닌 은퇴를 원점수로 매겨, 순위를 바꿀 수 있는 것만 넣는다. */
async function scanDpos(
  db: Db,
  season: number,
  endsAt: string | null,
  dpos: DetailPos,
  now: string,
): Promise<{ read: boolean; added: number }> {
  const cand = alias(best11Candidates, 'b11c');
  const rows = await retryTransientRead(() =>
    db
      .select({ id: careers.id, profileId: careers.profileId, retiredAt: careers.retiredAt })
      .from(careers)
      .where(
        and(
          showable,
          eq(careers.dpos, dpos),
          eq(careers.serviceSeason, season),
          endsAt ? lt(careers.retiredAt, endsAt) : undefined,
          notExists(
            db
              .select({ x: sql`1` })
              .from(cand)
              .where(eq(cand.careerId, careers.id)),
          ),
        ),
      )
      .orderBy(desc(careers.legendScore))
      .limit(BEST11_SCAN),
  );
  if (!rows.length) return { read: false, added: 0 };
  const [[state], seasonsById] = await Promise.all([
    retryTransientRead(() =>
      db.select().from(best11Seasons).where(eq(best11Seasons.season, season)),
    ),
    (async () => {
      const out = new Map<string, StoredSeasonRow[]>();
      for (const ids of chunks(rows.map((r) => r.id)))
        for (const [k, v] of await storedSeasonsOf(db, ids)) out.set(k, v);
      return out;
    })(),
  ]);
  if (state?.finalAt) return { read: true, added: 0 };
  const gate = readGate(state?.gateJson);
  const values: (typeof best11Candidates.$inferInsert)[] = [];
  for (const r of rows) {
    const raw = best11Raw(dpos, toSeasons(seasonsById.get(r.id) ?? []));
    if (!raw || !r.retiredAt || !best11Admits(gate, dpos, raw)) continue;
    values.push({
      careerId: r.id,
      season,
      profileId: r.profileId,
      dpos,
      retiredAt: r.retiredAt,
      rawJson: JSON.stringify(raw),
      createdAt: now,
    });
  }
  if (!values.length) return { read: true, added: 0 };
  await retryTransientWrite(() =>
    runBatch(
      db,
      chunks(values, 12).map((v) => db.insert(best11Candidates).values(v).onConflictDoNothing()),
    ),
  );
  await recomputeBest11(db, season, now);
  return { read: true, added: values.length };
}

function toPlayer(s: Best11Scored<Cand>): Best11Player {
  const { raw } = s.c;
  return {
    careerId: s.c.careerId,
    name: s.c.name,
    dpos: s.c.dpos,
    nation: s.c.nation,
    peak: s.c.peak,
    retiredAt: s.c.retiredAt,
    index: s.index,
    ind: s.ind,
    team: s.team,
    award: s.award,
    facts: {
      rating: raw.rawRating,
      apps: raw.apps,
      leagues: raw.leagues,
      ucl: raw.ucl,
      wc: raw.wc,
      ballon: raw.ballon,
      fifpro: raw.fifpro,
      posAwards: raw.posAwards,
    },
  };
}

/** 공개 조회: 11자리 · 자리별 상위 BEST11_TOP명(같은 구단주로 빠진 후보 표시) · 최근 변화. */
export async function readBest11(db: Db, season: number): Promise<Best11Response> {
  const inName = alias(careers, 'b11_in');
  const outName = alias(careers, 'b11_out');
  const [rows, stored, [state], changes] = await retryTransientRead(() =>
    db.batch([
      candidatesQuery(db, season),
      db.select().from(best11Slots).where(eq(best11Slots.season, season)),
      db.select().from(best11Seasons).where(eq(best11Seasons.season, season)),
      db
        .select({
          slot: best11Changes.slot,
          at: best11Changes.at,
          in: sql<
            string | null
          >`case when ${inName.nameHiddenAt} is null then ${inName.publicName} end`,
          out: sql<
            string | null
          >`case when ${outName.nameHiddenAt} is null then ${outName.publicName} end`,
        })
        .from(best11Changes)
        .leftJoin(inName, eq(inName.id, best11Changes.inCareerId))
        .leftJoin(outName, eq(outName.id, best11Changes.outCareerId))
        .where(eq(best11Changes.season, season))
        .orderBy(desc(best11Changes.at), desc(best11Changes.id))
        .limit(CHANGES),
    ]),
  );
  const valid = rows.map(toCand).filter((c): c is Cand => c !== null);
  const { rankings } = rankBest11(valid);
  const xi = new Map(stored.map((s) => [s.careerId, s.slot as Best11Slot]));
  const owners = new Set(valid.filter((c) => xi.has(c.careerId)).map((c) => c.ownerId));
  const scoredOf = (slot: Best11Slot, careerId: string) =>
    rankings[slot].find((s) => s.c.careerId === careerId);
  // 그라운드 카드는 구단주 팀 · 팀 프로필과 같은 선수 카드 값(등급 · 등번호 · 능력치 · 그림)으로 그린다. 11명만 한 번 더 읽는다.
  const shown = stored.filter((s) => scoredOf(s.slot as Best11Slot, s.careerId));
  const cardRows = await retryTransientRead(() =>
    careersByIds(
      db,
      shown.map((s) => s.careerId),
    ),
  );
  const cards = new Map(cardRows.map((r) => [r.id, teamPlayerCard(r)]));
  return {
    season,
    finalAt: state?.finalAt ?? null,
    updatedAt: state?.updatedAt ?? null,
    slots: BEST11_SLOTS.map((slot) => {
      const row = stored.find((s) => s.slot === slot);
      const scored = row && scoredOf(slot, row.careerId);
      return {
        slot,
        player: scored ? toPlayer(scored) : null,
        card: (scored && cards.get(row.careerId)) || null,
        since: scored ? row.since : null,
      };
    }),
    rankings: BEST11_SLOTS.filter((s) => s !== 'CB2').map((slot) => ({
      slot,
      entries: rankings[slot].slice(0, BEST11_TOP).map((s): Best11Ranked => ({
        ...toPlayer(s),
        held: xi.has(s.c.careerId) ? 'xi' : owners.has(s.c.ownerId) ? 'owner' : null,
        at: xi.get(s.c.careerId) ?? null,
      })),
    })),
    changes: changes.map((c): Best11Change => ({
      slot: c.slot as Best11Slot,
      at: c.at,
      in: c.in,
      out: c.out,
    })),
  };
}
