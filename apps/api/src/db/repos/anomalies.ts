import { actionEntry } from './automationEnforcement.js';
import type { AnomalyCareer, AnomalyReason, AnomalyReport, SeasonGrowth } from '@offside/contracts';
import { eq } from 'drizzle-orm';
import { OVR_CAP_BY_AGE, ovrCapAt } from '../../plausibility.js';
import { createDb } from '../client.js';
import { runBatch } from './batch.js';
import { hideCareerStatements, resetFirstsBackfillStatement, setMeta } from './firsts.js';
import { appMeta, careers } from '../schema.js';

// 비정상 기록 정기 점검(매일 cron, 운영자 화면). 서버가 이미 받아 둔 시즌 기록만으로 게임에서 나올 수 없는 흐름을 찾는다.
// 확실한 것(숨김)과 애매한 것(검토)을 나눈다 — 자동으로 내리는 건 사람이 낼 수 없는 값뿐이고, 정상 선수일 수도 있는 높은
// 값은 운영자가 보고 정한다. 운영 실측(커리어 1만 2천 개)이 근거다: 시즌 간 OVR 최대 상승 22, 나이별 OVR 최고 78/84/88(만
// 18/19/20세), 정상 레전드 점수 상위 3,300 안팎. 조작이 확인된 두 커리어는 만 18세 OVR 99 · 레전드 점수 4,480대였다.
// 운영자가 되돌린 커리어(app_meta `anomaly_cleared:<id>`)는 다시 걸지 않는다.

export const ANOMALY = {
  /** 한 시즌에 이만큼 이상 오르면 숨긴다(정상 최대 22 위). */
  jump: 25,
  /** 나이별 OVR 상한(plausibility)을 이만큼 넘으면 숨긴다. 못 넘더라도 상한 위면 검토로 올린다. 정상 선수는 상한을 한 번도 넘지 않았다(T-11-037 실측). */
  farMargin: 2,
  /** 은퇴 레전드 점수가 이 이상이면 검토로 올린다. */
  legend: 3600,
  /** 은퇴 레전드 점수가 이 이상이면 숨긴다(정상 최고 3,300대보다 20% 이상 위). */
  legendHide: 4000,
  /** T-11-097 성장 기록에서 시즌 안 한 구간(시작 → 구간마다 → 시즌 끝)에 이만큼 이상 오르면 숨긴다. 운영 32만 시즌 실측에서
   * 정상은 구간 사이 14·마지막 구간 13이 최대였고, 세이브를 고친 커리어는 23 이상이었다. */
  growthStep: 20,
  /** T-11-097 시즌 시작 OVR이 지난해 시즌의 저장된 OVR보다 이만큼 이상 높으면 숨긴다. 정상은 시즌 사이(노쇠·재평가)에 한 번도
   * 오르지 않았다(29만 번) — 오르는 건 서버가 상한으로 잘라 저장한 지난 시즌뿐이다. */
  growthCarry: 5,
} as const;

export const SWEPT_AT_KEY = 'anomaly_sweep_at';
const CLEARED_PREFIX = 'anomaly_cleared:';
const clearedKey = (careerId: string) => `${CLEARED_PREFIX}${careerId}`;
const HOUR_MS = 3_600_000;
const LIST_LIMIT = 100;

type Info = {
  id: string;
  status: 'active' | 'retired';
  legend_score: number | null;
  peak: number | null;
  hidden: number;
};
type Found = Map<string, { info: Info; reasons: Set<AnomalyReason> }>;

/** 시즌 한 줄(나이·OVR·직전 시즌 대비 상승)의 이유. 저장된 행의 `ovrFar`·`ovrHigh`는 상한으로 자르기 전(T-11-023 이전) 기록에만 남는다. */
export function seasonReasons(age: number, ovr: number, jump: number | null): AnomalyReason[] {
  const out: AnomalyReason[] = [];
  const over = ovr - ovrCapAt(age);
  if (over > ANOMALY.farMargin) out.push('ovrFar');
  else if (over > 0) out.push('ovrHigh');
  if (jump !== null && jump >= ANOMALY.jump) out.push('jump');
  return out;
}

/** 나이별 상한이 있는 나이(만 18~23세)와 그중 가장 낮은 상한 — 이보다 높은 OVR만 SQL에서 가져온다. */
const CAPPED_BELOW_AGE = 18 + OVR_CAP_BY_AGE.length;
const LOWEST_CAP = OVR_CAP_BY_AGE[0]!;

/** since(ISO) 이후 시즌이 올라온 커리어만 훑는다(빈 문자열 = 전부, 숨긴 커리어 포함). 은퇴 레전드 점수는 전부 훑을 때만 본다. */
async function findAnomalies(d1: D1Database, since: string): Promise<Found> {
  const found: Found = new Map();
  const note = (info: Info, reason: AnomalyReason) => {
    const f = found.get(info.id) ?? { info, reasons: new Set() };
    found.set(info.id, f);
    f.reasons.add(reason);
  };
  const columns = `c.id, c.status, c.legend_score, c.peak, c.hidden`;
  const [seasons, legends] = await Promise.all([
    d1
      .prepare(
        `WITH s AS (
           SELECT career_id, age, ovr, ovr - LAG(ovr) OVER (PARTITION BY career_id ORDER BY year) AS jump
           FROM career_seasons
           ${since ? `WHERE career_id IN (SELECT DISTINCT career_id FROM career_seasons WHERE created_at >= ?)` : ''}
         )
         SELECT ${columns}, s.age, s.ovr, s.jump FROM s JOIN careers c ON c.id = s.career_id
         WHERE s.jump >= ? OR (s.age < ? AND s.ovr > ?)`,
      )
      .bind(...(since ? [since] : []), ANOMALY.jump, CAPPED_BELOW_AGE, LOWEST_CAP)
      .all<Info & { age: number; ovr: number; jump: number | null }>(),
    since
      ? undefined
      : d1
          .prepare(
            `SELECT ${columns} FROM careers c WHERE c.status = 'retired' AND c.legend_score >= ?`,
          )
          .bind(ANOMALY.legend)
          .all<Info>(),
  ]);
  for (const r of seasons.results)
    for (const reason of seasonReasons(r.age, r.ovr, r.jump)) note(r, reason);
  for (const r of legends?.results ?? []) note(r, 'legend');
  return found;
}

/** 숨기지 않았고 운영자가 되돌려 두지도 않은, 점검 대상으로 남은 커리어. */
const openOnly = (found: Found, cleared: Set<string>) =>
  [...found.values()].filter((f) => !f.info.hidden && !cleared.has(f.info.id));

/** 운영자가 되돌려 둔 커리어 id. 자동 점검과 검토 목록에서 뺀다. */
async function clearedIds(d1: D1Database): Promise<Set<string>> {
  const { results } = await d1
    .prepare(`SELECT key FROM app_meta WHERE key LIKE ?1`)
    .bind(`${CLEARED_PREFIX}%`)
    .all<{ key: string }>();
  return new Set(results.map((r) => r.key.slice(CLEARED_PREFIX.length)));
}

export type SweepResult = {
  /** 이번 점검이 숨긴 커리어 수. */
  hidden: number;
  /** 숨기지 않고 검토로 남은 수. */
  review: number;
  /** 숨긴 커리어 id 앞 8자리와 이유(로그용). */
  detail: { career: string; reasons: AnomalyReason[] }[];
};

/** 시즌 값이 나이별 OVR 상한을 크게 넘으면 true. 서버는 저장할 때 값을 상한으로 자르므로(sanitizeSeason) 저장된 행에는 이 신호가
 * 남지 않는다 — 올라오는 순간에 본다. */
export const exceedsOvrCap = (age: number, ovr: number): boolean =>
  ovr - ovrCapAt(age) > ANOMALY.farMargin;

/**
 * T-11-097 시즌 성장 기록에 세이브를 고친 흔적이 있으면 true. 저장된 OVR은 나이별 상한으로 잘리고(만 24세부터는 99까지 그대로)
 * 매일 점검은 시즌 사이 상승만 보므로, 시즌 중간에 능력치를 올린 기록은 올라오는 순간 성장 기록으로만 알 수 있다.
 * endOvr는 자르기 전 시즌 끝 OVR, prevOvr는 지난해 시즌의 저장된 OVR(없으면 null). 구간 기록이 없으면 시즌 전체 성장과
 * 구분할 수 없어 구간 검사는 건너뛴다.
 */
export function growthTampered(
  growth: SeasonGrowth | undefined,
  endOvr: number,
  prevOvr: number | null,
): boolean {
  if (!growth) return false;
  if (prevOvr !== null && growth.o0 - prevOvr >= ANOMALY.growthCarry) return true;
  if (!growth.ph.length) return false;
  let at = growth.o0;
  for (const v of [...growth.ph, endOvr]) {
    if (v - at >= ANOMALY.growthStep) return true;
    at = v;
  }
  return false;
}

/** cron 한 번의 D1 batch에 담는 커리어 수(커리어마다 문장 4개). */
const HIDE_CHUNK = 20;

/** 마지막 점검(app_meta) 이후 시즌이 올라온 커리어를 점검해 확실한 것은 숨긴다. 처음 도는 날은 전부 훑는다. */
export async function sweepAnomalies(d1: D1Database, now: number): Promise<SweepResult> {
  const db = createDb(d1);
  const [last] = await db
    .select({ value: appMeta.value })
    .from(appMeta)
    .where(eq(appMeta.key, SWEPT_AT_KEY));
  // 점검이 밀려도 놓치지 않게 한 시간 겹친다.
  const since = last ? new Date(Date.parse(last.value) - HOUR_MS).toISOString() : '';
  const [found, cleared] = await Promise.all([findAnomalies(d1, since), clearedIds(d1)]);
  const open = openOnly(found, cleared);
  const toHide = open.filter(
    (f) =>
      f.reasons.has('ovrFar') ||
      f.reasons.has('jump') ||
      (f.reasons.has('legend') && (f.info.legend_score ?? 0) >= ANOMALY.legendHide),
  );
  for (let i = 0; i < toHide.length; i += HIDE_CHUNK)
    await runBatch(
      db,
      toHide.slice(i, i + HIDE_CHUNK).flatMap((f) => hideCareerStatements(db, f.info.id)),
    );
  await setMeta(db, SWEPT_AT_KEY, new Date(now).toISOString());
  return {
    hidden: toHide.length,
    review: open.length - toHide.length,
    detail: toHide.map((f) => ({ career: f.info.id.slice(0, 8), reasons: [...f.reasons] })),
  };
}

const toCareer = (info: Info, reasons: Iterable<AnomalyReason>): AnomalyCareer => ({
  careerId: info.id,
  status: info.status,
  legendScore: info.legend_score,
  peak: info.peak,
  reasons: [...reasons],
});

/** `GET /v1/admin/anomalies`. 운영자가 열 때만 전부 훑는다(시즌 표를 한 번만 읽는다). */
export async function anomalyReport(d1: D1Database, now: number): Promise<AnomalyReport> {
  const [found, cleared, hiddenRows] = await Promise.all([
    findAnomalies(d1, ''),
    clearedIds(d1),
    d1
      .prepare(
        `SELECT id, status, legend_score, peak, hidden FROM careers WHERE hidden = 1 ORDER BY legend_score DESC LIMIT ?`,
      )
      .bind(LIST_LIMIT)
      .all<Info>(),
  ]);
  const byScore = (a: AnomalyCareer, b: AnomalyCareer) =>
    (b.legendScore ?? 0) - (a.legendScore ?? 0);
  return {
    generatedAt: new Date(now).toISOString(),
    review: openOnly(found, cleared)
      .map((f) => toCareer(f.info, f.reasons))
      .sort(byScore)
      .slice(0, LIST_LIMIT),
    hidden: hiddenRows.results.map((r) => toCareer(r, found.get(r.id)?.reasons ?? [])),
  };
}

/** 운영자가 커리어를 숨기거나 되돌린다. 되돌리면 자동 점검이 다시 걸지 않고, 비워 둔 기록 자리는 다시 훑어 채운다.
 * 없으면 false. 이미 그 상태면 아무것도 바꾸지 않는다. */
export async function setCareerHidden(
  d1: D1Database,
  careerId: string,
  hidden: boolean,
  now: number,
): Promise<boolean> {
  const db = createDb(d1);
  const [row] = await db
    .select({ hidden: careers.hidden })
    .from(careers)
    .where(eq(careers.id, careerId));
  if (!row) return false;
  if (!!row.hidden === hidden) return true;
  const entry = actionEntry(careerId, hidden ? 'hide' : 'restore', 'admin', [], 0, now);
  await runBatch(db, [
    db.insert(appMeta).values(entry).onConflictDoNothing(),
    ...(hidden
      ? [
          ...hideCareerStatements(db, careerId),
          db.delete(appMeta).where(eq(appMeta.key, clearedKey(careerId))),
        ]
      : [
          db.update(careers).set({ hidden: 0 }).where(eq(careers.id, careerId)),
          setMeta(db, clearedKey(careerId), new Date(now).toISOString()),
          resetFirstsBackfillStatement(db),
        ]),
  ]);
  return true;
}
