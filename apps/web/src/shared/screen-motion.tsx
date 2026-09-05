import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { useReducedMotion } from './ui-store.js';

export type ScreenDirection = 'forward' | 'back' | 'replace';
type NavigationAction = { type: string; index?: number };

/** Public history actions only: never read or manufacture the router's private state index. */
export function screenDirection(
  from: string,
  to: string,
  action: NavigationAction,
): ScreenDirection {
  if (action.type === 'BACK' || (action.type === 'GO' && (action.index ?? 0) < 0)) return 'back';
  if (action.type === 'FORWARD' || action.type === 'GO') return 'forward';
  if (action.type === 'REPLACE') return 'replace';
  if (swipeBackTarget(from) === to) return 'back';
  if (to === '/' || from.startsWith(`${to.replace(/\/$/, '')}/`)) return 'back';
  const fromCreation = from.match(/^(\/career\/[^/]+)\/(create|style|confirm)$/);
  const toCreation = to.match(/^(\/career\/[^/]+)\/(create|style|confirm)$/);
  if (fromCreation && toCreation && fromCreation[1] === toCreation[1]) {
    const steps = ['create', 'style', 'confirm'];
    if (steps.indexOf(toCreation[2]!) < steps.indexOf(fromCreation[2]!)) return 'back';
  }
  return 'forward';
}

/** Explicit safe destinations, not arbitrary history.back() which may leave the app or revive a decision. */
export function swipeBackTarget(pathname: string): string | null {
  if (pathname === '/legal/terms' || pathname === '/legal/privacy') return '/settings';
  const attributes = pathname.match(/^(\/career\/[^/]+)\/attributes\/?$/);
  return attributes?.[1] ?? null;
}

export function playScreenMotion(
  element: HTMLElement,
  direction: ScreenDirection,
  reduced: boolean,
): Animation | null {
  // Match the existing CSS accessibility policy: either OS or in-app reduction disables spatial motion.
  if (
    reduced ||
    document.documentElement.dataset.inputModality === 'keyboard' ||
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ||
    typeof element.animate !== 'function'
  )
    return null;
  const x = direction === 'replace' ? 0 : direction === 'back' ? -24 : 24;
  const animation = element.animate(
    [
      // Dense 13px stat labels must retain contrast even in the first animated frame.
      { transform: `translate3d(${x}px, 0, 0)`, opacity: direction === 'replace' ? 0.98 : 1 },
      { transform: 'translate3d(0, 0, 0)', opacity: 1 },
    ],
    { duration: direction === 'replace' ? 140 : 220, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
  );
  animation.id = 'offside-screen-transition';
  return animation;
}

export function useInputModality(): void {
  useEffect(() => {
    const root = document.documentElement;
    const onPointer = () => {
      root.dataset.inputModality = 'pointer';
    };
    const onKey = (event: KeyboardEvent) => {
      if (!['Shift', 'Control', 'Alt', 'Meta'].includes(event.key))
        root.dataset.inputModality = 'keyboard';
    };
    document.addEventListener('pointerdown', onPointer, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onPointer, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, []);
}

/** Stable DOM identity: never key/remount screens or duplicate live outgoing trees for animation. */
export function MotionPanel({
  motionKey,
  direction = 'forward',
  className = '',
  children,
}: {
  motionKey: string | number;
  direction?: ScreenDirection;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const previousKey = useRef(motionKey);
  const reduced = useReducedMotion();
  useLayoutEffect(() => {
    if (previousKey.current === motionKey) return;
    previousKey.current = motionKey;
    if (!ref.current) return;
    const animation = playScreenMotion(ref.current, direction, reduced);
    return () => animation?.cancel();
  }, [motionKey, direction, reduced]);
  return (
    <div ref={ref} className={`os-motion-panel ${className}`} data-direction={direction}>
      {children}
    </div>
  );
}
