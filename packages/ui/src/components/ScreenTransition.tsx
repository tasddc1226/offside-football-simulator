import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { FootballMark } from './ScreenIntro.js';

/**
 * UX-012: 전역 화면 전환 연출은 예외 없이 3초로 고정한다. 호출처가 이 값을 바꿀 수 있는 prop은
 * 두지 않는다(사용자 결정) — 실제 작업이 더 걸리면 `waitFor`가 이 시간을 늘릴 뿐, 줄일 수는 없다.
 */
export const SCREEN_TRANSITION_MS = 3000;

/** waitFor가 3초보다 오래 걸릴 때 바를 멈춰 두는 지점. 100%는 실제 완료 확인 뒤에만 채운다. */
const PENDING_CEILING_PERCENT = 96;

/** 진행 바를 갱신하는 간격(ms). 60~100ms 범위에서 rAF 없이도 매끄럽게 보이는 값. */
const PROGRESS_TICK_MS = 80;

/** 0(무게 없음) ~ 1(선형) 사이 값. smoothstep을 이 비율만큼만 선형에 섞어 "앞 살짝 느리게 →
 * 중간 거의 선형 → 뒤 살짝 감속" 곡선을 만든다. 값이 클수록 양 끝이 더 완만해진다. */
const EASE_BLEND = 0.28;

/** fraction(경과/3초, 0~1)을 진행률 비율(0~1)로 변환한다. smoothstep(3x²-2x³)은 양 끝에서
 * 기울기가 0이라 시작·종료가 완만해지고, 대부분 구간(중간)은 선형에 가깝게 유지된다. 두 곡선이
 * 모두 [0,1]→[0,1] 단조 증가이므로 볼록조합도 단조 증가 — 역행(진행률 감소)은 발생하지 않는다. */
function easeProgress(fraction: number): number {
  const x = Math.min(1, Math.max(0, fraction));
  const smoothstep = x * x * (3 - 2 * x);
  return (1 - EASE_BLEND) * x + EASE_BLEND * smoothstep;
}

export interface ScreenTransitionProps {
  /** 전환 중 보여줄 제목. 세계관 톤의 한 문장. */
  title: string;
  /** 제목 아래 보조 설명. */
  detail: string;
  /** max(3초, waitFor 완료) 시점에 정확히 한 번 호출된다. */
  onComplete: () => void;
  /** 앱의 모션 감소 설정(시스템+앱 통합값)을 그대로 넘긴다. true면 진행 바 없이, waitFor가
   * 끝나는 즉시 완료한다 — 입력 모달리티(키보드 등)는 더 이상 스킵 조건이 아니다. */
  reducedMotion: boolean;
  /** 장식 슬롯. 기본값은 FootballMark 계열 장식이다. DSN-LINE-001 오프사이드 라인은 호출처가
   * 허용된 순간에만 명시적으로 넘긴다(예: `<OffsideLine />`). */
  visual?: ReactNode;
  /** DisplayWord 등 브랜드 어휘 슬롯. */
  children?: ReactNode;
  /** 3초를 균등 분할해 각 구간마다 보여줄 단계 문구. 렌더 사이에 배열 참조가 바뀌면 안 된다 —
   * 호출처는 모듈 최상단 상수나 마운트 시점에 고정한 값을 넘긴다(예: `useState(() => [...])`). */
  stages?: string[];
  /** 실제 비동기 작업(도메인 커맨드 등). onComplete는 이 프라미스가 끝날 때까지 기다린다 —
   * 3초가 먼저 지나도 waitFor가 끝나지 않으면 바를 95% 근처에서 대기시킨다. 호출처는 이 값을
   * 마운트 시점에 한 번만 만들어(참조를 고정해) 넘긴다 — 렌더마다 새 프라미스를 넘기면 타이머가
   * 다시 시작된다. 생략하면 3초 자체가 유일한 대기 조건이다. */
  waitFor?: Promise<unknown>;
  /** waitFor가 reject되면 호출된다. 넘기지 않으면 실패는 그냥 삼켜지고 onComplete도 불리지
   * 않는다 — waitFor를 쓰는 호출처는 항상 이 콜백으로 기존 오류 UI를 보여준다. */
  onError?: (error: unknown) => void;
}

/**
 * UX-012 전역 화면 전환. 마일스톤(커리어 생성·계약 체결·시즌 시작 등) 사이를 3초 고정 진행 바
 * 연출로 잇는다. 셸의 헤더를 침범하지 않고 `.os-shell-main` 안의 라우트 콘텐츠를 통째로
 * 대체하는 용도로 쓴다(호출처가 이 컴포넌트 하나만 return한다).
 *
 * 한 번 마운트되면 완료까지 한 방향으로만 진행한다(스킵 불가) — `title`·`stages`·`waitFor`는
 * 마운트 시점 값으로 고정되고 이후 값이 바뀌어도 진행 중인 타이머에 반영되지 않는다.
 */
export function ScreenTransition({
  title,
  detail,
  onComplete,
  reducedMotion,
  visual,
  children,
  stages,
  waitFor,
  onError,
}: ScreenTransitionProps) {
  // 마운트 시점 값으로 고정한다 — 렌더마다 재생성되는 인라인 배열/프라미스가 타이머를 리셋하지
  // 않게 한다.
  const [frozenStages] = useState(stages);
  const [frozenWaitFor] = useState(waitFor);
  const [frozenReducedMotion] = useState(reducedMotion);

  const [fillPercent, setFillPercent] = useState(0);
  const [ariaPercent, setAriaPercent] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  // `.os-screen-transition`은 `.os-shell-main`(확정 높이를 가진 셸 본문) 안에서 그 세로 공간을
  // 통째로 대체하는 용도로 쓰인다(컴포넌트 계약). CSS `min-height: 100%`는 실제 조상 체인의
  // 중간 래퍼(os-route-motion·os-swipe-surface·os-swipe-content)가 모두 display:block auto
  // 높이라 퍼센트가 0으로 접혀 효과가 없다 — 그렇다고 그 래퍼들에 height:100%를 주면 모든 라우트
  // 레이아웃에 영향을 준다. 대신 이 컴포넌트가 스스로 `.os-shell-main`을 찾아 그 clientHeight에서
  // 상하 padding을 뺀 값(콘텐츠 박스 높이)을 인라인 min-height로 잡는다 — border-box이므로 이
  // 값이 곧 `.os-screen-transition`이 셸 본문의 콘텐츠 영역을 정확히 채우는 높이다.
  // `.os-shell-main` 조상이 없으면(스토리·테스트 등 비셸 맥락) CSS의 100% 폴백을 그대로 둔다.
  useLayoutEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    function syncHeight() {
      const shellMain = node?.closest('.os-shell-main');
      if (!(shellMain instanceof HTMLElement) || !node) return;
      const computed = window.getComputedStyle(shellMain);
      const paddingTop = Number.parseFloat(computed.paddingTop) || 0;
      const paddingBottom = Number.parseFloat(computed.paddingBottom) || 0;
      const contentHeight = shellMain.clientHeight - paddingTop - paddingBottom;
      if (contentHeight > 0) {
        node.style.minHeight = `${contentHeight}px`;
      }
    }

    const shellMain = node.closest('.os-shell-main');
    if (!(shellMain instanceof HTMLElement)) {
      // 셸 밖(스토리·단위 테스트)에서는 CSS min-height: 100% 폴백에 맡긴다.
      return;
    }

    syncHeight();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(syncHeight);
    observer.observe(shellMain);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let done = false;
    let progressIntervalId: number | null = null;
    const timers: number[] = [];
    const settle = frozenWaitFor ?? Promise.resolve();

    function stopProgressInterval() {
      if (progressIntervalId !== null) {
        window.clearInterval(progressIntervalId);
        progressIntervalId = null;
      }
    }

    function finish() {
      if (done || cancelled) return;
      done = true;
      stopProgressInterval();
      onCompleteRef.current();
    }

    function fail(error: unknown) {
      if (done || cancelled) return;
      done = true;
      stopProgressInterval();
      onErrorRef.current?.(error);
    }

    if (frozenReducedMotion) {
      // 애니메이션 없이 즉시 완료: 진행 바 연출은 생략하되, 실제 작업 결과는 그대로 기다린다.
      setFillPercent(100);
      setAriaPercent(100);
      settle.then(
        () => {
          if (!cancelled) finish();
        },
        (error: unknown) => {
          if (!cancelled) fail(error);
        },
      );
      return () => {
        cancelled = true;
      };
    }

    let timeUp = false;
    let waitDone = false;
    let failed = false;

    function checkBothDone() {
      if (timeUp && waitDone && !failed) {
        setFillPercent(100);
        setAriaPercent(100);
        finish();
      }
    }

    const stageCount = frozenStages?.length ?? 0;
    if (stageCount > 1) {
      const stageMs = SCREEN_TRANSITION_MS / stageCount;
      for (let index = 1; index < stageCount; index += 1) {
        const timer = window.setTimeout(() => setStageIndex(index), Math.round(stageMs * index));
        timers.push(timer);
      }
    }

    // 0 → 96%를 3초에 걸쳐 거의 선형에 가깝게 채운다(easeProgress) — 실제 완료(waitFor)는
    // 별도로 기다렸다가 100%로 마무리한다. rAF 대신 고정 간격 인터벌을 쓴다: 가짜 타이머
    // 테스트에서도 결정론적으로 동작하고, 80ms면 체감상 충분히 매끄럽다.
    const startedAt = Date.now();
    progressIntervalId = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const fraction = elapsed / SCREEN_TRANSITION_MS;
      const nextPercent = Math.round(PENDING_CEILING_PERCENT * easeProgress(fraction));
      setFillPercent(nextPercent);
      setAriaPercent(nextPercent);
      if (fraction >= 1) {
        stopProgressInterval();
      }
    }, PROGRESS_TICK_MS);

    const timeUpTimer = window.setTimeout(() => {
      timeUp = true;
      checkBothDone();
    }, SCREEN_TRANSITION_MS);
    timers.push(timeUpTimer);

    settle.then(
      () => {
        if (cancelled) return;
        waitDone = true;
        checkBothDone();
      },
      (error: unknown) => {
        if (cancelled) return;
        failed = true;
        fail(error);
      },
    );

    return () => {
      cancelled = true;
      stopProgressInterval();
      timers.forEach((timer) => window.clearTimeout(timer));
    };
    // frozenReducedMotion·frozenStages·frozenWaitFor는 정의상(useState 초깃값) 이 컴포넌트의
    // 수명 동안 절대 바뀌지 않는다 — 마운트 시 한 번만 실행되도록 의존성 배열을 비워 둔다.
  }, []);

  const stageText =
    frozenStages !== undefined && frozenStages.length > 0
      ? frozenStages[Math.min(stageIndex, frozenStages.length - 1)]
      : undefined;

  return (
    <div
      ref={containerRef}
      className="os-screen-transition"
      role="status"
      aria-live="polite"
      tabIndex={-1}
    >
      <span className="os-screen-transition-glow os-screen-transition-glow-a" aria-hidden="true" />
      <span className="os-screen-transition-glow os-screen-transition-glow-b" aria-hidden="true" />
      <div className="os-screen-transition-visual" aria-hidden="true">
        {visual ?? (
          <div className="os-screen-transition-mark">
            <span className="os-screen-transition-line" />
            <FootballMark className="os-screen-transition-ball h-10 w-10 text-os-on-hero" />
          </div>
        )}
      </div>
      <div className="os-screen-transition-copy">
        <strong className="font-os text-os-on-hero">{title}</strong>
        <span className="font-os os-screen-transition-detail">{detail}</span>
      </div>
      {children}
      <div className="os-screen-transition-progress">
        <div
          className="os-screen-transition-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={ariaPercent}
          aria-label={title}
        >
          <div className="os-screen-transition-fill" style={{ width: `${fillPercent}%` }}>
            <span className="os-screen-transition-sweep" />
          </div>
        </div>
        {stageText !== undefined ? (
          <p className="font-os os-screen-transition-stage">{stageText}</p>
        ) : null}
      </div>
    </div>
  );
}
