import { describe, expect, it } from 'vitest';
import { APPEARANCE_OPTIONS, validAppearance } from '@offside/contracts/avatar-look';
import { avatarPixels, cardAvatarSpec, lookOf, retiredAvatarSpec } from './avatar.js';
import { loadMotionPoses, MINI_POSES, motionFrame } from './avatar-motion.js';
import { MINI_SPRITES } from './avatar-mini-data.js';
import { LOOK_STYLES, parseLookCode } from './look.js';
import { hashStr } from './hash.js';

describe('T-11-243 additional hairstyles', () => {
  it('appends six wire values and leaves existing ID-derived styles unchanged', () => {
    expect(LOOK_STYLES.slice(0, 9)).toEqual([
      'short',
      'fringe',
      'long',
      'mohawk',
      'slick',
      'buzz',
      'afro',
      'bun',
      'spiky',
    ]);
    expect(APPEARANCE_OPTIONS.y).toBe(LOOK_STYLES.length);
    for (let i = 0; i < 200; i++) {
      const id = `old-career-${i}`;
      expect(lookOf(id).style).toBe(
        ['short', 'fringe', 'long', 'mohawk'][(hashStr(`avatar:${id}`) >>> 8) % 4],
      );
    }
    for (let i = 9; i < LOOK_STYLES.length; i++) {
      expect(validAppearance(`y${i}`)).toBe(true);
      expect(parseLookCode(`y${i}`).style).toBe(i);
      expect(cardAvatarSpec({ careerId: 'card', look: `y${i}` }).hairStyle).toBe(LOOK_STYLES[i]);
      expect(retiredAvatarSpec('old-retiree', 34, `y${i}`).hairStyle).toBe(LOOK_STYLES[i]);
    }
    expect(validAppearance('y15')).toBe(false);
  });

  it('keeps bald and shaved separate and removes scalp hair from fully bald', () => {
    expect(MINI_SPRITES.bald).not.toEqual(MINI_SPRITES.shaved);
    expect(MINI_SPRITES.bald.slice(0, 16).join('')).not.toMatch(/[hHjJrfF]/);
    expect(MINI_SPRITES.shaved.slice(0, 16).join('')).toContain('r');
  });

  it('changes only hair/scalp while preserving the canonical face and body', async () => {
    const canonical = MINI_SPRITES.short;
    for (const style of LOOK_STYLES.slice(9)) {
      const sprite = MINI_SPRITES[style];
      for (let y = 16; y < 30; y++)
        for (let x = 0; x < 48; x++)
          if (canonical[y]![x] !== '.')
            expect(sprite[y]![x], `${style}/face/${x},${y}`).toBe(canonical[y]![x]);
      expect(sprite.slice(36), `${style}/body`).toEqual(canonical.slice(36));
      const poses = await loadMotionPoses(style);
      for (const pose of MINI_POSES) {
        const {
          rows,
          face: [fx, fy],
        } = poses[pose];
        for (let y = 18; y < 29; y++)
          for (let x = 19; x < 35; x++) {
            const actual = rows[y + fy]![x + fx]!;
            const handOutline =
              actual === 'O' &&
              [-1, 0, 1].some((dy) =>
                [-1, 0, 1].some((dx) => 'uUiI'.includes(rows[y + fy + dy]?.[x + fx + dx] ?? '.')),
              );
            // Foreground hands and their outline may occlude the face.
            if (!'uUiI'.includes(actual) && !handOutline && canonical[y]![x] !== '.')
              expect(actual, `${style}/${pose}/face/${x},${y}`).toBe(canonical[y]![x]);
          }
      }
    }
  });

  it('renders each new head in all poses, with accessories and card framing', async () => {
    for (let i = 9; i < LOOK_STYLES.length; i++) {
      const sp = cardAvatarSpec({ careerId: 'card', look: `y${i}s1h2d0` });
      const poses = await loadMotionPoses(sp.hairStyle);
      const stand = avatarPixels(sp);
      expect(stand.slice(0, 42).flat().filter(Boolean).length).toBeGreaterThan(400);
      for (const pose of MINI_POSES) {
        const plain = motionFrame(sp, { ms: 100, pose }, poses);
        const accessorized = motionFrame(
          { ...sp, glasses: 2, wrist: 3, band: 2 },
          { ms: 100, pose },
          poses,
        );
        expect(accessorized, `${sp.hairStyle}/${pose}`).not.toEqual(plain);
        expect(plain[0]!.every((p) => p === null)).toBe(true);
      }
    }
  });
});
