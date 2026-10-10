import {
  ClubStrengthSnapshotSchema,
  StrengthRunSchema,
  type ClubStrengthSnapshot,
} from '@offside/contracts/club-strength';
import fallback from '@offside/contracts/club-strength-fallback';

export const STRENGTH_PATH = '/v1/club-strength';
export const STATE_KEY = 'club-strength:current';
export const RUN_PREFIX = 'club-strength:run:';
export const LOCK_KEY = 'club-strength:lock';
export type StrengthState = {
  snapshot: ClubStrengthSnapshot;
  completedDay?: string;
  inputs: Record<string, { hash: string; season: string; played?: number }>;
};
export async function readStrengthState(db: D1Database): Promise<StrengthState> {
  const row = await db
    .prepare('SELECT value FROM app_meta WHERE key=?')
    .bind(STATE_KEY)
    .first<{ value: string }>();
  if (!row) return { snapshot: ClubStrengthSnapshotSchema.parse(fallback), inputs: {} };
  const parsed = JSON.parse(row.value) as StrengthState;
  return { ...parsed, snapshot: ClubStrengthSnapshotSchema.parse(parsed.snapshot) };
}
export async function readStrengthHistory(db: D1Database, before?: string) {
  const { results } = await db
    .prepare('SELECT value FROM app_meta WHERE key>=? AND key<? ORDER BY key DESC LIMIT 31')
    .bind(RUN_PREFIX, before ? RUN_PREFIX + before : RUN_PREFIX + '~')
    .all<{ value: string }>();
  const runs = results.map((r) => StrengthRunSchema.parse(JSON.parse(r.value)));
  return {
    current: (await readStrengthState(db)).snapshot,
    runs: runs.slice(0, 30),
    nextBefore: runs.length > 30 ? runs[29]!.day : null,
  };
}
