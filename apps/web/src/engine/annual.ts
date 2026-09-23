import {
  AnnualRunResponseSchema,
  AnnualReportSchema,
  GetCareerResponseSchema,
  type AnnualRunResponse,
  type AnnualReportView,
  type PlayerDraft,
} from '@offside/contracts';
import { loadRuleset, loadRetirementArtifacts } from '@offside/content';
import { importCareerFromServer } from '@offside/engine-client';
import type { AnnualPolicy } from '@offside/domain';
import { apiFetch, getProfile, getRemoteCareer } from '../api/client.js';
import { queryClient } from '../shared/query-client.js';
import { getAppEngine } from './engine.js';
import { assertNotPendingDelete, pendingDeleteKey } from './pending-delete.js';

export const annualPair = (value: { rulesetVersion: string; contentPackVersion: string }) =>
  value.rulesetVersion === '3.5.0' && value.contentPackVersion === '0.14.0';

/** An intent belongs to the profile that displayed it, not whichever cookie a late retry sees. */
export async function assertAnnualOwner(owner: string, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw new Error('화면이 변경되어 요청을 중단했습니다.');
  const engine = await getAppEngine();
  const localOwner = await engine.store.transaction('readonly', (tx) =>
    tx.kv.get<string>('profile:id'),
  );
  if (localOwner !== owner) throw new Error('프로필이 변경되었습니다. 화면을 다시 열어 주세요.');
  const profile = await getProfile();
  if (!profile.ok) throw new Error(profile.error.message);
  const currentOwner = await engine.store.transaction('readonly', (tx) =>
    tx.kv.get<string>('profile:id'),
  );
  if (profile.data.id !== owner || currentOwner !== owner || signal?.aborted)
    throw new Error('프로필이 변경되었습니다. 화면을 다시 열어 주세요.');
}

export async function cacheAnnualCareer(
  owner: string,
  careerId: string,
  signal?: AbortSignal,
  invalidate = true,
) {
  const engine = await getAppEngine();
  await assertNotPendingDelete(engine.store, careerId);
  await assertAnnualOwner(owner, signal);
  const response = await getRemoteCareer(careerId);
  if (!response.ok) throw Object.assign(new Error(response.error.message), {code: response.error.code});
  await assertAnnualOwner(owner, signal);
  const imported = await importCareerFromServer(engine.store, response.data, {
    now: new Date().toISOString(),
    ownerProfileId: owner,
    expectedProfileId: owner,
    pendingDeleteKey,
    rulesetForVersion: loadRuleset,
    retirementArtifacts: (versions) =>
      loadRetirementArtifacts(versions.rulesetVersion, versions.contentPackVersion),
  });
  if (!imported.ok) throw Object.assign(new Error(imported.error.message), { code: imported.error.code });
  if (invalidate) {
    await queryClient.invalidateQueries({ queryKey: ['career', careerId] });
    await queryClient.invalidateQueries({ queryKey: ['careers'] });
  }
  return response.data;
}

export async function createAnnualPlayer(
  owner: string,
  draft: PlayerDraft,
  key: string,
  signal?: AbortSignal,
) {
  await assertAnnualOwner(owner, signal);
  const result = await apiFetch(
    '/v1/careers/server',
    {
      method: 'POST',
      body: JSON.stringify({ expectedProfileId: owner, draft }),
      headers: { 'Idempotency-Key': key },
      ...(signal ? { signal } : {}),
    },
    GetCareerResponseSchema,
  );
  if (!result.ok) throw new Error(result.error.message);
  await assertAnnualOwner(owner, signal);
  // The receipt can be old after a retry; import the canonical GET, never the receipt snapshot.
  return cacheAnnualCareer(owner, result.data.snapshot.careerId, signal);
}

export function isForwardAnnual(
  current: AnnualRunResponse | null,
  incoming: AnnualRunResponse,
): boolean {
  if (!current) return true;
  if (
    current.run.careerId !== incoming.run.careerId ||
    incoming.run.careerRevision < current.run.careerRevision
  )
    return false;
  return current.run.id !== incoming.run.id || incoming.run.revision >= current.run.revision;
}

/** One controller per mounted owner/career; no timers or work survive dispose(). */
export class AnnualController {
  readonly abort = new AbortController();
  current: AnnualRunResponse | null = null;
  private running: Promise<AnnualRunResponse | null> | null = null;
  private exclusively(work: () => Promise<AnnualRunResponse | null>) {
    if (this.running) return this.running;
    this.running = work().finally(() => {
      this.running = null;
    });
    return this.running;
  }
  constructor(
    readonly owner: string,
    readonly careerId: string,
    readonly update: (value: AnnualRunResponse | null) => void,
  ) {}
  dispose() {
    this.abort.abort();
  }
  async check() {
    await assertAnnualOwner(this.owner, this.abort.signal);
  }
  async refresh() {
    await this.check();
    const response = await apiFetch<unknown>(`/v1/careers/${this.careerId}/annual-runs/current`, {
      signal: this.abort.signal,
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(response.error.message);
    await this.check();
    const value = response.data === null ? null : AnnualRunResponseSchema.parse(response.data);
    if (value && value.run.careerId !== this.careerId) throw new Error('다른 커리어의 응답을 사용하지 않았습니다.');
    if (value && !isForwardAnnual(this.current, value))
      throw new Error('서버의 최신 진행 상태를 다시 확인해 주세요.');
    this.current = value;
    this.update(value);
    return value;
  }
  async post(path: string, body: object, key: string) {
    await this.check();
    const response = await apiFetch(
      `/v1/careers/${this.careerId}/${path}`,
      {
        method: 'POST',
        signal: this.abort.signal,
        headers: { 'Idempotency-Key': key },
        body: JSON.stringify(body),
      },
      AnnualRunResponseSchema,
    );
    if (!response.ok) throw new Error(response.error.message);
    await this.check();
    // Always reread canonical state: concurrent tabs and durable receipt replay can be ahead of us.
    return this.refresh();
  }
  async start(revision: number, policy: AnnualPolicy) {
    return this.exclusively(async () => {
      await this.post(
        'annual-runs',
        { expectedCareerRevision: revision, policy },
        `annual-start-${this.careerId}-${revision}`,
      );
      return this.pump();
    });
  }
  async choose(choiceId: string) {
    return this.exclusively(async () => {
      const run = this.current?.run;
      if (!run?.decision || run.status !== 'WAITING_DECISION')
        throw new Error('현재 결정을 다시 확인해 주세요.');
      await this.post(
        `annual-runs/${run.id}/decisions`,
        { expectedJobRevision: run.revision, decisionKey: run.decision.key, choiceId },
        `annual-choice-${run.id}-${run.revision}`,
      );
      return this.pump();
    });
  }
  async advance() {
    return this.exclusively(() => this.pump());
  }
  private async pump() {
    for (let count = 0; count < 240; count++) {
      const run = this.current?.run;
      if (!run || run.status !== 'RUNNING') break;
      await this.post(
        `annual-runs/${run.id}/advance`,
        { expectedJobRevision: run.revision },
        `annual-step-${run.id}-${run.revision}`,
      );
    }
    await cacheAnnualCareer(this.owner, this.careerId, this.abort.signal);
    return this.current;
  }
  async history(): Promise<Array<{ runId: string; report: AnnualReportView }>> {
    await this.check();
    const response = await apiFetch<{
      reports: Array<{ runId: string; report: AnnualReportView }>;
    }>(`/v1/careers/${this.careerId}/annual-reports`, {
      signal: this.abort.signal,
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(response.error.message);
    await this.check();
    return response.data.reports.map(item => ({runId: item.runId, report: AnnualReportSchema.parse(item.report)}));
  }
}
