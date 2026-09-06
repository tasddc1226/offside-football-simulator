// UX-009: SCR-034 온보딩 진입 전 시네마틱 인트로. 서사 2줄을 타자기 효과로 순차 표시한 뒤 자동으로
// 다음(기존 3슬라이드)으로 넘어간다. 화면 아무 곳이나 탭·클릭하거나 포커스 상태에서 Enter/Space를
// 누르면(네이티브 버튼 기본 동작) 즉시 스킵한다.
//
// 총 재생 시간은 일부러 짧게 잡았다(스케줄 계산 결과 약 1.2초) — staging-smoke.spec.ts가 실제 배포된
// Worker에서 "다음" 버튼 노출을 기본 5000ms 타임아웃으로 기다리는데, 실측 기준 도메인 접속부터
// 헤딩이 뜨기까지 이미 약 2.6~2.8초가 쓰인다(네트워크 + 번들 파싱 + service-season 응답 대기). 여기에
// 타자기 재생 시간을 더해도 5초 예산을 넘기지 않도록 CHARS_PER_SECOND·LINE_GAP_MS·HOLD_AFTER_MS를
// 골랐다(PR 본문에 실측값 기록).
import { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from './ui-store.js';
import './cinematic-intro.css';

/** 기존 브랜드 카피(BRAND_SUBTITLE)·대표 문장과 연결되는 세계관 서사 2줄. 폐쇄 어휘 목록(12-브랜드
 * 가이드) 밖의 새 대문자 브랜드 용어는 만들지 않는다. */
const CINEMATIC_LINES = [
  '관중석 조명이 켜진다. 휘슬은 아직 울리지 않았다.',
  '한 발 앞서거나, 모든 것을 놓치거나 — 이번 생은 프리미어리거!',
] as const;

const CHARS_PER_SECOND = 90;
const LINE_GAP_MS = 140;
const HOLD_AFTER_MS = 320;

type LineSchedule = { text: string; startMs: number; durationMs: number };

function buildSchedule(lines: readonly string[]): LineSchedule[] {
  let cursor = 0;
  return lines.map((text) => {
    const durationMs = Math.max(1, (text.length / CHARS_PER_SECOND) * 1000);
    const startMs = cursor;
    cursor += durationMs + LINE_GAP_MS;
    return { text, startMs, durationMs };
  });
}

const SCHEDULE = buildSchedule(CINEMATIC_LINES);
const LAST_LINE = SCHEDULE[SCHEDULE.length - 1]!;
const TOTAL_MS = LAST_LINE.startMs + LAST_LINE.durationMs + HOLD_AFTER_MS;

function fullCounts(): number[] {
  return CINEMATIC_LINES.map((line) => line.length);
}

export function CinematicIntro({ onComplete }: { onComplete: () => void }) {
  const reducedMotion = useReducedMotion();
  const [visibleCounts, setVisibleCounts] = useState<number[]>(() =>
    reducedMotion ? fullCounts() : CINEMATIC_LINES.map(() => 0),
  );
  const doneRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const complete = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    onCompleteRef.current();
  }, []);

  useEffect(() => {
    // 모션 감소(OS 또는 앱 설정)면 타자기 없이 전체 문장을 정적으로 두고, 같은 틱에 바로 다음
    // 슬라이드로 넘어간다(GameCompletionTransition과 같은 관례 — durationMs 0).
    if (reducedMotion) {
      setVisibleCounts(fullCounts());
      const timer = window.setTimeout(complete, 0);
      return () => window.clearTimeout(timer);
    }

    setVisibleCounts(CINEMATIC_LINES.map(() => 0));
    const startedAt = performance.now();

    function tick(now: number) {
      const elapsed = now - startedAt;
      setVisibleCounts(
        SCHEDULE.map(({ text, startMs, durationMs }) => {
          if (elapsed <= startMs) return 0;
          const progress = Math.min(1, (elapsed - startMs) / durationMs);
          return Math.ceil(text.length * progress);
        }),
      );
      if (elapsed >= TOTAL_MS) {
        complete();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [reducedMotion, complete]);

  return (
    <button type="button" className="os-cinema-intro" onClick={complete}>
      <span className="os-cinema-glow os-cinema-glow-a" aria-hidden="true" />
      <span className="os-cinema-glow os-cinema-glow-b" aria-hidden="true" />
      <svg
        className="os-cinema-pitch"
        viewBox="0 0 360 200"
        preserveAspectRatio="xMidYMax slice"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M0 36 H360" />
        <path d="M64 200 V132 H296 V200" />
        <circle cx="180" cy="104" r="48" />
        <circle cx="180" cy="104" r="2" fill="currentColor" stroke="none" />
      </svg>
      <div className="os-cinema-copy" aria-hidden="true">
        {CINEMATIC_LINES.map((line, index) => {
          const shown = line.slice(0, visibleCounts[index] ?? 0);
          const typingNow = !reducedMotion && shown.length > 0 && shown.length < line.length;
          return (
            <p key={line} className="os-cinema-line" data-typing={typingNow ? 'true' : undefined}>
              {shown}
            </p>
          );
        })}
      </div>
      <span className="os-cinema-hint">탭하여 스킵</span>
    </button>
  );
}
