// Private RPC entrypoint. Only the API's authenticated admin route binds to this class.
import { WorkerEntrypoint } from 'cloudflare:workers';
import type { Env } from './env.ts';
import { repoReadToken } from './github.ts';
import { scheduleData } from './tools/schedules.ts';
import { logCounts } from './tools/digest.ts';

export class ScheduleDashboard extends WorkerEntrypoint<Env> {
  async snapshot() {
    const now = Date.now();
    const deps = {
      repo: this.env.GITHUB_REPO,
      githubToken: repoReadToken(this.env),
      accountId: this.env.CF_ACCOUNT_ID,
      cfToken: this.env.CF_MCP_TOKEN,
      workers: ['offside-api', 'offside-agents'],
    };
    const [data, errors] = await Promise.all([
      scheduleData(deps, { dashboard: true }).collect(now),
      Promise.all(
        deps.workers.map(async (worker) => {
          const query = (groups: string[]) =>
            logCounts(deps, worker, now - 86400000, now, groups, [
              { key: '$metadata.level', value: 'error' },
            ]).catch(() => null);
          const [rows, total] = await Promise.all([query(['job']), query([])]);
          return {
            worker,
            total: Array.isArray(total) ? (total[0]?.count ?? 0) : null,
            jobs: Array.isArray(rows)
              ? rows.map((r) => ({ job: String(r.job), count: r.count }))
              : null,
          };
        }),
      ),
    ]);
    return {
      actions: Array.isArray(data.actions)
        ? data.actions.map((w) => ({
            name: w.name,
            crons: w.crons_utc,
            next: w.next_kst,
            recent: w.recent.map((r) => ({ at: r.at_kst, result: r.conclusion ?? r.status })),
          }))
        : null,
      workers: Array.isArray(data.workers)
        ? data.workers.map((w) => ({
            name: 'worker' in w && w.worker ? w.worker : 'Cloudflare Workers',
            crons: 'crons_utc' in w ? (w.crons_utc ?? []) : [],
            next: 'next_kst' in w ? (w.next_kst ?? []) : [],
            recent: [],
            available: !('error' in w),
          }))
        : null,
      activity: await Promise.all(
        deps.workers.map(async (worker) => {
          const registered = Array.isArray(data.workers)
            ? data.workers.find((w) => 'worker' in w && w.worker === worker)
            : null;
          const crons = registered && 'crons_utc' in registered ? registered.crons_utc : undefined;
          const events =
            crons && deps.cfToken
              ? await recentActivity(deps.accountId, deps.cfToken, worker, crons, now).catch(
                  () => null,
                )
              : null;
          return { worker, events };
        }),
      ),
      errors,
    };
  }
}

async function recentActivity(
  account: string,
  token: string,
  worker: string,
  crons: string[],
  now: number,
) {
  if (!crons.length) return [];
  const eq = (key: string, value: string) => ({ key, value, operation: 'eq', type: 'string' });
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${account}/workers/observability/telemetry/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        queryId: 'admin-schedule-activity',
        timeframe: { from: now - 86400000, to: now },
        view: 'events',
        dry: true,
        limit: 20,
        parameters: {
          datasets: ['cloudflare-workers'],
          filters: [
            eq('$metadata.service', worker),
            {
              kind: 'group',
              filterCombination: 'or',
              filters: crons.map((cron) => eq('$metadata.trigger', cron)),
            },
          ],
        },
      }),
    },
  );
  const data = (await res.json()) as {
    success: boolean;
    result?: {
      events?: {
        events?: Array<{
          timestamp: number;
          source?: { job?: string; step?: string; level?: string };
          $metadata?: { trigger?: string; level?: string };
          $workers?: { outcome?: string };
        }>;
      };
    };
  };
  const events = data.result?.events?.events;
  if (!res.ok || !data.success || !Array.isArray(events)) return null;
  return events
    .map((e) => ({
      at: e.timestamp,
      cron: e.$metadata?.trigger ?? '',
      job: (e.source?.job === 'cron-step' ? e.source.step : e.source?.job) ?? null,
      result:
        e.source?.level === 'error' || e.$metadata?.level === 'error'
          ? 'error'
          : (e.$workers?.outcome ?? 'observed'),
    }))
    .sort((a, b) => b.at - a.at);
}
