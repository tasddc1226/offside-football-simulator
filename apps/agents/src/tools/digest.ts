// @ops 아침 보고 자료 한 번에 모으기(T-11-289 비용 절감): 예약 워크플로 지난 24시간 결과 · Worker cron 예정 ·
// Workers 로그 오류 집계 · 오늘 백업 기록. 조회를 여러 턴에 나눠 하지 않게 한 도구로 묶는다(읽기 전용).
import type { Tool } from '../claude.ts';
import { kstText } from '../cron.ts';
import { scheduleData, type ScheduleDeps } from './schedules.ts';

export type DigestDeps = ScheduleDeps & {
  /** d1_query 도구(읽기 전용)로 한 문장을 돌린다. */
  d1: (sql: string) => Promise<string>;
};

const DAY = 24 * 3600_000;
/** 백업 하루의 경계 UTC 19:00(KST 04:00). apps/api/src/cron/backup.ts와 같다. */
const BACKUP_START = 19 * 3600_000;

type Agg = { count: number; groups?: { key: string; value: string | number | boolean }[] };
type QueryResult = {
  success: boolean;
  errors?: { message: string }[];
  result?: { calculations?: { aggregates?: Agg[] }[] };
};

/** Workers 관측 로그 집계(calculations · count, groupBy). 실패는 문자열로 돌려준다. */
async function logCounts(
  d: DigestDeps,
  service: string,
  from: number,
  to: number,
  groupBy: string[],
  extra: { key: string; value: string }[] = [],
  limit = 30,
) {
  if (!d.cfToken) return { error: 'Cloudflare 토큰 없음' };
  const r = await (d.fetcher ?? fetch)(
    `https://api.cloudflare.com/client/v4/accounts/${d.accountId}/workers/observability/telemetry/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${d.cfToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        queryId: `digest-${service}-${groupBy.join('-')}`,
        timeframe: { from, to },
        view: 'calculations',
        dry: true,
        ignoreSeries: true,
        limit,
        parameters: {
          datasets: ['cloudflare-workers'],
          filters: [
            { key: '$metadata.service', operation: 'eq', type: 'string', value: service },
            ...extra.map((x) => ({ ...x, operation: 'eq', type: 'string' })),
          ],
          calculations: [{ operator: 'count' }],
          groupBys: groupBy.map((value) => ({ type: 'string', value })),
          // 묶음 수는 바깥 limit과 parameters.limit 둘 다 준다(안 주면 상위 10개만 온다).
          limit,
        },
      }),
    },
  );
  const data = (await r.json().catch(() => ({ success: false }))) as QueryResult;
  if (!data.success)
    return { error: data.errors?.map((e) => e.message).join('; ') || `HTTP ${r.status}` };
  return (data.result?.calculations?.[0]?.aggregates ?? [])
    .map((a) => ({
      ...Object.fromEntries(
        groupBy.map((k) => [
          k.replace('$metadata.', ''),
          String(a.groups?.find((g) => g.key === k)?.value ?? '(없음)').slice(0, 160),
        ]),
      ),
      count: a.count,
    }))
    .sort((a, b) => b.count - a.count);
}

const settle = async <T>(p: Promise<T>) =>
  p.then(
    (v) => v,
    (e: unknown) => ({ error: String(e instanceof Error ? e.message : e).slice(0, 200) }),
  );

export function digestTools(d: DigestDeps): Tool[] {
  return [
    {
      name: 'report_digest',
      description:
        '아침 주기 작업 보고 자료를 한 번에: GitHub 예약 워크플로마다 지난 24시간 결과 수 · 실패 링크 · 다음 실행, Worker cron 예정, Workers 로그(offside-api · offside-agents) 지난 24시간 job · 오류 문구별 오류 수 · offside-api job별 로그 수(로그가 없는 작업 찾기), 오늘 04:00 KST 백업 기록. 보고는 이것부터 부른다.',
      input_schema: { type: 'object', properties: {} },
      run: async () => {
        const now = Date.now();
        const from = now - DAY;
        const backupFrom = Math.floor((now - BACKUP_START) / DAY) * DAY + BACKUP_START;
        const err = [{ key: '$metadata.level', value: 'error' }];
        // job과 문구를 한 번에 묶으면 문구가 없는 JSON 로그가 빠진다(2026-10-16 확인). 따로 센다.
        const [sched, apiErr, apiMsg, agentErr, apiJobs, backup] = await Promise.all([
          settle(scheduleData(d, { runs: 40, sinceMs: from }).collect(now)),
          settle(logCounts(d, 'offside-api', from, now, ['job'], err, 20)),
          settle(logCounts(d, 'offside-api', from, now, ['$metadata.message'], err, 5)),
          settle(logCounts(d, 'offside-agents', from, now, ['$metadata.message'], err, 5)),
          settle(logCounts(d, 'offside-api', from, now, ['job'], [], 50)),
          settle(
            d.d1(
              "SELECT key, value FROM app_meta WHERE key IN ('cron:backup:last', 'cron:backup:state')",
            ),
          ),
        ]);
        const actions =
          'actions' in sched && Array.isArray(sched.actions)
            ? sched.actions.map((w) => {
                const runs = w.recent ?? [];
                const by: Record<string, number> = {};
                for (const x of runs) {
                  const k = x.conclusion ?? x.status;
                  by[k] = (by[k] ?? 0) + 1;
                }
                return {
                  name: w.name,
                  file: w.file,
                  crons_utc: w.crons_utc,
                  next_kst: w.next_kst?.[0],
                  last24h: by,
                  last_kst: runs[0]?.at_kst,
                  problems: runs
                    .filter(
                      (x) =>
                        x.conclusion && x.conclusion !== 'success' && x.conclusion !== 'skipped',
                    )
                    .slice(0, 5)
                    .map((x) => ({ at_kst: x.at_kst, conclusion: x.conclusion, url: x.url })),
                };
              })
            : sched;
        return JSON.stringify({
          now_kst: kstText(now),
          window_kst: [kstText(from), kstText(now)],
          actions,
          worker_crons: 'workers' in sched ? sched.workers : undefined,
          logs_24h: {
            'offside-api': { errors_by_job: apiErr, top_errors: apiMsg, logs_by_job: apiJobs },
            'offside-agents': { top_errors: agentErr },
          },
          backup: { since_kst: kstText(backupFrom), meta: backup },
        }).slice(0, 8_000);
      },
    },
  ];
}
