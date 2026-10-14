import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  avatarImagePlan,
  avatarMotionImageSources,
  IMAGE_HAIRS,
  IMAGE_SHEETS,
} from './avatar-image.js';
import { avatarSpec, primeAvatarSpec, retiredAvatarSpec, type AvatarSpec } from './avatar.js';
import { MINI_POSES, MOTIONS } from './avatar-motion.js';
import { newGame } from './engine.js';
import { createRng, setActiveRng, getActiveRng } from './rng.js';

const base = () => primeAvatarSpec({ id: 'image-contract', lastClub: '' });
describe('original player PNG asset contract', () => {
  it('keeps every original source byte and transparent PNG, with valid measured frame bounds', () => {
    expect(Object.keys(IMAGE_SHEETS)).toHaveLength(33);
    for (const [name, sheet] of Object.entries(IMAGE_SHEETS)) {
      const bytes = readFileSync(new URL(`../assets/avatar-images/${name}.png`, import.meta.url));
      expect(createHash('sha256').update(bytes).digest('hex'), name).toBe(sheet.sha256);
      expect(bytes.subarray(1, 4).toString(), name).toBe('PNG');
      expect(bytes[25], name).toBe(6); // IHDR RGBA colour type
      for (const f of sheet.frames) {
        const [x, y, w, h] = f.crop as [number, number, number, number];
        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(w).toBeGreaterThan(0);
        expect(h).toBeGreaterThan(0);
        expect(x + w).toBeLessThanOrEqual(sheet.width);
        expect(y + h).toBeLessThanOrEqual(sheet.height);
      }
    }
  });
  it('fits all nine hairstyles, 17 poses and animation frames without stretching or clipping', () => {
    for (const hairStyle of IMAGE_HAIRS) {
      const spec = { ...base(), hairStyle };
      for (const f of [
        { ms: 100 },
        ...MINI_POSES.map((pose) => ({ ms: 100, pose })),
        ...Object.values(MOTIONS).flatMap((m) => m.frames),
      ]) {
        const plan = avatarImagePlan(spec, f);
        expect(plan.layers[0]!.source).toMatch(new RegExp(`^${hairStyle}-[AB]$`));
        for (const l of plan.layers) {
          expect(Number.isFinite(l.scale)).toBe(true);
          expect(l.scale).toBeGreaterThan(0);
          expect(l.x).toBeGreaterThanOrEqual(-0.001);
          expect(l.y).toBeGreaterThanOrEqual(-0.001);
          expect(l.x + l.crop[2] * l.scale).toBeLessThanOrEqual(32.001);
          expect(l.y + l.crop[3] * l.scale).toBeLessThanOrEqual(36.001);
        }
      }
    }
  });
  it('preserves appearance data and RNG while displaying expressions, beard, colours and accessories', () => {
    const sp: AvatarSpec = {
      ...base(),
      hairStyle: 'long',
      beard: 'full',
      expr: 'pain',
      gray: 0.8,
      band: 3,
      glasses: 2,
      wrist: 1,
      boots: 8,
      socks: 4,
    };
    setActiveRng(createRng(123));
    const rng = getActiveRng().getState(),
      before = JSON.stringify(sp);
    const p = avatarImagePlan(sp, { ms: 100, pose: 'kick', expr: 'happy' });
    expect(p.layers[1]!.crop).toEqual(IMAGE_SHEETS['heads-long']!.frames[17]!.crop);
    expect(p.layers.filter((l) => l.source === 'accessories').length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(sp)).toBe(before);
    expect(getActiveRng().getState()).toEqual(rng);
  });
  it('keeps injury/retirement props still and army long sleeves/trousers in every motion', () => {
    const injured: AvatarSpec = { ...base(), acc: ['bandage', 'crutch'] };
    const retired = retiredAvatarSpec('retired-image', 42);
    for (const spec of [injured, retired]) {
      const p = avatarImagePlan(spec, { ms: 100, pose: 'runL', lift: 3 });
      expect(p.layers[0]!.source).toBe(spec === injured ? 'injured' : 'retired');
      expect(p.decorations).toBeUndefined();
    }
    const g = newGame(
      { name: 'a', number: 9, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' },
      7,
    );
    g.mil.serving = true;
    g.mil.type = 'army';
    const army = avatarSpec(g);
    expect(avatarMotionImageSources(army)).toContain('army-A');
    for (const pose of MINI_POSES)
      expect(avatarImagePlan(army, { ms: 100, pose }).layers[0]!.source).toMatch(/^army-[AB]$/);
  });
  it('retains non-player ball/trophy effects and portrait viewports', () => {
    expect(
      avatarImagePlan(base(), { ms: 100, pose: 'lift', trophy: true, sparkle: true }).decorations
        ?.length,
    ).toBeGreaterThan(0);
    expect(
      avatarImagePlan(base(), { ms: 100, pose: 'kick', ball: { from: 'at', d: [30, 45] } })
        .decorations?.length,
    ).toBeGreaterThan(0);
    expect(avatarImagePlan(base(), undefined, true).height).toBe(21);
  });
});
