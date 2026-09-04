import { describe, expect, it } from 'vitest';
import golden from './__fixtures__/career-12-injury.golden.json';
import { runInjuryFixture } from './__fixtures__/career-12-injury.js';
import { verifySnapshot } from './simulate.js';

describe('career-12-injury fixture — 실제 중증→재활→회복→재발 golden', () => {
  it('golden revision/hash/rng draws와 정확히 일치한다', () => {
    const { snapshot } = runInjuryFixture();
    expect(snapshot.revision).toBe(golden.revision);
    expect(snapshot.stateHash).toBe(golden.stateHash);
    expect(snapshot.state.rngState.draws).toBe(golden.rngStateDraws);
    expect(snapshot.state.age).toBe(golden.age);
    expect(snapshot.state.seasonHistory).toHaveLength(golden.seasonHistoryLength);
    expect(verifySnapshot(snapshot)).toEqual({ ok: true });
  });

  it('초기 중증 episode가 재활·회복되고 같은 부위 MAJOR 재발과 즉시 후유증을 남긴다', () => {
    const { snapshot } = runInjuryFixture();
    expect(snapshot.state.health.episodes).toEqual(golden.episodes);
    expect(snapshot.state.health.episodes[0]?.severity).toBe('MODERATE');
    expect(snapshot.state.health.episodes[0]?.status).toBe('RECURRED');
    expect(snapshot.state.health.episodes[1]?.severity).toBe('MAJOR');
    expect(snapshot.state.health.episodes[1]?.bodyPart).toBe(snapshot.state.health.episodes[0]?.bodyPart);
    expect(snapshot.state.timeline.map((entry) => entry.kind)).toEqual(
      expect.arrayContaining(['INJURED', 'RECOVERED', 'INJURY_RECURRED']),
    );
  });

  it('같은 fixture를 반복 실행해도 state hash가 같다', () => {
    const first = runInjuryFixture().snapshot;
    const second = runInjuryFixture().snapshot;
    expect(second.stateHash).toBe(first.stateHash);
  });
});
