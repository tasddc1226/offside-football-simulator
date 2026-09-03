import { describe, expect, it } from 'vitest';
import golden from './__fixtures__/career-03-underdog.golden.json';
import { careerUnderdogFixture } from './__fixtures__/career-03-underdog.js';
import { runCareerFixture } from './__fixtures__/career-01.js';
import { verifySnapshot } from './simulate.js';

describe('career-03-underdog fixture — "OVR이 낮아도 전술 적합도가 높으면 선발된다"(phase-2 완료 조건)', () => {
  it('golden 값과 정확히 일치한다', () => {
    const snapshot = runCareerFixture(careerUnderdogFixture);
    expect(snapshot.revision).toBe(golden.revision);
    expect(snapshot.stateHash).toBe(golden.stateHash);
    expect(snapshot.checkpoint).toBe(golden.checkpoint);
    expect(snapshot.state.rngState.draws).toBe(golden.rngStateDraws);
    expect(snapshot.state.player.profile?.baseOvr).toBe(golden.baseOvr);
    expect(verifySnapshot(snapshot)).toEqual({ ok: true });
  });

  it('경쟁자보다 baseOvr이 낮은 선수가 Tactical Fit 덕분에 선발(rank 1, START)이다', () => {
    const snapshot = runCareerFixture(careerUnderdogFixture);
    const season = snapshot.state.season;
    expect(season).not.toBeNull();
    if (season === null) return;

    expect(season.styleId).toBe(golden.season.styleId);
    expect(season.squadRole).toBe(golden.season.squadRole);
    expect(season.squad.competitors.length).toBe(golden.season.competitorsCount);

    const selection = season.selection;
    expect(selection.position).toBe(golden.selection.position);
    expect(selection.slots).toBe(golden.selection.slots);
    expect(selection.benchSlots).toBe(golden.selection.benchSlots);
    expect(selection.candidates).toEqual(
      golden.selection.candidates.map((c) => ({ ...c, name: expect.any(String), managerTrust: expect.any(Number), excluded: null })),
    );
    expect(selection.playerReason).toEqual(golden.selection.playerReason);

    const player = selection.candidates.find((c) => c.id === 'PLAYER')!;
    const higherOvrStarters = selection.candidates.filter((c) => c.id !== 'PLAYER' && c.appearance !== 'OUT' && c.baseOvr > player.baseOvr);
    expect(player.appearance).toBe('START');
    expect(higherOvrStarters.length).toBeGreaterThan(0);
    expect(player.tacticalFit).toBeGreaterThan(Math.max(...higherOvrStarters.map((c) => c.tacticalFit)));
  });
});
