import type { CompIconMap, CompNameMap } from '@offside/contracts';
import { eq, sql } from 'drizzle-orm';
import type { Db } from '../client.js';
import { compCustoms } from '../schema.js';
import {
  type ClubLogoStore,
  compIconPrefix,
  ORPHAN_GRACE_MS,
  sweepLogoObjects,
} from './clubCustom.js';

/**
 * T-11-684 대회 · 수상 이름과 리그 · 대회 로고. 구단 꾸미기(clubCustom.ts)와 같은 규칙이다: 통째로 바꾸고, 더 오래된
 * updatedAt의 쓰기는 무시한다. 로고 이미지는 R2(`comp-icons/<환경>/<프로필>/<uuid>.json`)에 두고 img_key가 가리킨다
 * (null = icons_json 안, '' = 로고 없음). 버킷이 없거나(로컬 · staging) off면 icons_json에 그대로 쓴다.
 */
export type CompCustom = { names: CompNameMap; icons: CompIconMap; updatedAt: string };

/** since가 저장된 updated_at과 같으면 그 기기가 이미 가진 값이라 names · icons를 읽지 않고 {}로 돌려준다(R2도 읽지 않는다). */
export async function getCompCustom(
  db: Db,
  profileId: string,
  since?: string,
  store?: ClubLogoStore,
): Promise<CompCustom | undefined> {
  const same = since ? sql`${compCustoms.updatedAt} = ${since}` : sql`0`;
  const [row] = await db
    .select({
      updatedAt: compCustoms.updatedAt,
      imgKey: compCustoms.imgKey,
      namesJson: sql<string | null>`case when ${same} then null else ${compCustoms.namesJson} end`,
      iconsJson: sql<string | null>`case when ${same} then null else ${compCustoms.iconsJson} end`,
    })
    .from(compCustoms)
    .where(eq(compCustoms.profileId, profileId));
  if (!row) return undefined;
  if (row.namesJson === null || row.iconsJson === null)
    return { names: {}, icons: {}, updatedAt: row.updatedAt };
  let icons = JSON.parse(row.iconsJson) as CompIconMap;
  if (row.imgKey) {
    // 객체를 못 읽으면 던진다(503) — 로고 빠진 값을 돌려주면 기기가 그걸 받아 자기 로고를 지운다.
    const object = store ? await store.bucket.get(row.imgKey) : null;
    if (!object) throw new Error('comp icon images are unavailable');
    icons = (await object.json()) as CompIconMap;
  }
  return { names: JSON.parse(row.namesJson) as CompNameMap, icons, updatedAt: row.updatedAt };
}

/** 최신 쓰기 우선. 결과로 서버에 남은 값을 돌려준다(무시됐으면 기존 값). */
export async function putCompCustom(
  db: Db,
  profileId: string,
  input: CompCustom,
  store?: ClubLogoStore,
): Promise<CompCustom> {
  const active = store && !store.off ? store : undefined;
  const has = Object.keys(input.icons).length > 0;
  const prefix = active ? compIconPrefix(active.environment, profileId) : '';
  // 이미지를 먼저 올리고 D1에 적는다 — 행이 가리키는 객체는 항상 있다. 진 쓰기의 객체는 아래에서 지운다.
  const imgKey = !active ? null : has ? `${prefix}${crypto.randomUUID()}.json` : '';
  if (active && imgKey)
    await active.bucket.put(imgKey, JSON.stringify(input.icons), {
      httpMetadata: { contentType: 'application/json' },
    });
  const values = {
    namesJson: JSON.stringify(input.names),
    iconsJson: active ? '{}' : JSON.stringify(input.icons),
    imgKey,
    updatedAt: input.updatedAt,
  };
  await db
    .insert(compCustoms)
    .values({ profileId, ...values })
    .onConflictDoUpdate({
      target: compCustoms.profileId,
      set: values,
      setWhere: sql`${compCustoms.updatedAt} <= ${input.updatedAt}`,
    });
  if (!active) return (await getCompCustom(db, profileId, undefined, store))!;
  const [row] = await db
    .select({ imgKey: compCustoms.imgKey, updatedAt: compCustoms.updatedAt })
    .from(compCustoms)
    .where(eq(compCustoms.profileId, profileId));
  const won = row?.imgKey === imgKey && row.updatedAt === input.updatedAt;
  // 정리는 최선 노력이다 — 실패해도 저장은 끝났고, 남은 객체는 다음 저장 때 다시 지운다.
  if (!won && imgKey) await active.bucket.delete(imgKey).catch(() => {});
  if (won) await sweepLogoObjects(active, prefix, imgKey || null, ORPHAN_GRACE_MS).catch(() => {});
  return won ? input : (await getCompCustom(db, profileId, undefined, store))!;
}

/** 프로필 삭제 batch용(프로필은 소프트 삭제라 FK CASCADE가 돌지 않는다). */
export const deleteCompCustomStatement = (db: Db, profileId: string) =>
  db.delete(compCustoms).where(eq(compCustoms.profileId, profileId));
