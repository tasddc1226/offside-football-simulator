import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { avatarImagePlan, IMAGE_HAIRS, IMAGE_SHEETS } from './avatar-image.js';
import { avatarSpec, primeAvatarSpec, retiredAvatarSpec, type AvatarSpec } from './avatar.js';
import { newGame } from './engine.js';
import { createRng, setActiveRng, getActiveRng } from './rng.js';

const base = () => primeAvatarSpec({ id: 'image-contract', lastClub: '' });
const sources = (p: ReturnType<typeof avatarImagePlan>) => p.layers.map((l) => l.source);
const names = (p: ReturnType<typeof avatarImagePlan>) => [...new Set(p.layers.map((l) => l.layer))];
describe('paper-doll avatar layer contract', () => {
  it('ships one standing atlas as an RGBA PNG with every part inside it', () => {
    // T-11-270 모션 자세는 지웠다. 선수는 서 있는 자세 한 장으로만 그린다.
    expect(Object.keys(IMAGE_SHEETS)).toEqual(['stand']);
    const sheet = IMAGE_SHEETS.stand!;
    const bytes = readFileSync(new URL('../assets/avatar-layers/stand.png', import.meta.url));
    expect(bytes.subarray(1, 4).toString()).toBe('PNG');
    expect(bytes.readUInt32BE(16)).toBe(sheet.width);
    expect(bytes.readUInt32BE(20)).toBe(sheet.height);
    expect(bytes[25]).toBe(6); // IHDR RGBA colour type
  });
  it('draws the same base body under every hairstyle, inside the frame', () => {
    // 완전 민머리는 맨몸 머리 그대로라 머리카락 층이 없고 헤어밴드만 있다.
    for (const hairStyle of IMAGE_HAIRS)
      for (const portrait of [false, true]) {
        const plan = avatarImagePlan({ ...base(), hairStyle, band: 2 }, portrait);
        // 어깨 뒤 머리카락만 맨몸보다 먼저 그린다.
        expect(names(plan).filter((n) => !n.endsWith('-back'))[0]).toBe('base');
        if (hairStyle !== 'bald') expect(names(plan)).toContain(`hair-${hairStyle}`);
        expect(names(plan)).toContain(`band-${hairStyle}`);
        expect(names(plan)).toContain('kit');
        expect(new Set(sources(plan))).toEqual(new Set(['stand']));
        for (const l of plan.layers) {
          const sheet = IMAGE_SHEETS[l.source]!;
          expect(l.crop[0] + l.crop[2]).toBeLessThanOrEqual(sheet.width);
          expect(l.crop[1] + l.crop[3]).toBeLessThanOrEqual(sheet.height);
          expect(l.scale).toBeGreaterThan(0);
          expect(l.x).toBeGreaterThanOrEqual(-0.001);
          expect(l.y).toBeGreaterThanOrEqual(-0.001);
          expect(l.x + l.crop[2] * l.scale).toBeLessThanOrEqual(24.001);
          expect(l.y + l.crop[3] * l.scale).toBeLessThanOrEqual(32.001);
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
    const p = avatarImagePlan(sp);
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
  it('dresses goalkeepers, but not soldiers or the retirement suit', () => {
    const keeper: AvatarSpec = { ...base(), keeperKit: 2, gloves: 4, kneePads: 1 };
    const s = names(avatarImagePlan(keeper));
    expect(s).toContain('keeper');
    expect(s).not.toContain('kit');
    expect(s.indexOf('kneepads')).toBeGreaterThan(s.indexOf('keeper'));
    expect(s.indexOf('gloves')).toBeGreaterThan(s.indexOf(`hair-${keeper.hairStyle}`));
    // 0은 구단 유니폼 · 맨손이다.
    expect(names(avatarImagePlan({ ...base(), keeperKit: 0, gloves: 0 }))).toContain('kit');
    const retired = { ...retiredAvatarSpec('retired-keeper', 40), keeperKit: 2, gloves: 4 };
    expect(names(avatarImagePlan(retired))).not.toContain('gloves');
    expect(names(avatarImagePlan(retired))).toContain('suit');
  });
  it('keeps injury/retirement props and dresses soldiers', () => {
    const injured: AvatarSpec = { ...base(), acc: ['bandage', 'crutch'] };
    expect(names(avatarImagePlan(injured))).toContain('crutch');
    expect(names(avatarImagePlan(retiredAvatarSpec('retired-image', 42)))).toContain('bouquet');
    const g = newGame(
      { name: 'a', number: 9, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' },
      7,
    );
    g.mil.serving = true;
    g.mil.type = 'army';
    const s = names(avatarImagePlan(avatarSpec(g)));
    expect(s).toContain('army');
    expect(s).not.toContain('kit');
  });
  it('retains the kit pattern and portrait viewport', () => {
    expect(avatarImagePlan(base()).layers.some((l) => l.pattern?.rects.length)).toBe(true);
    expect(avatarImagePlan(base(), true).height).toBe(21);
  });
});
