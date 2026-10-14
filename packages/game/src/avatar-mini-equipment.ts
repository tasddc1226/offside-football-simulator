import { mix } from './color.js';
import type { MiniBody, MiniColors } from './avatar-mini.js';

type Point = { x: number; y: number; distance: number };
const regions = new WeakMap<readonly string[], { arms: Point[][]; knees: Point[] }>();
const SKIN = 'sSLNuUiI';
const SHIRT = 'kKlzvVgG';
const FOREGROUND = 'uUiI';
const LEG_START: Record<string, number> = {
  air: 3,
  runL: 8,
  runR: 8,
  juggle: 6,
  kick: 5,
  tuck: 6,
  sad: 8,
};

/** Follow the authored limb pixels instead of stamping accessories at a fixed screen position. */
export function paintEquipment(
  px: (string | null)[][],
  src: readonly string[],
  c: MiniColors,
  body: MiniBody,
  pose?: { stand: readonly string[]; at: readonly [number, number]; id?: string },
) {
  if (!c.glove && !c.longSleeve && !c.kneePad) return;
  let parts = regions.get(src);
  if (!parts) {
    const H = src.length,
      W = src[0]!.length;
    const shirt: { x: number; y: number }[] = [];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) if (SHIRT.includes(src[y]![x]!)) shirt.push({ x, y });
    const [fx, fy] = pose?.at ?? [0, 0];
    // These authored poses put a forearm against the ear/scalp. Skin connectivity
    // alone merges that arm into the face; keep the limb on its own layer.
    const foregroundArm = (x: number, y: number) =>
      (pose?.id === 'waveLow' && x <= fx + 12 && y >= fy + 17) ||
      (pose?.id === 'waveHigh' && x <= fx + 11 && y >= fy + 11) ||
      (pose?.id === 'lift' && (x <= fx + 16 || x >= fx + 33) && y < fy + 27);
    // Face skin is a separate island inside its outline. This also protects the
    // face when legacy poses place the hands over the standing-head silhouette.
    const face = new Set<number>();
    let seed: { x: number; y: number } | undefined,
      nearest = Infinity;
    for (let y = Math.max(0, fy + 10); y < Math.min(H, fy + 30); y++)
      for (let x = Math.max(0, fx + 16); x < Math.min(W, fx + 39); x++) {
        if (!'sSLN'.includes(src[y]?.[x] ?? '.')) continue;
        const d = Math.abs(x - fx - 29) + Math.abs(y - fy - 21);
        if (d < nearest) {
          seed = { x, y };
          nearest = d;
        }
      }
    const queue = seed ? [seed] : [];
    for (let i = 0; i < queue.length; i++) {
      const { x, y } = queue[i]!;
      const key = y * W + x;
      if (
        face.has(key) ||
        x < fx + 5 ||
        x >= fx + 44 ||
        y < fy ||
        y >= fy + 34 ||
        foregroundArm(x, y) ||
        !'sSLN'.includes(src[y]?.[x] ?? '.')
      )
        continue;
      face.add(key);
      queue.push({ x: x - 1, y }, { x: x + 1, y }, { x, y: y - 1 }, { x, y: y + 1 });
    }
    const mask = src.map((row, y) =>
      [...row].map(
        (ch, x) => SKIN.includes(ch) && (FOREGROUND.includes(ch) || !face.has(y * W + x)),
      ),
    );
    const arms: Point[][] = [],
      knees: Point[] = [];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (!mask[y]![x]) continue;
        const group: Point[] = [],
          queue = [{ x, y }];
        mask[y]![x] = false;
        for (let i = 0; i < queue.length; i++) {
          const p = queue[i]!;
          const distance = Math.min(...shirt.map((q) => Math.abs(q.x - p.x) + Math.abs(q.y - p.y)));
          group.push({ ...p, distance });
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]) {
            const xx = p.x + dx!,
              yy = p.y + dy!;
            if (mask[yy]?.[xx]) {
              mask[yy]![xx] = false;
              queue.push({ x: xx, y: yy });
            }
          }
        }
        const top = Math.min(...group.map((p) => p.y));
        // Exposed legs start beside the shorts, below the bottom edge of the shirt.
        const besideShorts = group.some((p) =>
          [-1, 1].some((dy) => 'pPq'.includes(src[p.y + dy]?.[p.x] ?? '.')),
        );
        // Foreshortened raised legs start higher than the standing waist.
        const legStart = LEG_START[pose?.id ?? ''] ?? 11;
        if (top >= body.collarY + legStart && besideShorts) {
          knees.push(...group.filter((p) => p.y <= top + 3));
        } else if (group.length >= 3 && Math.min(...group.map((p) => p.distance)) <= 5) {
          // Exclude a small exposed neck, while keeping hands raised above the face.
          if (
            group.every(
              (p) =>
                p.y >= body.collarY - 2 &&
                p.y < body.collarY + 4 &&
                p.x > body.ox + 17 &&
                p.x < body.ox + 31,
            )
          )
            continue;
          arms.push(group);
        }
      }
    regions.set(src, (parts = { arms, knees }));
  }
  for (const arm of parts.arms) {
    const end = Math.max(...arm.map((p) => p.distance));
    const cuff = Math.max(1, end - 4);
    for (const p of arm) {
      if (c.glove && p.distance >= cuff) {
        px[p.y]![p.x] =
          p.distance === cuff && end > cuff
            ? '#25313c'
            : mix(c.glove, '#171b31', (p.x + p.y) % 4 === 0 ? 0.25 : 0);
      } else if (c.longSleeve && p.distance < cuff) {
        px[p.y]![p.x] = mix(c.shirt(0, 14), '#171b31', p.x % 3 === 0 ? 0.25 : 0);
      }
    }
  }
  if (c.kneePad)
    for (const p of parts.knees)
      px[p.y]![p.x] = mix(c.kneePad, '#171b31', p.y % 3 === 0 ? 0.25 : 0);
}
