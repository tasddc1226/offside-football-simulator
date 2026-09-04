export type SwipeDirection = 'left' | 'right';

export interface SwipeSample {
  x: number;
  time: number;
}

export function swipeIntent(x: number, y: number): 'pending' | 'horizontal' | 'vertical' {
  const horizontal = Math.abs(x);
  const vertical = Math.abs(y);
  if (Math.max(horizontal, vertical) < 10) return 'pending';
  if (vertical >= horizontal) return 'vertical';
  return horizontal > vertical * 1.25 ? 'horizontal' : 'pending';
}

/** Keep the last 100 ms: a pause before release must not become a stale flick. */
export function appendSwipeSample(samples: SwipeSample[], sample: SwipeSample): SwipeSample[] {
  return [...samples.filter((item) => sample.time - item.time <= 100), sample].slice(-8);
}

/** Velocity is in px/ms, bounded to keep an irregular event interval harmless. */
export function swipeVelocity(samples: SwipeSample[]): number {
  const first = samples[0];
  const last = samples.at(-1);
  if (!first || !last || last.time <= first.time) return 0;
  return Math.max(-3, Math.min(3, (last.x - first.x) / (last.time - first.time)));
}

export function committedSwipe(
  distance: number,
  velocity: number,
  width: number,
  canSwipeLeft: boolean,
  canSwipeRight: boolean,
): SwipeDirection | null {
  if (distance === 0) return null;
  const direction = distance < 0 ? 'left' : 'right';
  if (direction === 'left' ? !canSwipeLeft : !canSwipeRight) return null;
  // A deliberate reversal cancels, even if the finger previously passed the threshold.
  if (velocity * Math.sign(distance) < -0.2) return null;
  const travelled = Math.abs(distance);
  if (travelled >= Math.max(72, width * 0.25)) return direction;
  if (travelled >= 40 && velocity * Math.sign(distance) >= 0.55) return direction;
  return null;
}

/** Track 1:1 until the useful travel ends, then progressively resist the boundary. */
export function resistedSwipe(distance: number, width: number): number {
  const bound = Math.max(72, width * 0.6);
  const overshoot = Math.max(0, Math.abs(distance) - bound);
  const dimension = Math.max(24, width * 0.2);
  const resistance = (overshoot * dimension * 0.55) / (dimension + 0.55 * overshoot);
  return Math.sign(distance) * (Math.min(Math.abs(distance), bound) + resistance);
}

/** Exact critically damped spring step; position and velocity survive interruption. */
export function stepSwipeSpring(position: number, velocity: number, elapsedMs: number) {
  const omega = 0.032;
  const time = Math.max(0, elapsedMs);
  const coefficient = velocity + omega * position;
  const decay = Math.exp(-omega * time);
  return {
    position: (position + coefficient * time) * decay,
    velocity: (velocity - omega * coefficient * time) * decay,
  };
}
