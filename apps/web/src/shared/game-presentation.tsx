import { useEffect, useState, type ReactNode } from 'react';
import { Button, FootballMark, ScreenTransition } from '@offside/ui';
import { useReducedMotion } from './ui-store.js';
import './game-presentation.css';

const DEFAULT_REVEAL_MS = 560;
const FAST_REVEAL_MS = 180;
const DEFAULT_DELAYED_REVEAL_MS = 420;

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

/**
 * UX-012: 저장 성공 화면과 실제 목적 화면 사이를 잇는 3초 고정 전환. `@offside/ui`의
 * `ScreenTransition`에 앱의 모션 감소 설정(useReducedMotion, 시스템+앱 통합값)만 주입하는 얇은
 * 래퍼다 — 지속 시간 prop도, 입력 모달리티(키보드) 스킵도 두지 않는다(사용자 결정: 3초 고정,
 * 스킵 불가). `waitFor`를 넘기면 onComplete는 max(3초, waitFor 완료) 시점에 불리고, waitFor가
 * reject되면 onError로 넘어간다.
 */
export function GameCompletionTransition({
  title,
  detail,
  onComplete,
  onError,
  visual,
  children,
  stages,
  waitFor,
}: {
  title: string;
  detail: string;
  onComplete: () => void;
  onError?: (error: unknown) => void;
  visual?: ReactNode;
  children?: ReactNode;
  stages?: string[];
  waitFor?: Promise<unknown>;
}) {
  const reducedMotion = useReducedMotion();

  return (
    <ScreenTransition
      title={title}
      detail={detail}
      onComplete={onComplete}
      reducedMotion={reducedMotion}
      {...(onError !== undefined ? { onError } : {})}
      {...(visual !== undefined ? { visual } : {})}
      {...(stages !== undefined ? { stages } : {})}
      {...(waitFor !== undefined ? { waitFor } : {})}
    >
      {children}
    </ScreenTransition>
  );
}

/**
 * UX-010 P2b: 이미 공개된 결과 안에서 평점처럼 서스펜스가 필요한 값 하나만 짧게(기본 420ms, 0.5초
 * 이내) 늦춰 드러낸다. 모션 감소·키보드 입력 모드는 GameResultReveal과 같은 기준으로 지연 없이
 * 즉시 true를 돌려준다. 확정값 자체는 지연 대상 컴포넌트(CountUp 등)가 처음부터 접근성 이름에
 * 담으므로, 이 훅은 순수하게 시각 타이밍만 맡는다(스코어보드는 그대로, 평점만 늦게).
 */
export function useDelayedReveal(delayMs: number = DEFAULT_DELAYED_REVEAL_MS): boolean {
  const reducedMotion = useReducedMotion();
  const immediate = reducedMotion || document.documentElement.dataset.inputModality === 'keyboard';
  const [revealed, setRevealed] = useState(immediate);

  useEffect(() => {
    if (immediate) {
      setRevealed(true);
      return;
    }
    setRevealed(false);
    const timer = window.setTimeout(() => setRevealed(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, immediate]);

  return revealed;
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
