import type { Bindings } from '../env.js';
import { clubLogoStoreOf, migrateClubCustomRow } from '../db/repos/clubCustom.js';

/**
 * T-11-683 옛 형식 구단 꾸미기(엠블럼 이미지가 D1 clubs_json 안에 든 행)를 R2로 옮기는 한 번짜리 채우기.
 * 매일 단계에서 PK 순서로 조금씩 옮기고 app_meta에 위치를 적는다. 끝까지 가면 done으로 남아 그 뒤로는 읽기 한 번뿐이다.
 * 표 전체를 훑지 않는다 — 목록은 PK 인덱스만 읽고, 행은 하나씩 읽는다(한 행이 수백 KB라 한 번에 적게).
 */
export const CLUB_LOGO_MOVE_KEY = 'cron:club-logos:move';
export type ClubLogoMove = {
  cursor: string;
  done: boolean;
  moved: number;
  empty: number;
  skipped: number;
};

export async function moveClubLogos(env: Bindings, limit = 25): Promise<ClubLogoMove | 'skipped'> {
  const store = clubLogoStoreOf(env);
  if (!store || store.off) return 'skipped';
  const saved = await env.DB.prepare('SELECT value FROM app_meta WHERE key=?1')
    .bind(CLUB_LOGO_MOVE_KEY)
    .first<{ value: string }>();
  const state: ClubLogoMove = saved
    ? (JSON.parse(saved.value) as ClubLogoMove)
    : { cursor: '', done: false, moved: 0, empty: 0, skipped: 0 };
  if (state.done) return state;
  const { results } = await env.DB.prepare(
    'SELECT profile_id AS id FROM club_customs WHERE profile_id > ?1 ORDER BY profile_id LIMIT ?2',
  )
    .bind(state.cursor, limit)
    .all<{ id: string }>();
  for (const { id } of results) {
    state[await migrateClubCustomRow(env.DB, store, id)]++;
    state.cursor = id;
  }
  state.done = results.length < limit;
  await env.DB.prepare(
    'INSERT INTO app_meta(key,value) VALUES (?1,?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
  )
    .bind(CLUB_LOGO_MOVE_KEY, JSON.stringify(state))
    .run();
  return state;
}
