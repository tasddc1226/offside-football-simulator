import { loadContentPack } from '@offside/content';
import { MemoryLocalStore, inlineSimulator } from '@offside/engine-client';
import { rulesetProto } from '@offside/fixtures';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppEngine, type AppEngine } from './engine.js';
import { elapsedSecBucket, recordFunnelReached, recordSeasonSettled, recordSeasonStart, startCareerFunnel, sumStepSummaries } from './funnel.js';

const trackMock = vi.fn();
vi.mock('../platform/index.js', () => ({
  platform: { analytics: { track: (...args: unknown[]) => trackMock(...args) } },
}));

const engineHolder: { current: AppEngine | undefined } = { current: undefined };
vi.mock('./engine.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./engine.js')>();
  return { ...actual, getAppEngine: () => Promise.resolve(engineHolder.current) };
});

function makeEngine(): AppEngine {
  return createAppEngine({
    store: new MemoryLocalStore(),
    simulator: inlineSimulator,
    ruleset: rulesetProto,
    pack: loadContentPack('0.1.0'),
  });
}

describe('elapsedSecBucket', () => {
  it('경계값을 올바른 버킷으로 나눈다', () => {
    expect(elapsedSecBucket(0)).toBe('<60');
    expect(elapsedSecBucket(59_000)).toBe('<60');
    expect(elapsedSecBucket(60_000)).toBe('<180');
    expect(elapsedSecBucket(179_000)).toBe('<180');
    expect(elapsedSecBucket(180_000)).toBe('<360');
    expect(elapsedSecBucket(359_000)).toBe('<360');
    expect(elapsedSecBucket(360_000)).toBe('<720');
    expect(elapsedSecBucket(719_000)).toBe('<720');
    expect(elapsedSecBucket(720_000)).toBe('<1800');
    expect(elapsedSecBucket(1_799_000)).toBe('<1800');
    expect(elapsedSecBucket(1_800_000)).toBe('>=1800');
    expect(elapsedSecBucket(999_999_999)).toBe('>=1800');
  });
});

describe('sumStepSummaries', () => {
  it('summary가 null인 step은 0으로 계산해 합산한다', () => {
    const totals = sumStepSummaries({
      steps: [
        { summary: { decisionsOpened: 2, matchesPlayed: 1 } },
        { summary: null },
        { summary: { decisionsOpened: 3, matchesPlayed: 1 } },
      ],
    });
    expect(totals).toEqual({ decisionsOpened: 5, matchesPlayed: 2 });
  });

  it('step이 없으면 0을 돌려준다', () => {
    expect(sumStepSummaries({ steps: [] })).toEqual({ decisionsOpened: 0, matchesPlayed: 0 });
  });
});

describe('funnel 시각 저장·1회 발화', () => {
  beforeEach(() => {
    engineHolder.current = makeEngine();
    trackMock.mockReset();
  });

  it('startCareerFunnel: pending 온보딩 시각이 있으면 그 시각을 기준으로 옮기고 지운다', async () => {
    const engine = engineHolder.current!;
    const before = Date.now() - 5000;
    await engine.store.transaction('readwrite', (tx) => tx.kv.put('funnel:pendingOnboardingStartedAt', before));

    await startCareerFunnel(engine, 'car_1');

    expect(trackMock).toHaveBeenCalledWith('funnel_reached', {
      stage: 'ONBOARDING_STARTED',
      careerIndex: 1,
      elapsedSecBucket: '<60',
    });
    const pending = await engine.store.transaction('readonly', (tx) => tx.kv.get('funnel:pendingOnboardingStartedAt'));
    expect(pending).toBeUndefined();
  });

  it('startCareerFunnel: pending이 없으면 지금 시각을 기준으로 쓰고 careerIndex를 1씩 늘린다', async () => {
    const engine = engineHolder.current!;

    await startCareerFunnel(engine, 'car_a');
    await startCareerFunnel(engine, 'car_b');

    expect(trackMock).toHaveBeenNthCalledWith(1, 'funnel_reached', { stage: 'ONBOARDING_STARTED', careerIndex: 1, elapsedSecBucket: '<60' });
    expect(trackMock).toHaveBeenNthCalledWith(2, 'funnel_reached', { stage: 'ONBOARDING_STARTED', careerIndex: 2, elapsedSecBucket: '<60' });
  });

  it('recordFunnelReached: 같은 스테이지는 두 번째부터 아무 것도 보내지 않는다(1회)', async () => {
    const engine = engineHolder.current!;
    await startCareerFunnel(engine, 'car_1');
    trackMock.mockClear();

    await recordFunnelReached('car_1', 'PLAYER_CONFIRMED');
    await recordFunnelReached('car_1', 'PLAYER_CONFIRMED');

    expect(trackMock).toHaveBeenCalledTimes(1);
    expect(trackMock).toHaveBeenCalledWith('funnel_reached', { stage: 'PLAYER_CONFIRMED', careerIndex: 1, elapsedSecBucket: '<60' });
  });

  it('recordFunnelReached: funnel 레코드가 없는 커리어는 조용히 아무 것도 하지 않는다', async () => {
    await recordFunnelReached('car_unknown', 'CONTRACT_SIGNED');
    expect(trackMock).not.toHaveBeenCalled();
  });

  it('recordSeasonSettled: seasonStartedAt 기준으로 elapsedSecBucket을 계산하고 funnel_reached·season_settled를 함께 보낸다', async () => {
    const engine = engineHolder.current!;
    await startCareerFunnel(engine, 'car_1');
    await recordSeasonStart('car_1');
    trackMock.mockClear();

    await recordSeasonSettled('car_1', { seasonIndex: 0, simulationMode: 'FAST', decisionsOpened: 4, matchesPlayed: 2 });

    expect(trackMock).toHaveBeenCalledWith('funnel_reached', { stage: 'SEASON_SETTLED', careerIndex: 1, elapsedSecBucket: '<60' });
    expect(trackMock).toHaveBeenCalledWith('season_settled', {
      seasonIndex: 0,
      simulationMode: 'FAST',
      decisionsOpened: 4,
      matchesPlayed: 2,
      elapsedSecBucket: '<60',
      elapsedSec: expect.any(Number),
    });
  });
});
