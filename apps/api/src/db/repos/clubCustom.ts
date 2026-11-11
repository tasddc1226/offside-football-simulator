import type { ClubCustomMap } from '@offside/contracts';
import { eq, sql } from 'drizzle-orm';
import type { Bindings } from '../../env.js';
import type { Db } from '../client.js';
import { clubCustoms } from '../schema.js';

/**
 * T-11-683 엠블럼 이미지 보관. 올린 이미지(data URL)는 한 프로필에 수백 KB라 D1에는 이름 · 글자 · 색만 남기고
 * 이미지는 R2(BACKUP 버킷 `club-logos/<환경>/<프로필>/<uuid>.json`, 구단 id → data URL)에 둔다. D1 행의 img_key가
 * 그 객체를 가리킨다: null = 옛 형식(이미지가 clubs_json 안에 그대로), '' = 이미지 없음.
 * 버킷이 없거나(로컬 · staging) off면 옛 형식으로 쓴다. 읽기는 두 형식을 모두 받는다.
 */
export type ClubLogoStore = { bucket: R2Bucket; environment: string; off?: boolean };
type ClubImgs = Record<string, string>;

export const clubLogoStoreOf = (env: Bindings): ClubLogoStore | undefined =>
  env.BACKUP
    ? {
        bucket: env.BACKUP,
        environment: env.ENVIRONMENT,
        off: env.CLUB_LOGO_R2_DISABLED === '1',
      }
    : undefined;

/** 갓 올린 객체는 아직 D1에 적히기 전일 수 있어 정리에서 건드리지 않는다. */
export const ORPHAN_GRACE_MS = 60 * 60_000;

export const clubLogoPrefix = (environment: string, profileId: string) =>
  `club-logos/${environment}/${profileId}/`;

/** T-11-684 리그 · 대회 로고(comp_customs)의 객체 자리. */
export const compIconPrefix = (environment: string, profileId: string) =>
  `comp-icons/${environment}/${profileId}/`;

/** 이미지를 떼어 낸 맵과 떼어 낸 이미지(구단 id → data URL). */
export function splitClubImgs(clubs: ClubCustomMap): { slim: ClubCustomMap; imgs: ClubImgs } {
  const slim: ClubCustomMap = {};
  const imgs: ClubImgs = {};
  for (const [id, club] of Object.entries(clubs)) {
    if (club.logo?.img === undefined) {
      slim[id] = club;
      continue;
    }
    const { img, ...logo } = club.logo;
    imgs[id] = img;
    slim[id] = { ...club, logo };
  }
  return { slim, imgs };
}

function mergeClubImgs(slim: ClubCustomMap, imgs: ClubImgs): ClubCustomMap {
  const out: ClubCustomMap = {};
  for (const [id, club] of Object.entries(slim)) {
    const img = imgs[id];
    out[id] = img !== undefined && club.logo ? { ...club, logo: { ...club.logo, img } } : club;
  }
  return out;
}

/** 이미지 객체를 읽는다. 없거나 깨졌으면 던진다(503) — 이미지 빠진 맵을 돌려주면 기기가 그걸 받아 다시 올려 이미지가 사라진다. */
async function loadImgs(store: ClubLogoStore | undefined, key: string): Promise<ClubImgs> {
  const object = store ? await store.bucket.get(key) : null;
  if (!object) throw new Error('club logo images are unavailable');
  return (await object.json()) as ClubImgs;
}

/** since가 저장된 updated_at과 같으면 그 기기가 이미 가진 값이라 clubs를 읽지 않고 {}로 돌려준다(T-11-156 — 엠블럼
 * 이미지가 든 맵이 수백 KB라 부팅마다 내려받지 않게). 이때는 R2도 읽지 않는다. */
export async function getClubCustom(
  db: Db,
  profileId: string,
  since?: string,
  store?: ClubLogoStore,
): Promise<{ clubs: ClubCustomMap; updatedAt: string } | undefined> {
  const [row] = await db
    .select({
      updatedAt: clubCustoms.updatedAt,
      imgKey: clubCustoms.imgKey,
      clubsJson: since
        ? sql<
            string | null
          >`case when ${clubCustoms.updatedAt} = ${since} then null else ${clubCustoms.clubsJson} end`
        : clubCustoms.clubsJson,
    })
    .from(clubCustoms)
    .where(eq(clubCustoms.profileId, profileId));
  if (!row) return undefined;
  if (row.clubsJson === null) return { clubs: {}, updatedAt: row.updatedAt };
  const clubs = JSON.parse(row.clubsJson) as ClubCustomMap;
  return {
    clubs: row.imgKey ? mergeClubImgs(clubs, await loadImgs(store, row.imgKey)) : clubs,
    updatedAt: row.updatedAt,
  };
}

/** prefix 아래(한 프로필의 한 종류) 이미지 객체 중 keep이 아닌 것을 지운다. graceMs 안에 올린 것은 둔다(다른 쓰기가 막 올린 것일 수 있다). */
export async function sweepLogoObjects(
  store: ClubLogoStore,
  prefix: string,
  keep: string | null,
  graceMs: number,
) {
  const listed = await store.bucket.list({ prefix });
  const stale = listed.objects
    .filter((o) => o.key !== keep && Date.now() - o.uploaded.getTime() >= graceMs)
    .map((o) => o.key);
  if (stale.length) await store.bucket.delete(stale);
}

/** 프로필을 지울 때 그 프로필의 이미지 객체(구단 엠블럼 · 리그 · 대회 로고)를 모두 지운다(응답 뒤, 실패해도 삭제는 끝났다). */
export async function deleteClubLogos(store: ClubLogoStore | undefined, profileId: string) {
  if (!store) return;
  await sweepLogoObjects(store, clubLogoPrefix(store.environment, profileId), null, 0);
  await sweepLogoObjects(store, compIconPrefix(store.environment, profileId), null, 0);
}

/** 최신 쓰기 우선: 저장된 updated_at보다 오래된 쓰기(늦게 도착한 다른 기기의 옛 변경)는 무시한다.
 * 결과로 서버에 남은 값을 돌려준다(무시됐으면 기존 값). */
export async function putClubCustom(
  db: Db,
  profileId: string,
  clubs: ClubCustomMap,
  updatedAt: string,
  store?: ClubLogoStore,
) {
  const active = store && !store.off ? store : undefined;
  const { slim, imgs } = active ? splitClubImgs(clubs) : { slim: clubs, imgs: {} };
  // 이미지를 먼저 올리고 D1에 적는다 — 행이 가리키는 객체는 항상 있다. 진 쓰기의 객체는 아래에서 지운다.
  const imgKey = !active
    ? null
    : Object.keys(imgs).length
      ? `${clubLogoPrefix(active.environment, profileId)}${crypto.randomUUID()}.json`
      : '';
  if (active && imgKey)
    await active.bucket.put(imgKey, JSON.stringify(imgs), {
      httpMetadata: { contentType: 'application/json' },
    });
  const clubsJson = JSON.stringify(slim);
  await db
    .insert(clubCustoms)
    .values({ profileId, clubsJson, updatedAt, imgKey })
    .onConflictDoUpdate({
      target: clubCustoms.profileId,
      set: { clubsJson, updatedAt, imgKey },
      setWhere: sql`${clubCustoms.updatedAt} <= ${updatedAt}`,
    });
  if (!active) return (await getClubCustom(db, profileId, undefined, store))!;
  const [row] = await db
    .select({ imgKey: clubCustoms.imgKey, updatedAt: clubCustoms.updatedAt })
    .from(clubCustoms)
    .where(eq(clubCustoms.profileId, profileId));
  const won = row?.imgKey === imgKey && row.updatedAt === updatedAt;
  // 정리는 최선 노력이다 — 실패해도 저장은 끝났고, 남은 객체는 다음 저장 때 다시 지운다.
  if (!won && imgKey) await active.bucket.delete(imgKey).catch(() => {});
  if (won)
    await sweepLogoObjects(
      active,
      clubLogoPrefix(active.environment, profileId),
      imgKey || null,
      ORPHAN_GRACE_MS,
    ).catch(() => {});
  return won ? { clubs, updatedAt } : (await getClubCustom(db, profileId, undefined, store))!;
}

/** 옛 형식 행 하나를 새 형식으로 옮긴다(cron 채우기). 그 사이 바뀌었으면 그대로 두고 false. */
export async function migrateClubCustomRow(
  d1: D1Database,
  store: ClubLogoStore,
  profileId: string,
): Promise<'moved' | 'empty' | 'skipped'> {
  const row = await d1
    .prepare(
      'SELECT clubs_json AS json, updated_at AS at FROM club_customs WHERE profile_id=?1 AND img_key IS NULL',
    )
    .bind(profileId)
    .first<{ json: string; at: string }>();
  if (!row) return 'skipped';
  const { slim, imgs } = splitClubImgs(JSON.parse(row.json) as ClubCustomMap);
  const has = Object.keys(imgs).length > 0;
  const key = has
    ? `${clubLogoPrefix(store.environment, profileId)}${crypto.randomUUID()}.json`
    : '';
  if (has)
    await store.bucket.put(key, JSON.stringify(imgs), {
      httpMetadata: { contentType: 'application/json' },
    });
  const done = await d1
    .prepare(
      'UPDATE club_customs SET clubs_json=?1, img_key=?2 WHERE profile_id=?3 AND updated_at=?4 AND img_key IS NULL',
    )
    .bind(JSON.stringify(slim), key, profileId, row.at)
    .run();
  if (done.meta.changes) return has ? 'moved' : 'empty';
  if (has) await store.bucket.delete(key).catch(() => {});
  return 'skipped';
}

/** 프로필 삭제 batch용(프로필은 소프트 삭제라 FK CASCADE가 돌지 않는다). */
export const deleteClubCustomStatement = (db: Db, profileId: string) =>
  db.delete(clubCustoms).where(eq(clubCustoms.profileId, profileId));
