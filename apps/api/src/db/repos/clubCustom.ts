import type { ClubCustomMap } from '@offside/contracts';
import { eq, sql } from 'drizzle-orm';
import type { Db } from '../client.js';
import { clubCustoms } from '../schema.js';

/** since가 저장된 updated_at과 같으면 그 기기가 이미 가진 값이라 clubs를 읽지 않고 {}로 돌려준다(T-11-156 — 엠블럼
 * 이미지가 든 맵이 수백 KB라 부팅마다 내려받지 않게). */
export async function getClubCustom(
  db: Db,
  profileId: string,
  since?: string,
): Promise<{ clubs: ClubCustomMap; updatedAt: string } | undefined> {
  const [row] = await db
    .select({
      updatedAt: clubCustoms.updatedAt,
      clubsJson: since
        ? sql<
            string | null
          >`case when ${clubCustoms.updatedAt} = ${since} then null else ${clubCustoms.clubsJson} end`
        : clubCustoms.clubsJson,
    })
    .from(clubCustoms)
    .where(eq(clubCustoms.profileId, profileId));
  return row
    ? {
        clubs: row.clubsJson === null ? {} : (JSON.parse(row.clubsJson) as ClubCustomMap),
        updatedAt: row.updatedAt,
      }
    : undefined;
}

/** 최신 쓰기 우선: 저장된 updated_at보다 오래된 쓰기(늦게 도착한 다른 기기의 옛 변경)는 무시한다.
 * 결과로 서버에 남은 값을 돌려준다(무시됐으면 기존 값). */
export async function putClubCustom(
  db: Db,
  profileId: string,
  clubs: ClubCustomMap,
  updatedAt: string,
) {
  const clubsJson = JSON.stringify(clubs);
  await db
    .insert(clubCustoms)
    .values({ profileId, clubsJson, updatedAt })
    .onConflictDoUpdate({
      target: clubCustoms.profileId,
      set: { clubsJson, updatedAt },
      setWhere: sql`${clubCustoms.updatedAt} <= ${updatedAt}`,
    });
  return (await getClubCustom(db, profileId))!;
}

/** 프로필 삭제 batch용(프로필은 소프트 삭제라 FK CASCADE가 돌지 않는다). */
export const deleteClubCustomStatement = (db: Db, profileId: string) =>
  db.delete(clubCustoms).where(eq(clubCustoms.profileId, profileId));
