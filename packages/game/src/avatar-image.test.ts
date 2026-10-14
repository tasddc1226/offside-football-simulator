import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  avatarImagePlan,
  avatarMotionImageSources,
  IMAGE_HAIRS,
  IMAGE_SHEETS,
} from './avatar-image.js';
import { avatarSpec, primeAvatarSpec, retiredAvatarSpec, type AvatarSpec } from './avatar.js';
import { MINI_POSES, MOTIONS, type MotionFrame } from './avatar-motion.js';
import { newGame } from './engine.js';
import { createRng, setActiveRng, getActiveRng } from './rng.js';

const base = () => primeAvatarSpec({ id: 'image-contract', lastClub: '' });
const sources = (p: ReturnType<typeof avatarImagePlan>) => p.layers.map((l) => l.source);
const names = (p: ReturnType<typeof avatarImagePlan>) => [...new Set(p.layers.map((l) => l.layer))];
describe('paper-doll avatar layer contract', () => {
  it('ships every atlas as an opaque-or-clear RGBA PNG with parts inside it', () => {
    for (const [name, sheet] of Object.entries(IMAGE_SHEETS)) {
      const bytes = readFileSync(new URL(`../assets/avatar-layers/${name}.png`, import.meta.url));
      expect(bytes.subarray(1, 4).toString(), name).toBe('PNG');
      expect(bytes.readUInt32BE(16), name).toBe(sheet.width);
      expect(bytes.readUInt32BE(20), name).toBe(sheet.height);
      expect(bytes[25], name).toBe(6); // IHDR RGBA colour type
    }
    // 완전 민머리는 맨몸 머리 그대로라 머리카락 층이 없고 헤어밴드만 있다.
    for (const hairStyle of IMAGE_HAIRS)
      for (const pose of ['stand', ...MINI_POSES]) {
        const plan = avatarImagePlan({ ...base(), hairStyle, band: 2 }, {
          ms: 100,
          pose,
        } as MotionFrame);
        if (hairStyle !== 'bald') expect(names(plan)).toContain(`hair-${hairStyle}`);
        expect(names(plan)).toContain(`band-${hairStyle}`);
      }
  });
  it('draws the same base body under every hairstyle in every pose and frame, inside the frame', () => {
    for (const hairStyle of IMAGE_HAIRS) {
      const spec = { ...base(), hairStyle };
      const frames: MotionFrame[] = [
        { ms: 100 },
        ...MINI_POSES.map((pose) => ({ ms: 100, pose })),
        ...Object.values(MOTIONS).flatMap((m) => m.frames),
      ];
      for (const f of frames) {
        const plan = avatarImagePlan(spec, f);
        // 어깨 뒤 머리카락만 맨몸보다 먼저 그린다.
        expect(names(plan).filter((n) => !n.endsWith('-back'))[0]).toBe('base');
        if (hairStyle !== 'bald') expect(names(plan)).toContain(`hair-${hairStyle}`);
        expect(names(plan)).toContain('kit');
        expect(new Set(sources(plan)).size).toBe(1);
        for (const l of plan.layers) {
          const sheet = IMAGE_SHEETS[l.source]!;
          expect(l.crop[0] + l.crop[2]).toBeLessThanOrEqual(sheet.width);
          expect(l.crop[1] + l.crop[3]).toBeLessThanOrEqual(sheet.height);
          expect(l.scale).toBeGreaterThan(0);
          expect(l.x).toBeGreaterThanOrEqual(-0.001);
          expect(l.y).toBeGreaterThanOrEqual(-0.001 - (f.lift ?? 0));
          expect(l.x + l.crop[2] * l.scale).toBeLessThanOrEqual(32.001);
          expect(l.y + l.crop[3] * l.scale).toBeLessThanOrEqual(36.001 + (f.sink ?? 0));
        }
      }
    }
  });
  it('keeps the head the same size across hairstyles', () => {
    const scales = IMAGE_HAIRS.map(
      (hairStyle) => avatarImagePlan({ ...base(), hairStyle }).layers[0]!.scale,
    );
    expect(Math.max(...scales) / Math.min(...scales)).toBeLessThan(1.15);
  });
  it('layers expression, beard, colours and accessories without touching appearance data or RNG', () => {
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
    const order = [
      'hair-long-back',
      'base',
      'kit',
      'expr-pain',
      'beard-full',
      'hair-long',
      'band-long',
      'goggles',
      'wrist',
    ];
    expect(names(p)).toEqual(order);
    expect(p.layers.filter((l) => l.filters.length).length).toBeGreaterThan(5);
    expect(JSON.stringify(sp)).toBe(before);
    expect(getActiveRng().getState()).toEqual(rng);
  });
  it('dresses goalkeepers in every pose, but not soldiers or the retirement suit', () => {
    const keeper: AvatarSpec = { ...base(), keeperKit: 2, gloves: 4, kneePads: 1 };
    for (const pose of ['stand', ...MINI_POSES]) {
      const s = names(avatarImagePlan(keeper, { ms: 100, pose } as MotionFrame));
      expect(s).toContain('keeper');
      expect(s).not.toContain('kit');
      expect(s.indexOf('kneepads')).toBeGreaterThan(s.indexOf('keeper'));
      expect(s.indexOf('gloves')).toBeGreaterThan(s.indexOf(`hair-${keeper.hairStyle}`));
    }
    // 0은 구단 유니폼 · 맨손이다.
    expect(names(avatarImagePlan({ ...base(), keeperKit: 0, gloves: 0 }))).toContain('kit');
    const retired = { ...retiredAvatarSpec('retired-keeper', 40), keeperKit: 2, gloves: 4 };
    expect(names(avatarImagePlan(retired))).not.toContain('gloves');
    expect(names(avatarImagePlan(retired))).toContain('suit');
  });
  it('keeps injury/retirement still with their props and dresses soldiers in every motion', () => {
    const injured: AvatarSpec = { ...base(), acc: ['bandage', 'crutch'] };
    const retired = retiredAvatarSpec('retired-image', 42);
    for (const [spec, prop] of [
      [injured, 'crutch'],
      [retired, 'bouquet'],
    ] as const) {
      const p = avatarImagePlan(spec, { ms: 100, pose: 'runL', lift: 3 });
      expect(names(p)).toContain(prop);
      expect(p.decorations).toBeUndefined();
    }
    expect(names(avatarImagePlan(retired))).toContain('suit');
    const g = newGame(
      { name: 'a', number: 9, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' },
      7,
    );
    g.mil.serving = true;
    g.mil.type = 'army';
    const army = avatarSpec(g);
    expect(avatarMotionImageSources(army)).toContain('runL');
    for (const pose of MINI_POSES) {
      const s = names(avatarImagePlan(army, { ms: 100, pose }));
      expect(s).toContain('army');
      expect(s).not.toContain('kit');
    }
  });
  it('preloads every atlas a motion can switch to', () => {
    const sp = base();
    const pre = new Set(avatarMotionImageSources(sp));
    for (const m of Object.values(MOTIONS))
      for (const f of m.frames)
        for (const s of sources(avatarImagePlan(sp, f))) expect(pre).toContain(s);
  });
  it('retains non-player ball/trophy effects, kit pattern and portrait viewports', () => {
    expect(
      avatarImagePlan(base(), { ms: 100, pose: 'lift', trophy: true, sparkle: true }).decorations
        ?.length,
    ).toBeGreaterThan(0);
    expect(
      avatarImagePlan(base(), { ms: 100, pose: 'kick', ball: { from: 'at', d: [30, 45] } })
        .decorations?.length,
    ).toBeGreaterThan(0);
    expect(avatarImagePlan(base()).layers.some((l) => l.pattern?.rects.length)).toBe(true);
    expect(avatarImagePlan(base(), undefined, true).height).toBe(21);
  });
});
