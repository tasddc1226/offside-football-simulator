import { useLayoutEffect, useRef, type ReactNode } from 'react';
import {
  appendSwipeSample,
  committedSwipe,
  resistedSwipe,
  stepSwipeSpring,
  swipeIntent,
  swipeVelocity,
  type SwipeDirection,
  type SwipeSample,
} from './swipe-motion.js';

export interface SwipeSurfaceProps {
  children: ReactNode;
  className?: string;
  canSwipeLeft?: boolean;
  canSwipeRight?: boolean;
  onSwipe: (direction: SwipeDirection) => void;
  disabled?: boolean;
  reducedMotion?: boolean;
  edgeOnly?: boolean;
}

const INTERACTIVE = [
  'a',
  'button',
  'input',
  'select',
  'textarea',
  'form',
  'label',
  'summary',
  '[role="button"]',
  '[role="link"]',
  '[role="tab"]',
  '[role="slider"]',
  '[role="switch"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="menuitem"]',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"]):not([role="tabpanel"])',
  '[data-swipe-ignore]',
].join(',');

function ignoresSwipe(target: EventTarget | null, surface: HTMLElement): boolean {
  if (!(target instanceof Element)) return true;
  if (target.closest('[data-swipe-surface]') !== surface || target.closest(INTERACTIVE))
    return true;
  for (let element: Element | null = target; element; element = element.parentElement) {
    if (element.scrollWidth > element.clientWidth + 1) {
      const overflow = getComputedStyle(element).overflowX;
      if (overflow === 'auto' || overflow === 'scroll') return true;
    }
    if (element === surface) break;
  }
  return false;
}

function interactionBlocked() {
  const focused = document.activeElement;
  const editing =
    focused instanceof HTMLElement &&
    (focused.matches('input, textarea, select') ||
      focused.closest('[contenteditable]:not([contenteditable="false"])'));
  return (
    Boolean(editing) ||
    Boolean(document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"]')) ||
    Boolean(window.getSelection()?.toString())
  );
}

interface Gesture {
  pointerId: number;
  startX: number;
  startY: number;
  width: number;
  offset: number;
  dragging: boolean;
  samples: SwipeSample[];
}

/** Optional touch navigation. Callers, not the gesture, decide which views are safe to leave. */
export function SwipeSurface({
  children,
  className = '',
  canSwipeLeft = false,
  canSwipeRight = false,
  onSwipe,
  disabled = false,
  reducedMotion = false,
  edgeOnly = false,
}: SwipeSurfaceProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const onSwipeRef = useRef(onSwipe);
  const enabled = !disabled && (canSwipeLeft || canSwipeRight);

  useLayoutEffect(() => {
    onSwipeRef.current = onSwipe;
  }, [onSwipe]);

  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    const content = contentRef.current;
    if (!surface || !content || !enabled) return;

    let gesture: Gesture | null = null;
    let frame: number | null = null;
    let position = 0;
    let velocity = 0;
    let suppressClickUntil = 0;
    const motionPreference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let suppressMotion = reducedMotion || Boolean(motionPreference?.matches);

    function paint(next: number) {
      position = next;
      if (content) content.style.transform = next === 0 ? '' : `translateX(${next}px)`;
    }

    function stopSpring() {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
    }

    function reset() {
      stopSpring();
      velocity = 0;
      paint(0);
      content?.style.removeProperty('will-change');
      surface?.removeAttribute('data-dragging');
    }

    function settle(releaseVelocity = velocity) {
      stopSpring();
      surface?.removeAttribute('data-dragging');
      if (suppressMotion || Math.abs(position) < 0.25) {
        reset();
        return;
      }
      velocity = releaseVelocity;
      let previous = performance.now();
      const started = previous;
      function tick(time: number) {
        const spring = stepSwipeSpring(position, velocity, time - previous);
        previous = time;
        velocity = spring.velocity;
        paint(spring.position);
        if ((Math.abs(position) < 0.25 && Math.abs(velocity) < 0.01) || time - started >= 300) {
          reset();
        } else {
          frame = requestAnimationFrame(tick);
        }
      }
      frame = requestAnimationFrame(tick);
    }

    function releaseCapture(pointerId: number) {
      if (surface?.hasPointerCapture?.(pointerId)) surface.releasePointerCapture(pointerId);
    }

    function cancel(immediate = false) {
      const current = gesture;
      gesture = null;
      if (current) {
        releaseCapture(current.pointerId);
        if (current.dragging) suppressClickUntil = performance.now() + 450;
      }
      if (immediate) reset();
      else settle();
    }

    function pointerDown(event: PointerEvent) {
      suppressClickUntil = 0;
      if (gesture || !event.isPrimary || !['touch', 'pen'].includes(event.pointerType)) return;
      if (event.button !== 0 || event.defaultPrevented || !surface) return;
      if (interactionBlocked() || ignoresSwipe(event.target, surface)) return;
      const rect = surface.getBoundingClientRect();
      const fromEdge = event.clientX - rect.left;
      if (edgeOnly && (fromEdge < 0 || fromEdge > 28)) return;
      stopSpring();
      gesture = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        width: rect.width,
        offset: position,
        dragging: false,
        samples: [{ x: event.clientX, time: event.timeStamp }],
      };
    }

    function pointerMove(event: PointerEvent) {
      const current = gesture;
      if (!current || current.pointerId !== event.pointerId) return;
      if (interactionBlocked()) {
        cancel();
        return;
      }
      const x = event.clientX - current.startX;
      const y = event.clientY - current.startY;
      current.samples = appendSwipeSample(current.samples, {
        x: event.clientX,
        time: event.timeStamp,
      });
      const intent = swipeIntent(x, y);
      if (intent === 'vertical') {
        cancel();
        return;
      }
      if (!current.dragging) {
        if (intent !== 'horizontal') return;
        if ((x < 0 && !canSwipeLeft) || (x > 0 && !canSwipeRight)) {
          cancel();
          return;
        }
        current.dragging = true;
        surface?.setAttribute('data-dragging', 'true');
        if (!suppressMotion) content?.style.setProperty('will-change', 'transform');
        // Capture only after direction is clear; taps and vertical scrolling remain native.
        try {
          surface?.setPointerCapture?.(event.pointerId);
        } catch {
          // A cancelled native gesture may already have released this pointer.
          cancel(true);
          return;
        }
      }
      if (event.cancelable) event.preventDefault();
      velocity = swipeVelocity(current.samples);
      let next = current.offset + x;
      if (!canSwipeLeft) next = Math.max(0, next);
      if (!canSwipeRight) next = Math.min(0, next);
      if (!suppressMotion) paint(resistedSwipe(next, current.width));
    }

    function pointerUp(event: PointerEvent) {
      const current = gesture;
      if (!current || current.pointerId !== event.pointerId) return;
      gesture = null;
      releaseCapture(current.pointerId);
      if (!current.dragging || interactionBlocked()) {
        settle();
        return;
      }
      suppressClickUntil = performance.now() + 450;
      const x = event.clientX - current.startX;
      const y = event.clientY - current.startY;
      current.samples = appendSwipeSample(current.samples, {
        x: event.clientX,
        time: event.timeStamp,
      });
      const releaseVelocity = swipeVelocity(current.samples);
      const direction =
        swipeIntent(x, y) === 'horizontal'
          ? committedSwipe(x, releaseVelocity, current.width, canSwipeLeft, canSwipeRight)
          : null;
      if (direction) {
        // Navigation owns the incoming animation. Never spring the newly rendered page back.
        reset();
        onSwipeRef.current(direction);
      } else {
        settle(releaseVelocity);
      }
    }

    function pointerCancel(event: PointerEvent) {
      if (gesture?.pointerId === event.pointerId) cancel();
    }

    function lostPointerCapture(event: PointerEvent) {
      // Touch implicitly captures the tapped child. Claiming the gesture transfers that capture
      // to this surface and the child's lostpointercapture bubbles here; that is not cancellation.
      if (event.target === surface) pointerCancel(event);
    }

    function additionalPointer(event: PointerEvent) {
      if (gesture && event.pointerId !== gesture.pointerId) cancel();
    }

    function click(event: MouseEvent) {
      if (event.detail > 0 && performance.now() < suppressClickUntil) {
        event.preventDefault();
        event.stopPropagation();
        suppressClickUntil = 0;
      }
    }

    function visibilityChange() {
      if (document.hidden) cancel(true);
    }

    function windowBlur() {
      cancel(true);
    }

    function motionPreferenceChange() {
      suppressMotion = reducedMotion || Boolean(motionPreference?.matches);
      cancel(true);
    }

    surface.addEventListener('pointerdown', pointerDown);
    surface.addEventListener('pointermove', pointerMove, { passive: false });
    surface.addEventListener('pointerup', pointerUp);
    surface.addEventListener('pointercancel', pointerCancel);
    surface.addEventListener('lostpointercapture', lostPointerCapture);
    surface.addEventListener('click', click, true);
    document.addEventListener('pointerdown', additionalPointer, true);
    document.addEventListener('visibilitychange', visibilityChange);
    window.addEventListener('blur', windowBlur);
    motionPreference?.addEventListener('change', motionPreferenceChange);
    return () => {
      cancel(true);
      surface.removeEventListener('pointerdown', pointerDown);
      surface.removeEventListener('pointermove', pointerMove);
      surface.removeEventListener('pointerup', pointerUp);
      surface.removeEventListener('pointercancel', pointerCancel);
      surface.removeEventListener('lostpointercapture', lostPointerCapture);
      surface.removeEventListener('click', click, true);
      document.removeEventListener('pointerdown', additionalPointer, true);
      document.removeEventListener('visibilitychange', visibilityChange);
      window.removeEventListener('blur', windowBlur);
      motionPreference?.removeEventListener('change', motionPreferenceChange);
    };
  }, [canSwipeLeft, canSwipeRight, edgeOnly, enabled, reducedMotion]);

  return (
    <div
      ref={surfaceRef}
      className={`os-swipe-surface ${className}`.trim()}
      data-swipe-surface=""
      data-swipe-enabled={enabled ? 'true' : 'false'}
      data-swipe-edge={edgeOnly ? 'true' : 'false'}
    >
      <div ref={contentRef} className="os-swipe-content">
        {children}
      </div>
    </div>
  );
}
