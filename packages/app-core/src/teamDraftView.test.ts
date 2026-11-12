import { describe, expect, it } from 'vitest';
import type { TeamPlayer } from '@offside/contracts';
import { LINEUP_SIZE, YOUTH_OVR, presetLayout } from '@offside/contracts/owner-team';
import { projectTeamDraft } from './teamDraftView.js';

const player = (careerId: string, season: number): TeamPlayer => ({
  careerId,
  season,
  pos: 'FW',
  dpos: null,
  peak: 70,
  roles: null,
  attrs: null,
  number: null,
  publicName: null,
  legendScore: null,
});
const input = () => ({
  formation: '4-3-3' as const,
  layout: null,
  slots: Array<string | null>(LINEUP_SIZE).fill(null),
  byId: new Map<string, TeamPlayer>(),
  season: 2,
  editable: true,
  cupPreset: null,
});

describe('shared team draft projection', () => {
  it('uses youth ratings for empty or unavailable players without discarding draft slot IDs', () => {
    const draft = input();
    draft.slots[9] = 'no-longer-owned';
    const view = projectTeamDraft(draft);
    expect(view.ovr).toBe(YOUTH_OVR);
    expect(view.ratings).toEqual(Array(LINEUP_SIZE).fill(null));
    expect(view.filled).toBe(1);
    expect(draft.slots[9]).toBe('no-longer-owned');
  });

  it('re-evaluates editable season roles but preserves historical and preseason roles', () => {
    const layout = presetLayout('4-3-3');
    layout[9] = { ...layout[9]!, slot: 'W' };
    const draft = { ...input(), layout };
    expect(projectTeamDraft(draft).slotCodes[9]).toBe('ST');
    expect(projectTeamDraft({ ...draft, editable: false }).slotCodes[9]).toBe('W');
    expect(projectTeamDraft({ ...draft, season: 0 }).slotCodes[9]).toBe('W');
    expect(layout[9]!.slot).toBe('W');
  });

  it('uses the caller-selected cup preset independently from the lineup draft', () => {
    const draft = input();
    draft.byId.set('old', player('old', 1));
    draft.byId.set('current', player('current', 2));
    draft.slots[9] = 'current';
    const cupSlots = ['old', null];
    expect(projectTeamDraft(draft).cupDraft.past).toBe(0);
    const preset = { slots: cupSlots, ovr: 74, filled: 10 };
    expect(projectTeamDraft({ ...draft, cupPreset: preset }).cupDraft).toEqual({
      ovr: 74,
      filled: 10,
      past: 1,
    });
    expect(projectTeamDraft({ ...draft, cupPreset: { slots: cupSlots } }).cupDraft).toEqual({
      ovr: 0,
      filled: 1,
      past: 1,
    });
    expect(cupSlots).toEqual(['old', null]);
  });
});
