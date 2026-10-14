import bald from '../assets/original-avatar/bald.png';
import shaved from '../assets/original-avatar/shaved.png';
import dread from '../assets/original-avatar/dread.png';
import fauxhawk from '../assets/original-avatar/fauxhawk.png';
import ponytail from '../assets/original-avatar/ponytail.png';
import mullet from '../assets/original-avatar/mullet.png';
import keeper from '../assets/original-avatar/keeper.png';
import frames from '../assets/original-avatar/frames.json';

/** Unmodified source PNGs. A viewport selects the sprite; no pixels are repainted. */
export const ORIGINAL_AVATARS = { bald, shaved, dread, fauxhawk, ponytail, mullet, keeper };
export type OriginalAvatarStyle = keyof typeof ORIGINAL_AVATARS;
export type OriginalAvatarPose = 'standing' | 'running' | 'shooting';
const POSES: Record<OriginalAvatarPose, number> = { standing: 0, running: 1, shooting: 2 };

export function originalAvatarFrame(
  style: OriginalAvatarStyle,
  pose: OriginalAvatarPose,
  portrait = false,
) {
  const [x, y, width, height] = frames[style][POSES[pose]]!;
  // The portrait is the standing source's head and shoulders, not regenerated art.
  return { x: x!, y: y!, width: width!, height: portrait ? height! * 0.58 : height! };
}

/** Local review only. Never changes a career's stored look or public identity. */
export function originalAvatarPreview(): OriginalAvatarStyle | undefined {
  if (!import.meta.env.DEV || typeof location === 'undefined') return undefined;
  const style = new URLSearchParams(location.search).get('avatarPng');
  return style && Object.hasOwn(ORIGINAL_AVATARS, style)
    ? (style as OriginalAvatarStyle)
    : undefined;
}
