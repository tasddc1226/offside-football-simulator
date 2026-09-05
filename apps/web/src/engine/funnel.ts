// T-2-012 D-55 "이벤트 표": funnel_reached·season_settled·career_abandoned_hint가 쓰는 커리어별
// 진행 시각·careerIndex를 kv-store(LocalStore.kv)에 커리어별 레코드로 저장한다. ONBOARDING_STARTED
// 시각은 온보딩(SCR-034)이 실제로는 커리어 생성 전에 마운트되므로, 기기 단위 "대기 중" 시각을 먼저
// 남기고(markOnboardingPending) createCareer가 새 careerId로 옮겨 담는다(startCareerFunnel) — 이
// 흐름을 거치지 않고 만들어진 커리어(허브 "새 커리어" 버튼 등)는 생성 시각을 그대로 기준으로 쓴다.
import type { CareerState, SimulationMode } from '@offside/domain';
import { platform } from '../platform/index.js';
import type { AppEngine } from './engine.js';
import { getAppEngine } from './engine.js';

export type FunnelStage = 'ONBOARDING_STARTED' | 'PLAYER_CONFIRMED' | 'CONTRACT_SIGNED' | 'SEASON_STARTED' | 'SEASON_SETTLED';
type ElapsedSecBucket = '<60' | '<180' | '<360' | '<720' | '<1800' | '>=1800';

type FunnelRecord = {
  careerIndex: number;
  onboardingStartedAt: number;
  seasonStartedAt?: number;
  reachedStages: FunnelStage[];
};

const PENDING_ONBOARDING_KV_KEY = 'funnel:pendingOnboardingStartedAt';
const CAREER_COUNTER_KV_KEY = 'funnel:careerCounter';

function funnelRecordKey(careerId: string): string {
  return `funnel:${careerId}`;
}

export function elapsedSecBucket(elapsedMs: number): ElapsedSecBucket {
  const elapsedSec = elapsedMs / 1000;
  if (elapsedSec < 60) return '<60';
  if (elapsedSec < 180) return '<180';
  if (elapsedSec < 360) return '<360';
  if (elapsedSec < 720) return '<720';
  if (elapsedSec < 1800) return '<1800';
  return '>=1800';
}

/** T-4-024: 실사용자 플레이 시간 측정용 초 단위 경과(bucket과 별개, 상한 2시간). */
const MAX_ELAPSED_SEC = 7200;

function clampElapsedSec(elapsedMs: number): number {
  return Math.min(Math.round(elapsedMs / 1000), MAX_ELAPSED_SEC);
}

/** 온보딩(SCR-034) 마운트 시 호출 — 아직 careerId가 없으니 기기 단위로 "대기 중" 시각만 남긴다. */
export async function markOnboardingPending(): Promise<void> {
  const engine = await getAppEngine();
  await engine.store.transaction('readwrite', (tx) => tx.kv.put(PENDING_ONBOARDING_KV_KEY, Date.now()));
}

/**
 * createCareer 안에서 호출한다. 대기 중이던 온보딩 시각을 이 careerId로 옮기고(없으면 지금 시각),
 * 기기 careerIndex를 하나 배정한 뒤 funnel_reached(ONBOARDING_STARTED)를 1회 보낸다.
 */
export async function startCareerFunnel(engine: AppEngine, careerId: string): Promise<void> {
  const record = await engine.store.transaction('readwrite', async (tx) => {
    const pendingStartedAt = await tx.kv.get<number>(PENDING_ONBOARDING_KV_KEY);
    const careerIndex = ((await tx.kv.get<number>(CAREER_COUNTER_KV_KEY)) ?? 0) + 1;
    await tx.kv.put(CAREER_COUNTER_KV_KEY, careerIndex);
    if (pendingStartedAt !== undefined) await tx.kv.delete(PENDING_ONBOARDING_KV_KEY);

    const next: FunnelRecord = {
      careerIndex,
      onboardingStartedAt: pendingStartedAt ?? Date.now(),
      reachedStages: ['ONBOARDING_STARTED'],
    };
    await tx.kv.put(funnelRecordKey(careerId), next);
    return next;
  });

  platform.analytics.track('funnel_reached', {
    stage: 'ONBOARDING_STARTED',
    careerIndex: record.careerIndex,
    elapsedSecBucket: elapsedSecBucket(Date.now() - record.onboardingStartedAt),
  });
}

/** PLAYER_CONFIRMED·CONTRACT_SIGNED·SEASON_STARTED·SEASON_SETTLED. 커리어별로 1회만 보낸다. */
export async function recordFunnelReached(
  careerId: string,
  stage: Exclude<FunnelStage, 'ONBOARDING_STARTED'>,
): Promise<void> {
  const engine = await getAppEngine();
  const record = await engine.store.transaction('readwrite', async (tx) => {
    const current = await tx.kv.get<FunnelRecord>(funnelRecordKey(careerId));
    if (current === undefined || current.reachedStages.includes(stage)) return null;
    const next: FunnelRecord = { ...current, reachedStages: [...current.reachedStages, stage] };
    await tx.kv.put(funnelRecordKey(careerId), next);
    return current;
  });
  if (record === null) return;

  platform.analytics.track('funnel_reached', {
    stage,
    careerIndex: record.careerIndex,
    elapsedSecBucket: elapsedSecBucket(Date.now() - record.onboardingStartedAt),
  });
}

/** SEASON_STARTED 성공 시 recordFunnelReached와 별개로 호출한다 — season_settled의 elapsedSecBucket
 * 기준시각(SEASON_STARTED 이후)을 남긴다. */
export async function recordSeasonStart(careerId: string): Promise<void> {
  const engine = await getAppEngine();
  await engine.store.transaction('readwrite', async (tx) => {
    const current = await tx.kv.get<FunnelRecord>(funnelRecordKey(careerId));
    if (current === undefined) return;
    await tx.kv.put(funnelRecordKey(careerId), { ...current, seasonStartedAt: Date.now() });
  });
}

/** SETTLE_SEASON 제출 직전 상태에서 season.steps[].summary를 합한다(브리프 D-55 season_settled). */
export function sumStepSummaries(season: {
  steps: { summary: { decisionsOpened: number; matchesPlayed: number } | null }[];
}): { decisionsOpened: number; matchesPlayed: number } {
  return season.steps.reduce(
    (totals, step) => ({
      decisionsOpened: totals.decisionsOpened + (step.summary?.decisionsOpened ?? 0),
      matchesPlayed: totals.matchesPlayed + (step.summary?.matchesPlayed ?? 0),
    }),
    { decisionsOpened: 0, matchesPlayed: 0 },
  );
}

export type SeasonSettledProps = {
  seasonIndex: number;
  simulationMode: SimulationMode;
  decisionsOpened: number;
  matchesPlayed: number;
};

/** SETTLE_SEASON 성공 시 funnel_reached(SEASON_SETTLED)와 season_settled를 함께 보낸다. */
export async function recordSeasonSettled(careerId: string, props: SeasonSettledProps): Promise<void> {
  await recordFunnelReached(careerId, 'SEASON_SETTLED');

  const engine = await getAppEngine();
  const record = await engine.store.transaction('readonly', (tx) => tx.kv.get<FunnelRecord>(funnelRecordKey(careerId)));
  const baseline = record?.seasonStartedAt ?? record?.onboardingStartedAt;
  if (baseline === undefined) return;

  const elapsedMs = Date.now() - baseline;
  platform.analytics.track('season_settled', {
    seasonIndex: props.seasonIndex,
    simulationMode: props.simulationMode,
    decisionsOpened: props.decisionsOpened,
    matchesPlayed: props.matchesPlayed,
    elapsedSecBucket: elapsedSecBucket(elapsedMs),
    elapsedSec: clampElapsedSec(elapsedMs),
  });
}

/**
 * ADVANCE 응답으로 currentStep이 오를 때마다 호출한다(이탈 step은 마지막 호출로 계산된다).
 * T-4-024: careerId를 넘기면 season_settled와 같은 baseline(seasonStartedAt ?? onboardingStartedAt,
 * 상한 2시간)으로 elapsedSec을 함께 보낸다 — careerId를 안 넘기거나 funnel 레코드·baseline을
 * 못 찾으면(복구 커리어 등) 필드를 생략한다.
 */
export function trackStepPassed(
  season: { index: number; currentStep: number; simulationMode: SimulationMode },
  careerId?: string,
): void {
  const baseProps = { seasonIndex: season.index, step: season.currentStep, simulationMode: season.simulationMode };
  if (careerId === undefined) {
    platform.analytics.track('step_passed', baseProps);
    return;
  }
  void (async () => {
    const engine = await getAppEngine();
    const record = await engine.store.transaction('readonly', (tx) => tx.kv.get<FunnelRecord>(funnelRecordKey(careerId)));
    const baseline = record?.seasonStartedAt ?? record?.onboardingStartedAt;
    platform.analytics.track('step_passed', {
      ...baseProps,
      ...(baseline !== undefined ? { elapsedSec: clampElapsedSec(Date.now() - baseline) } : {}),
    });
  })();
}

/** 커리어 삭제 확인(2단계 다이얼로그의 "삭제 확정") 시 호출한다. */
export function trackCareerAbandonedHint(state: Pick<CareerState, 'currentStep' | 'seasonPhase' | 'season'>): void {
  platform.analytics.track('career_abandoned_hint', {
    seasonIndex: state.season?.index ?? 0,
    step: state.currentStep,
    seasonPhase: state.seasonPhase,
  });
}
