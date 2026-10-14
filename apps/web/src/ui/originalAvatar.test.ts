import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { originalAvatarFrame, type OriginalAvatarStyle } from './originalAvatar';

const generation = JSON.parse(
  readFileSync(
    new URL('../../../../docs/assets/mini-character-v3/generation.json', import.meta.url),
    'utf8',
  ),
) as {
  assets: { name: OriginalAvatarStyle; sha256: string; width: number; height: number }[];
};

describe('original PNG web artwork', () => {
  for (const asset of generation.assets) {
    it(`${asset.name}: serves the original bytes, including alpha, without dot conversion`, () => {
      const bytes = readFileSync(
        new URL(`../assets/original-avatar/${asset.name}.png`, import.meta.url),
      );
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(asset.sha256);
      expect(bytes.readUInt32BE(16)).toBe(asset.width);
      expect(bytes.readUInt32BE(20)).toBe(asset.height);
      expect(bytes[25]).toBe(6); // PNG colour type RGBA; transparency is preserved.
    });
    it(`${asset.name}: clips each whole pose inside the source sheet`, () => {
      for (const pose of ['standing', 'running', 'shooting'] as const) {
        const f = originalAvatarFrame(asset.name, pose);
        expect(f.x).toBeGreaterThanOrEqual(0);
        expect(f.y).toBeGreaterThanOrEqual(0);
        expect(f.width).toBeGreaterThan(0);
        expect(f.height).toBeGreaterThan(0);
        expect(f.x + f.width).toBeLessThanOrEqual(asset.width);
        expect(f.y + f.height).toBeLessThanOrEqual(asset.height);
      }
    });
  }
});
