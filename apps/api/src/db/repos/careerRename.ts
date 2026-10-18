import type { Db } from '../client.js';

// T-11-377 선수 이름 변경권. 내 선수(카드가 있으면 지금 카드 주인 = 이적시장에서 산 선수 포함, 없으면 키운 사람)의 공개 이름을
// 변경권 한 장으로 바꾼다. 서버에 아직 올라가지 않은 진행 중 커리어는 장수만 빼고 기록을 남긴다(이름은 기기가 바꾸고 다음
// 시즌 업로드에 실린다). 운영자가 가린 이름(name_hidden_at)은 바꾸지 않는다.

/** 이 커리어를 바꿀 수 있는 사람인가(?1 = 커리어, ?2 = 프로필). 카드 주인 > 키운 사람 > 서버에 없는 커리어는 누구나(장수만 빠진다). */
const OWN = `CASE
    WHEN EXISTS (SELECT 1 FROM cards WHERE career_id = ?1)
      THEN EXISTS (SELECT 1 FROM cards WHERE career_id = ?1 AND owner_id = ?2)
    WHEN EXISTS (SELECT 1 FROM careers WHERE id = ?1)
      THEN EXISTS (SELECT 1 FROM careers WHERE id = ?1 AND profile_id = ?2)
    ELSE 1 END`;

const STATE_SQL = `SELECT (${OWN}) AS mine,
    EXISTS (SELECT 1 FROM careers WHERE id = ?1 AND name_hidden_at IS NOT NULL) AS hidden,
    (SELECT public_name FROM careers WHERE id = ?1) AS name,
    COALESCE((SELECT qty FROM owner_items WHERE profile_id = ?2 AND item = 'rename'), 0) AS qty`;

// 기록 → 차감 → 이름 순서의 한 batch(트랜잭션). 뒤의 두 문장은 기록이 들어갔을 때만 바뀐다(동시에 두 번 눌러도 한 장만).
const LOG_SQL = `INSERT INTO career_renames (id, career_id, profile_id, old_name, new_name, created_at)
  SELECT ?3, ?1, ?2, (SELECT public_name FROM careers WHERE id = ?1), ?4, ?5
  WHERE (${OWN})
    AND NOT EXISTS (SELECT 1 FROM careers WHERE id = ?1 AND name_hidden_at IS NOT NULL)
    AND EXISTS (SELECT 1 FROM owner_items WHERE profile_id = ?2 AND item = 'rename' AND qty > 0)`;
const SPEND_SQL = `UPDATE owner_items SET qty = qty - 1, updated_at = ?2
  WHERE profile_id = ?1 AND item = 'rename' AND qty > 0
    AND EXISTS (SELECT 1 FROM career_renames WHERE id = ?3)`;
const NAME_SQL = `UPDATE careers SET public_name = ?2
  WHERE id = ?1 AND name_hidden_at IS NULL
    AND EXISTS (SELECT 1 FROM career_renames WHERE id = ?3)`;
const QTY_SQL = `SELECT COALESCE((SELECT qty FROM owner_items WHERE profile_id = ? AND item = 'rename'), 0) AS qty`;

export type RenameResult =
  | { ok: true; rename: number }
  | { ok: false; reason: 'NOT_MINE' | 'HIDDEN' | 'SAME' | 'NO_RENAME' };

export async function renameCareer(
  db: Db,
  input: { careerId: string; profileId: string; name: string; now: string },
): Promise<RenameResult> {
  const d1 = db.$client;
  const { careerId, profileId, name, now } = input;
  const state = await d1
    .prepare(STATE_SQL)
    .bind(careerId, profileId)
    .first<{ mine: number; hidden: number; name: string | null; qty: number }>();
  if (!state?.mine) return { ok: false, reason: 'NOT_MINE' };
  if (state.hidden) return { ok: false, reason: 'HIDDEN' };
  if (state.name === name) return { ok: false, reason: 'SAME' };
  if (state.qty < 1) return { ok: false, reason: 'NO_RENAME' };
  const id = crypto.randomUUID();
  const results = await d1.batch<{ qty: number }>([
    d1.prepare(LOG_SQL).bind(careerId, profileId, id, name, now),
    d1.prepare(SPEND_SQL).bind(profileId, now, id),
    d1.prepare(NAME_SQL).bind(careerId, name, id),
    d1.prepare(QTY_SQL).bind(profileId),
  ]);
  // 읽은 뒤 다른 요청이 마지막 장을 썼거나 운영자가 가렸으면 아무것도 바뀌지 않는다.
  if (!results[0]?.meta.changes) return { ok: false, reason: 'NO_RENAME' };
  return { ok: true, rename: results[3]?.results[0]?.qty ?? 0 };
}
