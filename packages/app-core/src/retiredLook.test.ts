import { beforeEach, expect, it, vi } from 'vitest';
import { APPEARANCE_OPTIONS } from '@offside/contracts/avatar-look';
import { newGame } from '@offside/game/engine';
import { retire } from '@offside/game/season';
import { LOOK_ITEMS } from '@offside/game/look';
import { LOOK_CODE } from '@offside/game/look-code';
import { createRng, getActiveRng, setActiveRng } from '@offside/game/rng';
import { loadKey, saveKey, setStorage } from '@offside/game/storage';
import { apiFetch } from './api/client.js';
import { createLegends } from './legend.js';
import { initialAppState } from './state.js';
import {
  loadRetiredLook,
  pickRetiredLook,
  retiredLookRows,
  saveRetiredLook,
} from './retiredLook.js';

vi.mock('./api/client.js', () => ({
  apiFetch: vi.fn(),
  getMyCareers: vi.fn(),
  getHofDetail: vi.fn(),
}));
let values: Map<string, string>;
beforeEach(() => {
  values = new Map();
  setStorage({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  });
  setActiveRng(createRng(99));
  vi.clearAllMocks();
});
function fixture() {
  const state = initialAppState();
  state.G = newGame(
    { name: '과거 선수', number: 9, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' },
    99,
  );
  state.G.age = 38;
  state.G.money = 123456;
  const h = retire(state.G);
  delete h.look;
  delete state.G.look;
  saveKey('ft_hof', [h]);
  saveKey('ft_save', state.G);
  const legends = createLegends({
    state,
    rnOf: () => null,
    toast: vi.fn(),
    uploadRetirement: vi.fn(),
    scrollTop: vi.fn(),
  });
  state.legend = legends.viewFromEntry(h);
  return { state, v: state.legend, h, legends };
}
const withoutLook = <T extends { look?: unknown }>(o: T) => {
  const rest = { ...o };
  delete rest.look;
  return rest;
};

it('changes only appearance in old archive, retired save and live view; RNG/funds/stats remain identical', async () => {
  const { state, v, h } = fixture();
  const before = JSON.parse(JSON.stringify(state.G));
  const rng = getActiveRng().getState();
  vi.mocked(apiFetch).mockResolvedValue({ ok: true, data: { careerId: h.id, look: 'h2y6e2' } });
  const result = await saveRetiredLook(state, Object.freeze({ ...v }), 'h2y6e2');
  expect(result.ok).toBe(true);
  expect(apiFetch).toHaveBeenCalledWith(`/v1/careers/${h.id}/look`, {
    method: 'PUT',
    body: JSON.stringify({ look: 'h2y6e2' }),
  });
  expect(withoutLook(loadKey<{ look?: string }[]>('ft_hof')![0]!)).toEqual(withoutLook(h));
  expect(withoutLook(loadKey<{ look?: unknown }>('ft_save')!)).toEqual(withoutLook(before));
  expect(withoutLook(state.G!)).toEqual(withoutLook(before));
  expect(getActiveRng().getState()).toEqual(rng);
  expect(state.legend?.avatarLook).toBe('h2y6e2');
  expect(state.G?.look?.pick).toEqual({ hair: 2, style: 6, expr: 2 });
});

it('does not change storage, preview or game when the server rejects ownership/network', async () => {
  const { state, v } = fixture();
  const before = JSON.stringify(state),
    stored = [...values];
  vi.mocked(apiFetch).mockResolvedValue({
    ok: false,
    error: {
      code: 'CONFLICT',
      message: 'owner mismatch',
      retryable: false,
      reason: 'CAREER_OWNER_MISMATCH',
    },
  });
  expect((await saveRetiredLook(state, v, 'y6')).ok).toBe(false);
  expect(JSON.stringify(state)).toBe(before);
  expect([...values]).toEqual(stored);
  expect(pickRetiredLook(v.avatarLook ?? null, 'style', 6)).toBe('y6');
  expect(JSON.stringify(state)).toBe(before);
});

it('supports server-owned careers from another device without fabricating a local record or editing a different save', async () => {
  const { state, v } = fixture();
  const remote = { ...v, avatarId: 'remote-id', own: null, canEditLook: true };
  state.legend = remote;
  const before = [...values],
    game = JSON.stringify(state.G);
  vi.mocked(apiFetch).mockResolvedValue({
    ok: true,
    data: { careerId: remote.avatarId, look: 's2' },
  });
  expect((await saveRetiredLook(state, Object.freeze({ ...remote }), 's2')).ok).toBe(true);
  expect(state.legend.avatarLook).toBe('s2');
  expect([...values]).toEqual(before);
  expect(JSON.stringify(state.G)).toBe(game);
});

it('supports pre-server records without IDs locally and reports the scope', async () => {
  const { state, h, legends } = fixture();
  delete h.id;
  delete h.detail;
  saveKey('ft_hof', [h]);
  state.legend = legends.viewFromEntry(h);
  expect(state.legend.avatarId).toMatch(/^local:/);
  const r = await saveRetiredLook(state, state.legend, 'y8');
  expect(r.ok).toBe(true);
  expect(r.message).toContain('이 기기');
  expect(apiFetch).not.toHaveBeenCalled();
  expect(loadKey<{ look: string }[]>('ft_hof')![0]!.look).toBe('y8');
});

it('does not allow shared/public views or unlock record items without a title', async () => {
  const { state, v } = fixture();
  expect((await saveRetiredLook(state, { ...v, canEditLook: false }, 'y6')).ok).toBe(false);
  expect((await saveRetiredLook(state, v, 'h12')).ok).toBe(false);
  expect(
    retiredLookRows(v, null)
      .find((r) => r.item === 'hair')!
      .options.some((o) => o.value === 12),
  ).toBe(false);
  expect(apiFetch).not.toHaveBeenCalled();
});

it('reports local storage failure and never claims a local-only save succeeded', async () => {
  const { state, h, legends } = fixture();
  delete h.id;
  saveKey('ft_hof', [h]);
  state.legend = legends.viewFromEntry(h);
  setStorage({
    getItem: (key) => values.get(key) ?? null,
    setItem: () => {
      throw Error('full');
    },
  });
  expect((await saveRetiredLook(state, state.legend, 'y6')).ok).toBe(false);
  expect(state.legend.avatarLook).toBeNull();
});

it('keeps wire option limits aligned with the game renderer', () => {
  for (const [item, code] of Object.entries(LOOK_CODE))
    expect(APPEARANCE_OPTIONS[code as keyof typeof APPEARANCE_OPTIONS]).toBe(
      LOOK_ITEMS[item as keyof typeof LOOK_ITEMS].options,
    );
});

it('loads authoritative server policy on editor open and fails closed on auth/network errors', async () => {
  const { state, v } = fixture();
  vi.mocked(apiFetch).mockResolvedValue({
    ok: true,
    data: { careerId: v.avatarId, look: 'y8', remaining: 0, lockedReason: 'transferred' },
  });
  expect(await loadRetiredLook(state, v)).toMatchObject({
    ok: true,
    policy: { look: 'y8', remaining: 0, lockedReason: 'transferred' },
  });
  expect(apiFetch).toHaveBeenCalledWith(`/v1/careers/${v.avatarId}/look`);
  vi.mocked(apiFetch).mockResolvedValue({
    ok: false,
    error: { code: 'UNAUTHORIZED', message: '', retryable: false },
  });
  expect((await loadRetiredLook(state, v)).ok).toBe(false);
});

it('local-only one-time receipt survives reload; preview/no-op/failure never consumes it', async () => {
  const { state, h, legends } = fixture();
  delete h.id;
  saveKey('ft_hof', [h]);
  const v = legends.viewFromEntry(h);
  expect(await loadRetiredLook(state, v)).toMatchObject({ ok: true, policy: { remaining: 1 } });
  pickRetiredLook(null, 'style', 6);
  expect((await saveRetiredLook(state, v, null)).ok).toBe(true);
  expect(await loadRetiredLook(state, v)).toMatchObject({ ok: true, policy: { remaining: 1 } });
  expect((await saveRetiredLook(state, v, 'y6')).ok).toBe(true);
  const reopened = legends.viewFromEntry(loadKey<(typeof h)[]>('ft_hof')![0]!);
  expect(await loadRetiredLook(state, reopened)).toMatchObject({
    ok: true,
    policy: { look: 'y6', remaining: 0, lockedReason: 'used' },
  });
  expect((await saveRetiredLook(state, reopened, 'y7')).ok).toBe(false);
  expect((await saveRetiredLook(state, reopened, 'y6')).ok).toBe(true);
  expect(apiFetch).not.toHaveBeenCalled();
});

it('a local receipt from the dot character keeps its look and gives one more change (T-11-243)', async () => {
  const { state, h, legends } = fixture();
  delete h.id;
  saveKey('ft_hof', [h]);
  const v = legends.viewFromEntry(h);
  saveKey(`ft_retired_look:${v.avatarId}`, { used: true, look: 'y6' });
  expect(await loadRetiredLook(state, v)).toMatchObject({
    ok: true,
    policy: { look: 'y6', remaining: 1, lockedReason: null },
  });
  expect((await saveRetiredLook(state, v, 'y7')).ok).toBe(true);
  expect(await loadRetiredLook(state, v)).toMatchObject({
    ok: true,
    policy: { look: 'y7', remaining: 0, lockedReason: 'used' },
  });
  expect((await saveRetiredLook(state, v, 'y8')).ok).toBe(false);
});

it('legacy server-missing fallback persists the limit without bypassing other errors', async () => {
  const { state, v } = fixture();
  vi.mocked(apiFetch).mockResolvedValue({
    ok: false,
    error: { code: 'NOT_FOUND', reason: 'CAREER_NOT_FOUND', message: '', retryable: false },
  });
  expect((await saveRetiredLook(state, v, 'y6')).ok).toBe(true);
  expect(await loadRetiredLook(state, v)).toMatchObject({
    ok: true,
    policy: { remaining: 0, look: 'y6' },
  });
  expect((await saveRetiredLook(state, v, 'y7')).ok).toBe(false);
});
