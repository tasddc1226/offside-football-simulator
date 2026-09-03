// 13-visual-design-system.md DSN-MOT-001: 카운트업 800ms 이내·ease-out·건너뛰기 버튼 필수.
// 04 공정성 규칙 "결과가 0이면 0과 미확정 애니메이션 값을 구분한다": `value === null`(미집계)은
// "—"를, `value === 0`은 애니메이션 없이 "0"을 보여준다. 확정값은 `data-value`·접근성 이름에 먼저
// 쓰고 표시 텍스트만 카운트업한다(애니메이션 중에도 스크린 리더는 최종값을 읽는다).
import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from './ui-store.js';

const CAPTION_STYLE = { fontSize: 'var(--os-fs-caption)', lineHeight: 'var(--os-lh-caption)' } as const;
const DEFAULT_DURATION_MS = 800;

function defaultFormat(value: number): string {
  return String(Math.round(value));
}

export type CountUpProps = {
  /** 확정값. null이면 미집계("—"). */
  value: number | null;
  /** 접근성 이름(예: "평균 평점"). */
  label: string;
  /** 표시 포맷터(기본 정수 문자열). */
  format?: (value: number) => string;
  durationMs?: number;
  /** "건너뛰기" 클릭 시 분석 이벤트 등을 연결하는 훅. */
  onSkip?: () => void;
};

export function CountUp({ value, label, format = defaultFormat, durationMs = DEFAULT_DURATION_MS, onSkip }: CountUpProps) {
  const reducedMotion = useReducedMotion();
  const skipAnimation = reducedMotion || value === null || value === 0;
  const [display, setDisplay] = useState<number>(skipAnimation ? (value ?? 0) : 0);
  const [animating, setAnimating] = useState(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (value === null) {
      setDisplay(0);
      setAnimating(false);
      return;
    }
    if (reducedMotion || value === 0) {
      setDisplay(value);
      setAnimating(false);
      return;
    }

    setDisplay(0);
    setAnimating(true);
    const startedAt = performance.now();
    const target = value;

    function tick(now: number) {
      const elapsed = now - startedAt;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - progress, 2);
      setDisplay(target * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(target);
        setAnimating(false);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, reducedMotion, durationMs]);

  function skip() {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    if (value !== null) setDisplay(value);
    setAnimating(false);
    onSkip?.();
  }

  if (value === null) {
    return (
      <span className="os-num font-os" data-animating="false" aria-label={`${label} 미집계`}>
        —
      </span>
    );
  }

  return (
    <span className="inline-flex items-baseline gap-os-2">
      <span className="os-num font-os" data-value={value} data-animating={animating ? 'true' : 'false'} aria-label={`${label} ${format(value)}`}>
        {format(display)}
      </span>
      {animating ? (
        <button type="button" className="font-os text-os-text-2 underline" style={CAPTION_STYLE} onClick={skip}>
          건너뛰기
        </button>
      ) : null}
    </span>
  );
}
