import { expect, it } from 'vitest';
import '@offside/game/index';
import { chipValue, eventChips } from './chipValue.js';

it('shows before and after values only in the phase report range mode', () => {
  const c = { label: '패스', d: 4, from: 68, to: 72 };
  expect(chipValue(c)).toBe('+4');
  expect(chipValue(c, true)).toBe('68 → 72');
  expect(chipValue({ label: '패스', d: 0.4, from: 68, to: 68 }, true)).toBe('+0.4');
  expect(chipValue({ label: '슈팅', d: -1, from: 60, to: 59 }, true)).toBe('60 → 59');
  expect(chipValue({ label: '사기', d: 5 }, true)).toBe('+5');
  expect(chipValue({ label: '부상', d: 2, text: '2구간 결장' }, true)).toBe('2구간 결장');
});

it('adds shown before and after values to stat chips only for the phase report', async () => {
  const { newGame } = await import('@offside/game/engine');
  const { snapshot, diffChips } = await import('@offside/game/stats');
  const { setActiveRng, createRng } = await import('@offside/game/rng');
  setActiveRng(createRng(7));
  const s = newGame(
    { name: 'T', number: 9, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' },
    7,
  );
  s.attrs.pas = 67.6;
  const a = snapshot(s);
  s.attrs.pas = 71.8;
  const b = snapshot(s);
  const ranged = diffChips(s, a, b, true).find((c) => c.d === 4.2)!;
  expect(ranged).toMatchObject({ from: 68, to: 72 });
  expect(chipValue(ranged, true)).toBe('68 → 72');
  expect(diffChips(s, a, b).find((c) => c.d === 4.2)).not.toHaveProperty('from');
});

it('drops the OVR chip from the event result and keeps it in the phase report (T-11-756)', async () => {
  const { newGame } = await import('@offside/game/engine');
  const { snapshot, diffChips } = await import('@offside/game/stats');
  const { setActiveRng, createRng } = await import('@offside/game/rng');
  setActiveRng(createRng(7));
  const s = newGame(
    { name: 'T', number: 9, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' },
    7,
  );
  const a = snapshot(s);
  const b = { ...a, ovr: a.ovr + 2, morale: a.morale + 5 };
  expect(diffChips(s, a, b).map((c) => c.label)).toContain('OVR');
  expect(eventChips(diffChips(s, a, b)).map((c) => c.d)).toEqual([5]);
  expect(diffChips(s, a, b, true).find((c) => c.label === 'OVR')).toMatchObject({
    d: 2,
    from: a.ovr,
    to: a.ovr + 2,
  });
});
