import { useEffect, useRef, type ReactNode } from 'react';
import { SwipeSurface } from '@offside/ui';
import { useIsMutating } from '@tanstack/react-query';
import { useRouter, useRouterState } from '@tanstack/react-router';
import { queryClient } from './query-client.js';
import {
  playScreenMotion,
  screenDirection,
  swipeBackTarget,
  useInputModality,
} from './screen-motion.js';
import { useReducedMotion } from './ui-store.js';

export function AppMotionFrame({ children }: { children: ReactNode }) {
  useInputModality();
  const router = useRouter();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigating = useRouterState({ select: (state) => state.isLoading });
  const mutating = useIsMutating() > 0;
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const animation = useRef<Animation | null>(null);
  const backTarget = swipeBackTarget(pathname);

  useEffect(() => {
    let action: { type: string; index?: number } = { type: 'PUSH' };
    const stopHistory = router.history.subscribe((event) => {
      action = event.action;
    });
    // location changes before async loaders finish. onRendered targets the COMMITTED destination DOM.
    const stopRendered = router.subscribe(
      'onRendered',
      ({ fromLocation, toLocation, pathChanged }) => {
        if (!pathChanged || !fromLocation || !ref.current) return;
        animation.current?.cancel();
        const direction = screenDirection(fromLocation.pathname, toLocation.pathname, action);
        ref.current.dataset.direction = direction;
        animation.current = playScreenMotion(ref.current, direction, reduced);
        action = { type: 'PUSH' };
      },
    );
    return () => {
      stopHistory();
      stopRendered();
      animation.current?.cancel();
    };
  }, [router, reduced]);

  function handleBack() {
    // Recheck at release, not only at pointerdown: a background mutation/dialog may have started.
    if (
      !backTarget ||
      router.state.isLoading ||
      queryClient.isMutating() > 0 ||
      document.querySelector('[role="dialog"][data-state="open"]')
    )
      return;
    void router.navigate({ to: backTarget });
  }

  return (
    <div ref={ref} className="os-route-motion" data-swipe-back-enabled={Boolean(backTarget)}>
      <SwipeSurface
        edgeOnly
        canSwipeRight={backTarget !== null}
        disabled={mutating || navigating}
        reducedMotion={reduced}
        onSwipe={handleBack}
      >
        {children}
      </SwipeSurface>
    </div>
  );
}
