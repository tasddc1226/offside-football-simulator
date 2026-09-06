import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, FootballMark } from '@offside/ui';
import { useReducedMotion } from './ui-store.js';
import './game-presentation.css';

const DEFAULT_REVEAL_MS = 560;
const FAST_REVEAL_MS = 180;
const DEFAULT_COMPLETION_MS = 650;

export function GamePending({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="os-panel flex items-start gap-os-3" role="status" aria-live="polite">
      <span className="mt-os-2 flex gap-os-1 text-os-accent" aria-hidden="true">
        <span className="os-game-pending-dot" />
        <span className="os-game-pending-dot" style={{ animationDelay: '150ms' }} />
        <span className="os-game-pending-dot" style={{ animationDelay: '300ms' }} />
      </span>
      <span className="flex flex-col gap-os-1">
        <strong className="font-os text-os-text">{title}</strong>
        <span className="font-os text-os-text-2">{detail}</span>
      </span>
    </div>
  );
}

/** A saved-success bridge between a command screen and its real destination. */
export function GameCompletionTransition({
  title,
  detail,
  onComplete,
  durationMs = DEFAULT_COMPLETION_MS,
  visual,
  children,
}: {
  title: string;
  detail: string;
  onComplete: () => void;
  durationMs?: number;
  visual?: ReactNode;
  children?: ReactNode;
}) {
  const reducedMotion = useReducedMotion();
  const keyboard = document.documentElement.dataset.inputModality === 'keyboard';
  const completedRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const complete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    onCompleteRef.current();
  }, []);

  useEffect(() => {
    timerRef.current = window.setTimeout(complete, reducedMotion || keyboard ? 0 : durationMs);
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [complete, durationMs, keyboard, reducedMotion]);

  return (
    <div className="os-game-completion flex flex-col items-center gap-os-4 text-center" role="status" aria-live="polite">
      {visual ?? (
        <div className="os-game-completion-mark" aria-hidden="true">
          <span className="os-game-completion-line" />
          <FootballMark className="os-game-completion-ball h-10 w-10 text-os-accent" />
        </div>
      )}
      <div className="flex flex-col gap-os-1">
        <strong className="font-os text-os-text">{title}</strong>
        <span className="font-os text-os-text-2">{detail}</span>
      </div>
      {children}
      {!reducedMotion && !keyboard ? (
        <Button variant="ghost" onClick={complete}>바로 계속</Button>
      ) : null}
    </div>
  );
}

export function GameResultReveal({
  children,
  fast = false,
  announcement,
  durationMs = DEFAULT_REVEAL_MS,
  onSkip,
  announcementTestId,
  skippable = true,
}: {
  children: ReactNode;
  fast?: boolean;
  announcement: string;
  durationMs?: number;
  onSkip?: () => void;
  announcementTestId?: string;
  skippable?: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const immediate = reducedMotion || document.documentElement.dataset.inputModality === 'keyboard';
  const [revealed, setRevealed] = useState(immediate);
  const [liveAnnouncement, setLiveAnnouncement] = useState('');

  useEffect(() => {
    if (immediate) {
      setRevealed(true);
      return;
    }
    setRevealed(false);
    const timer = window.setTimeout(() => setRevealed(true), fast ? FAST_REVEAL_MS : durationMs);
    return () => window.clearTimeout(timer);
  }, [durationMs, fast, immediate]);

  useEffect(() => {
    if (!revealed) return;
    // Keep the live region empty on the initial render. A post-mount text change is announced
    // reliably in FAST and reduced-motion paths as well as after the standard reveal.
    const timer = window.setTimeout(() => setLiveAnnouncement(announcement), 0);
    return () => window.clearTimeout(timer);
  }, [announcement, revealed]);

  function revealNow() {
    setRevealed(true);
    onSkip?.();
  }

  return (
    <div className="flex flex-col gap-os-3">
      <p className="sr-only" aria-live="polite" data-testid={announcementTestId}>{liveAnnouncement}</p>
      {revealed ? (
        <div className="os-game-reveal" data-revealed="true">{children}</div>
      ) : (
        <div className="os-game-reveal-cue os-panel flex flex-col items-center justify-center gap-os-2 text-center" role="status">
          <FootballMark className="h-10 w-10 text-os-accent" />
          <strong className="font-os text-os-text">판정 완료</strong>
          <span className="font-os text-os-text-2">저장된 결과를 공개합니다</span>
        </div>
      )}
      {!revealed && skippable ? (
        <Button variant="secondary" onClick={revealNow}>결과 바로 보기</Button>
      ) : null}
    </div>
  );
}
