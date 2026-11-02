import { HIDDEN_MANAGER_NAME, HIDDEN_TEAM_NAME } from '@offside/contracts/board-limits';
import { and, asc, gt, isNotNull, isNull, lte } from 'drizzle-orm';
import type { Db } from '../client.js';
import { ownerTeams, profiles } from '../schema.js';

// T-11-616 새 이름 점검(apps/agents)이 읽는 "마지막 점검 뒤에 생기거나 바뀐" 공개 이름. 닉네임은 profiles.nickname_set_at,
// 구단 · 감독 이름은 owner_teams.name_changed_at(둘 다 부분 인덱스)으로만 찾는다. 이름을 가리거나 바꾸지 않는다(읽기 전용).

export type WatchedName = {
  kind: 'nickname' | 'team' | 'manager';
  /** nickname은 프로필 ID, team · manager는 구단(owner_teams.id) ID — 이름 신고의 대상 ID와 같다. */
  id: string;
  profileId: string;
  name: string;
  at: string;
};

type Row = { at: string; id: string; items: WatchedName[] };

const byTime = (a: Row, b: Row) =>
  a.at < b.at ? -1 : a.at > b.at ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

/**
 * (since, until] 사이에 생기거나 바뀐 이름을 시각순으로 limit개 행(구단 행은 이름 · 감독 두 줄)까지.
 * limit를 넘으면 truncated이고 next는 읽은 데까지의 시각이다. 같은 시각 행이 잘리지 않게 끝의 같은 시각 행은 다음으로 미룬다.
 * 넘지 않으면 next는 until이다.
 */
export async function listChangedNames(
  db: Db,
  since: string,
  until: string,
  limit: number,
): Promise<{ items: WatchedName[]; next: string; truncated: boolean }> {
  const [nicknames, teams] = await Promise.all([
    db
      .select({ id: profiles.id, name: profiles.nickname, at: profiles.nicknameSetAt })
      .from(profiles)
      .where(
        and(
          isNotNull(profiles.nicknameSetAt),
          gt(profiles.nicknameSetAt, since),
          lte(profiles.nicknameSetAt, until),
          isNotNull(profiles.nickname),
          isNull(profiles.deletedAt),
        ),
      )
      .orderBy(asc(profiles.nicknameSetAt))
      .limit(limit + 1),
    db
      .select({
        id: ownerTeams.id,
        profileId: ownerTeams.profileId,
        name: ownerTeams.name,
        manager: ownerTeams.manager,
        at: ownerTeams.nameChangedAt,
      })
      .from(ownerTeams)
      .where(
        and(
          isNotNull(ownerTeams.nameChangedAt),
          gt(ownerTeams.nameChangedAt, since),
          lte(ownerTeams.nameChangedAt, until),
        ),
      )
      .orderBy(asc(ownerTeams.nameChangedAt))
      .limit(limit + 1),
  ]);
  const rows: Row[] = [];
  for (const r of nicknames) {
    if (!r.at || !r.name) continue;
    rows.push({
      at: r.at,
      id: r.id,
      items: [{ kind: 'nickname', id: r.id, profileId: r.id, name: r.name, at: r.at }],
    });
  }
  for (const r of teams) {
    if (!r.at) continue;
    const base = { id: r.id, profileId: r.profileId, at: r.at };
    const items: WatchedName[] = [];
    if (r.name && r.name !== HIDDEN_TEAM_NAME) items.push({ ...base, kind: 'team', name: r.name });
    if (r.manager && r.manager !== HIDDEN_MANAGER_NAME)
      items.push({ ...base, kind: 'manager', name: r.manager });
    rows.push({ at: r.at, id: r.id, items });
  }
  rows.sort(byTime);
  if (rows.length <= limit)
    return { items: rows.flatMap((r) => r.items), next: until, truncated: false };
  let kept = rows.slice(0, limit);
  const last = kept[kept.length - 1]!.at;
  const before = kept.filter((r) => r.at !== last);
  // 같은 시각이 한도 끝에 걸쳐 있으면 그 시각 전체를 다음으로 미룬다(모두 같은 시각이면 그대로 둔다).
  if (before.length) kept = before;
  return {
    items: kept.flatMap((r) => r.items),
    next: kept[kept.length - 1]!.at,
    truncated: true,
  };
}
