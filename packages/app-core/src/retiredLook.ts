// Loaded only by retired appearance editors. Never run retirement/game-save side effects here.
import { appearanceUnlocked, validAppearance } from '@offside/contracts/avatar-look';
import type { RetiredLookResponse, RetiredLookPolicy } from '@offside/contracts';
import { retiredAvatarSpec } from '@offside/game/avatar';
import { LOOK_ORDER, LOOK_STYLES, LOOK_BEARDS, parseLookCode } from '@offside/game/look';
import { LOOK_RECORDS } from '@offside/game/look-shop';
import { LOOK_CODE, lookCode } from '@offside/game/look-code';
import { loadKey, saveKey } from '@offside/game/storage';
import type { GameState, HofEntry, LookItem } from '@offside/game/types';
import { apiFetch } from './api/client.js';
import { optionsOf, lookItemName, RECORD_NAME } from './avatarLook.js';
import type { AppState, LegendView } from './state.js';
import { retiredLookText as L } from './i18n/ko/retiredLook.js';
import {
  LOOK_ROUND,
  receiptKey as receiptKeyOf,
  rememberLookLock,
  spentReceipt as spent,
  type LocalReceipt,
} from './retiredLookLock.js';

const titlesOf = (v: LegendView) => v.d?.titles?.map((t) => t.id) ?? [];

export function retiredLookRows(v: LegendView, code: string | null) {
  const pick = parseLookCode(code);
  const spec = retiredAvatarSpec(v.avatarId!, v.age, code);
  return LOOK_ORDER.map((item) => {
    const defaults = {
      skin: spec.look.skin,
      hair: spec.look.hair,
      style: LOOK_STYLES.indexOf(spec.hairStyle),
      beard: LOOK_BEARDS.indexOf(spec.beard),
      expr: spec.expr === 'wink' ? 2 : spec.expr === 'happy' ? 1 : 0,
    };
    const options = optionsOf(item);
    for (const r of LOOK_RECORDS) {
      if (
        r.item !== item ||
        !appearanceUnlocked(`${recordCode(item)}${r.value}`, v.avatarLook ?? null, titlesOf(v))
      )
        continue;
      options.push({ value: r.value, label: RECORD_NAME()[r.id], swatch: null });
    }
    return {
      item,
      name: lookItemName(item),
      options,
      current: pick[item] ?? defaults[item as keyof typeof defaults] ?? 0,
    };
  });
}

// Use the established encoder, including its stable item order.
const recordCode = (item: LookItem) => LOOK_CODE[item];
export const pickRetiredLook = (code: string | null, item: LookItem, value: number) =>
  lookCode({ owned: [], pick: { ...parseLookCode(code), [item]: value } }) ?? null;

const sameEntry = (h: HofEntry, v: LegendView) =>
  v.own?.id
    ? h.id === v.own.id
    : !!v.own &&
      !h.id &&
      h.date === v.own.date &&
      h.name === v.own.name &&
      h.age === v.own.age &&
      h.number === v.own.number &&
      h.pos === v.own.pos;

// Local-only legacy records have no server/card to transfer. Keep their one-time receipt outside
// game/HOF saves: no save migration or score recalculation. Appearance + used flag are one write.
// T-11-243 round rule and receipt shape live in retiredLookLock.ts (the button reads them too).
const receiptKey = (v: LegendView) => receiptKeyOf(v.avatarId!);
const receiptOf = (v: LegendView) => loadKey<LocalReceipt>(receiptKey(v));
const localPolicy = (v: LegendView): RetiredLookPolicy => {
  const receipt = receiptOf(v);
  return {
    careerId: v.avatarId!,
    look: receipt ? receipt.look : (v.avatarLook ?? null),
    remaining: spent(receipt) ? 0 : 1,
    lockedReason: spent(receipt) ? 'used' : null,
  };
};

/** Called once when the editor opens, never on every option/preview change. Fail closed. The lock is
 * remembered for this session so the report button can show it without another request (T-11-439). */
export async function loadRetiredLook(
  state: AppState,
  v: LegendView,
): Promise<{ ok: true; policy: RetiredLookPolicy } | { ok: false; message: string }> {
  const r = await loadPolicy(state, v);
  if (r.ok && v.avatarId) rememberLookLock(v.avatarId, r.policy.lockedReason);
  return r;
}

async function loadPolicy(
  state: AppState,
  v: LegendView,
): Promise<{ ok: true; policy: RetiredLookPolicy } | { ok: false; message: string }> {
  if (!v.canEditLook || !v.avatarId) return { ok: false, message: L.checkFailed };
  if (v.own && !v.own.id) {
    const policy = localPolicy(v);
    if (policy.remaining === 0) applyLocal(state, v, policy.look);
    return { ok: true, policy };
  }
  const r = await apiFetch<RetiredLookPolicy>(`/v1/careers/${encodeURIComponent(v.avatarId)}/look`);
  if (r.ok) return { ok: true, policy: r.data };
  if (r.error.reason === 'CAREER_NOT_FOUND' && v.own) {
    const policy = localPolicy(v);
    if (policy.remaining === 0) applyLocal(state, v, policy.look);
    return { ok: true, policy };
  }
  return { ok: false, message: r.error.message || L.checkFailed };
}

/** Copy only cosmetics in the raw stored records; avoid loadHOF/saveGame migrations and RNG updates. */
function applyLocal(state: AppState, v: LegendView, code: string | null): boolean {
  const hof = loadKey<HofEntry[]>('ft_hof') ?? loadKey<HofEntry[]>('sl_hof') ?? [];
  const target = hof.findIndex((h) => sameEntry(h, v));
  const entries = hof.map((h, i) => (i === target ? { ...h, look: code ?? undefined } : h));
  const own = entries.find((h) => sameEntry(h, v));
  const stored = loadKey<GameState>('ft_save');
  const gameMatches = stored?.retired && stored.cid === v.avatarId;
  const look = { ...stored?.look, owned: stored?.look?.owned ?? [], pick: parseLookCode(code) };
  const ok =
    (!own || saveKey('ft_hof', entries)) &&
    (!gameMatches || saveKey('ft_save', { ...stored, look }));
  // React snapshots can be frozen; update the live store instead of mutating the view supplied by RN.
  const legend = state.legend;
  if (legend && legend.avatarId === v.avatarId) {
    legend.avatarLook = code;
    if (legend.own) legend.own.look = code ?? undefined;
  }
  if (state.G?.retired && state.G.cid === v.avatarId)
    state.G.look = { ...state.G.look, pick: parseLookCode(code), owned: state.G.look?.owned ?? [] };
  return ok;
}

/** Explicit Save: server owner/status validation first, then cosmetic-only local mirrors. A saved
 * change spends the one free change, so the report button turns to "used" (T-11-439). */
export async function saveRetiredLook(
  state: AppState,
  v: LegendView,
  code: string | null,
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const r = await saveLook(state, v, code);
  // A no-op save (same look) spends nothing.
  if (r.ok && v.avatarId && code !== (v.avatarLook ?? null)) rememberLookLock(v.avatarId, 'used');
  return r;
}

async function saveLook(
  state: AppState,
  v: LegendView,
  code: string | null,
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  if (
    !v.canEditLook ||
    !v.avatarId ||
    !validAppearance(code) ||
    !appearanceUnlocked(code, v.avatarLook ?? null, titlesOf(v))
  )
    return { ok: false, message: L.failed };
  function saveLocal() {
    const previous = receiptOf(v);
    if (previous && spent(previous))
      return previous.look === code
        ? { ok: true as const, message: L.localSaved }
        : { ok: false as const, message: L.used };
    const hof = loadKey<HofEntry[]>('ft_hof') ?? loadKey<HofEntry[]>('sl_hof') ?? [];
    if (!hof.some((h) => sameEntry(h, v))) return { ok: false as const, message: L.storageFailed };
    if (code === (previous ? previous.look : (v.avatarLook ?? null)))
      return { ok: true as const, message: L.localSaved };
    if (!saveKey(receiptKey(v), { used: true, look: code, round: LOOK_ROUND }))
      return { ok: false as const, message: L.storageFailed };
    const mirrored = applyLocal(state, v, code);
    return { ok: true as const, message: mirrored ? L.localSaved : L.localPartial };
  }
  if (v.own && !v.own.id) {
    return saveLocal();
  }
  const r = await apiFetch<RetiredLookResponse>(
    `/v1/careers/${encodeURIComponent(v.avatarId)}/look`,
    {
      method: 'PUT',
      body: JSON.stringify({ look: code }),
    },
  );
  if (!r.ok) {
    // Pre-server local archives remain editable. Never bypass an ownership/authentication failure.
    if (r.error.reason === 'CAREER_NOT_FOUND' && v.own) {
      return saveLocal();
    }
    return { ok: false, message: r.error.message || L.failed };
  }
  const cached = applyLocal(state, v, r.data.look);
  return { ok: true, message: cached ? L.saved : L.serverSaved };
}
