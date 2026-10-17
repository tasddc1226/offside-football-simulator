/**
 * T-11-311 은퇴 상세 스냅샷(시즌별 기록·수상·여정, 한 명 6KB 안팎)은 D1이 아니라 R2(BACKUP 버킷)에 둔다.
 * D1 careers.snapshot_key가 객체를 가리키고, 그때 snapshot_json은 비어 있다. R2가 없거나(staging) 꺼져 있거나
 * 쓰기에 실패하면 예전처럼 snapshot_json에 둔다 — 읽는 쪽은 둘 다 본다. 키는 커리어마다 하나라 다시 써도 같은 객체다.
 * D1 백업(d1/…)에는 키만 남으므로 이 객체는 지우지 않는다. 계정 삭제 때만 함께 지운다.
 */
import type { Bindings } from './env.js';
import { logErrorText } from './logError.js';

export const SNAPSHOT_OFFLOAD_STATE_KEY = 'cron:snapshot-offload:state';
/** 5분마다 이만큼 옮긴다(12.2만 명이면 이틀 남짓). R2 쓰기는 한 번에 OFFLOAD_PARALLEL개씩. */
export const OFFLOAD_PAGE = 200;
const OFFLOAD_PARALLEL = 20;

type SnapshotEnv = Pick<Bindings, 'BACKUP' | 'ENVIRONMENT' | 'SNAPSHOT_R2_DISABLED'>;

const bucketOf = (env: SnapshotEnv) =>
  env.SNAPSHOT_R2_DISABLED === '1' ? undefined : (env.BACKUP ?? undefined);

export const snapshotKeyOf = (environment: string, careerId: string) =>
  `career-snapshots/${environment}/${encodeURIComponent(careerId)}.json`;

/** 스냅샷 JSON을 R2에 쓰고 키를 돌려준다. R2가 없거나 실패하면 null(호출한 쪽이 D1에 둔다). */
export async function putSnapshot(
  env: SnapshotEnv,
  careerId: string,
  json: string,
): Promise<string | null> {
  const bucket = bucketOf(env);
  if (!bucket) return null;
  const key = snapshotKeyOf(env.ENVIRONMENT, careerId);
  try {
    await bucket.put(key, json, { httpMetadata: { contentType: 'application/json' } });
    return key;
  } catch (e) {
    console.error(
      JSON.stringify({ level: 'error', job: 'snapshot-put', error: logErrorText(e, 300) }),
    );
    return null;
  }
}

/** D1에 남은 JSON이 있으면 그것을, 없으면 R2 객체를 읽는다. 상세가 없으면 null. */
export async function readSnapshotJson(
  env: Pick<Bindings, 'BACKUP'>,
  row: { snapshotJson: string | null; snapshotKey: string | null },
): Promise<string | null> {
  if (row.snapshotJson) return row.snapshotJson;
  if (!row.snapshotKey || !env.BACKUP) return null;
  const obj = await env.BACKUP.get(row.snapshotKey);
  return obj ? obj.text() : null;
}

/** 스냅샷의 획득 칭호 id(대표 칭호 · 외형 잠금 확인). */
export const titleIdsOf = (json: string | null): string[] =>
  json ? ((JSON.parse(json) as { titles?: { id: string }[] }).titles ?? []).map((t) => t.id) : [];

/** 계정 삭제로 지운 커리어의 스냅샷 객체. 없는 키를 지워도 된다. */
export async function deleteSnapshots(env: SnapshotEnv, careerIds: readonly string[]) {
  if (!env.BACKUP || !careerIds.length) return;
  const keys = careerIds.map((id) => snapshotKeyOf(env.ENVIRONMENT, id));
  for (let i = 0; i < keys.length; i += 1000) await env.BACKUP.delete(keys.slice(i, i + 1000));
}

export type OffloadResult = { moved: number; failed: number; bytes: number; done: boolean };

/**
 * 이 기능 전에 은퇴한 기록의 snapshot_json을 R2로 옮긴다. rowid 커서로 한 번만 훑고, 끝까지 가면 멈춘다
 * (그 뒤 R2 쓰기 실패로 D1에 남는 기록은 그대로 읽힌다). 채워진 snapshot_json을 바꾸는 쓰기는 없다(updateRetired는 빈 칸만 채운다).
 */
export async function runSnapshotOffload(
  env: SnapshotEnv & Pick<Bindings, 'DB'>,
  page = OFFLOAD_PAGE,
): Promise<OffloadResult | null> {
  if (!bucketOf(env)) return null;
  const db = env.DB;
  const raw = await db
    .prepare('SELECT value FROM app_meta WHERE key = ?')
    .bind(SNAPSHOT_OFFLOAD_STATE_KEY)
    .first<{ value: string }>();
  const state = raw ? (JSON.parse(raw.value) as { cursor: number; done?: boolean }) : { cursor: 0 };
  if (state.done) return null;
  const rows = await db
    .prepare(
      `SELECT rowid AS rid, id, snapshot_json AS json FROM careers
      WHERE rowid > ?1 AND snapshot_json IS NOT NULL ORDER BY rowid LIMIT ?2`,
    )
    .bind(state.cursor, page)
    .all<{ rid: number; id: string; json: string }>();
  const result: OffloadResult = { moved: 0, failed: 0, bytes: 0, done: false };
  const updates: D1PreparedStatement[] = [];
  for (let i = 0; i < rows.results.length; i += OFFLOAD_PARALLEL) {
    const slice = rows.results.slice(i, i + OFFLOAD_PARALLEL);
    const keys = await Promise.all(slice.map((r) => putSnapshot(env, r.id, r.json)));
    slice.forEach((r, j) => {
      const key = keys[j];
      if (!key) {
        result.failed++;
        return;
      }
      updates.push(
        db
          .prepare(
            'UPDATE careers SET snapshot_key = ?1, snapshot_json = NULL WHERE id = ?2 AND snapshot_json IS NOT NULL',
          )
          .bind(key, r.id),
      );
      result.moved++;
      result.bytes += r.json.length;
    });
  }
  if (updates.length) await db.batch(updates);
  // 실패한 행이 있으면 커서를 그대로 둔다 — 옮긴 행은 snapshot_json이 비어 다시 고르지 않고, 실패한 행만 다음 틱에 다시 옮긴다.
  result.done = rows.results.length < page && !result.failed;
  const next = {
    cursor: result.failed ? state.cursor : (rows.results.at(-1)?.rid ?? state.cursor),
    ...(result.done ? { done: true } : {}),
  };
  await db
    .prepare(
      'INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    )
    .bind(SNAPSHOT_OFFLOAD_STATE_KEY, JSON.stringify(next))
    .run();
  return result;
}
