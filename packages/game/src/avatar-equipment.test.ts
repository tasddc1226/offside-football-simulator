import { describe, expect, it } from 'vitest';
import { validAppearance, APPEARANCE_OPTIONS } from '@offside/contracts/avatar-look';
import {
  avatarPixels,
  avatarSpec,
  cardAvatarSpec,
  retiredAvatarSpec,
  miniColors,
} from './avatar.js';
import { loadMotionPoses, MINI_POSES, motionFrame } from './avatar-motion.js';
import { LOOK_ITEMS, LOOK_STYLES, lookCode, parseLookCode } from './look.js';
import { buyLook, setLook } from './look-shop.js';
import { loadSave } from './save.js';
import fixture from './__fixtures__/save-fw26.json';
import type { GameState } from './types.js';

describe('goalkeeper cosmetic equipment', () => {
  it('preserves old codes and accepts all thirteen categories together', () => {
    const old = 's1h2d1y4e2a3w4g2b5k6';
    expect(lookCode({ owned: [], pick: parseLookCode(old) })).toBe(old);
    const full = old + 'l5u4n3';
    expect(validAppearance(full)).toBe(true);
    expect(lookCode({ owned: [], pick: parseLookCode(full) })).toBe(full);
    for (const [item, code] of [
      ['gloves', 'l'],
      ['keeperKit', 'u'],
      ['kneePads', 'n'],
    ] as const) {
      expect(APPEARANCE_OPTIONS[code]).toBe(LOOK_ITEMS[item].options);
      expect(validAppearance(`${code}${LOOK_ITEMS[item].options}`)).toBe(false);
      expect(validAppearance(`${code}1${code}2`)).toBe(false);
    }
  });

  it('loads old saves unchanged and persists optional equipment without new required fields', () => {
    const old = structuredClone(fixture) as unknown as GameState;
    old.look = { owned: ['style'], pick: { style: 8 } };
    expect(loadSave(JSON.parse(JSON.stringify(old)))!.G.look).toEqual(old.look);
    const dressed = structuredClone(old);
    dressed.look = {
      owned: ['gloves', 'keeperKit', 'kneePads'],
      pick: { gloves: 1, keeperKit: 2, kneePads: 1 },
    };
    expect(loadSave(JSON.parse(JSON.stringify(dressed)))!.G.look).toEqual(dressed.look);
    // No automatic purchase, forced recoloring or new state is added to existing saves.
    expect(old.look).toEqual({ owned: ['style'], pick: { style: 8 } });
  });

  it('purchases once and changes only money and appearance; later selections are free', () => {
    const s = structuredClone(fixture) as unknown as GameState;
    s.retired = false;
    s.money = 1e9;
    const before = structuredClone(s);
    expect(buyLook(s, 'gloves', 1)).toBe(true);
    const money = s.money;
    expect(setLook(s, 'gloves', 4)).toBe(true);
    expect(s.money).toBe(money);
    expect({ ...s, money: 0, look: null }).toEqual({ ...before, money: 0, look: null });
    expect(buyLook(s, 'gloves', 2)).toBe(false);
    s.retired = true;
    expect(setLook(s, 'gloves', 2)).toBe(false);
  });

  it('keeps the formal suit and military uniform while cards retain the selected sports kit', () => {
    const code = 'l1u2n1';
    const retired = miniColors(retiredAvatarSpec('keeper', 38, code));
    expect(retired.glove).toBeNull();
    expect(retired.longSleeve).toBe(false);
    expect(retired.kneePad).toBeNull();
    const card = miniColors(cardAvatarSpec({ careerId: 'keeper', look: code }));
    expect(card.glove).toBe('#f4f4ef');
    expect(card.longSleeve).toBe(true);
    expect(card.shorts).toBe('#25313c');
    const s = structuredClone(fixture) as unknown as GameState;
    s.retired = false;
    s.mil.serving = true;
    s.mil.type = 'army';
    s.look = { owned: [], pick: parseLookCode(code) };
    expect(miniColors(avatarSpec(s)).longSleeve).toBe(false);
  });

  it('attaches gloves to all fifteen styles and every authored limb pose without covering eyes', async () => {
    for (const style of LOOK_STYLES.keys()) {
      const base = cardAvatarSpec({ careerId: 'keeper', look: `y${style}s1h2` });
      const sp = { ...base, gloves: 1 };
      const poses = await loadMotionPoses(sp.hairStyle);
      for (const pose of ['stand', ...MINI_POSES] as const) {
        const plain =
          pose === 'stand' ? avatarPixels(base) : motionFrame(base, { ms: 100, pose }, poses);
        const dressed =
          pose === 'stand' ? avatarPixels(sp) : motionFrame(sp, { ms: 100, pose }, poses);
        expect(dressed, `${sp.hairStyle}/${pose}`).not.toEqual(plain);
        // White eye whites remain unchanged; glove pixels are added only on limbs.
        plain.forEach((row, y) =>
          row.forEach((c, x) => {
            if (c === '#fff4e3') expect(dressed[y]![x]).toBe(c);
          }),
        );
      }
    }
  });
});
