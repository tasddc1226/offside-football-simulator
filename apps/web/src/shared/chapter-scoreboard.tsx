// SCR-031 D-30: 판단마다 시간·스코어·체력·지시를 보여주는 스코어보드. 스코어는 표시 전용 규칙으로
// 판단 시점까지의 득점만 센다(상태 저장 없음 — 같은 입력이면 새로고침해도 같은 값). 진입 600ms
// 이내 등장하고 DSN-LINE-001 라인을 320ms 1회 쓴다(챕터 진입은 D-30이 허용한 순간 — 13-visual-
// design-system.md의 "세 순간" 목록과의 충돌은 PR 본문에 기록한다).
import { useEffect, useState } from 'react';
import { OffsideLine } from '@offside/ui';

const DECISION_TIME_LABELS = ['전반', '후반', '종료 직전'] as const;

/** 판단 순서 라벨(1-based). 정의는 판단 1~3개뿐이라 목록 밖으로 나가지 않는다(방어적 fallback만 둔다). */
export function decisionTimeLabel(decisionIndex: number): string {
  return DECISION_TIME_LABELS[decisionIndex - 1] ?? `판단 ${decisionIndex}`;
}

/** 판단 k(1-based)의 표시용 분: k × 90 / (decisionsTotal + 1), 내림. */
export function decisionMinute(decisionIndex: number, decisionsTotal: number): number {
  return Math.floor((decisionIndex * 90) / (decisionsTotal + 1));
}

function goalMinute(goalIndex: number, totalGoals: number): number {
  return Math.floor((90 * goalIndex) / (totalGoals + 1));
}

export type ScoreboardScore = { for: number; against: number };

/** 표시 전용 규칙(D-30): minute까지 일어난 것으로 볼 수 있는 득점만 센다. 입력만으로 결정되는
 * 순수 함수라 새로고침해도 같은 값이다(단위 테스트). */
export function scoreAtDecision(goalsFor: number, goalsAgainst: number, minute: number): ScoreboardScore {
  const countGoals = (total: number): number => {
    let count = 0;
    for (let i = 1; i <= total; i++) {
      if (goalMinute(i, total) <= minute) count += 1;
    }
    return count;
  };
  return { for: countGoals(goalsFor), against: countGoals(goalsAgainst) };
}

export interface ChapterScoreboardProps {
  timeLabel: string;
  score: ScoreboardScore;
  fitness: number;
  tacticalInstruction: string;
}

const BODY_STYLE = { fontSize: 'var(--os-fs-body)', lineHeight: 'var(--os-lh-body)' } as const;
const CAPTION_STYLE = { fontSize: 'var(--os-fs-caption)', lineHeight: 'var(--os-lh-caption)' } as const;
const NUM_STYLE = { fontSize: 'var(--os-fs-h1)', lineHeight: 'var(--os-lh-h1)' } as const;

export function ChapterScoreboard({ timeLabel, score, fitness, tacticalInstruction }: ChapterScoreboardProps) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      className="flex flex-col gap-os-2 rounded-os-m border border-os-border bg-os-surface p-os-4 transition-opacity duration-500 ease-out"
      style={{ opacity: entered ? 1 : 0 }}
    >
      <OffsideLine />
      <div className="flex items-center justify-between gap-os-3">
        <span className="font-os font-semibold text-os-text" style={BODY_STYLE} data-testid="chapter-time-label">
          {timeLabel}
        </span>
        <span
          className="os-num font-os font-bold text-os-text"
          style={NUM_STYLE}
          aria-label={`스코어 ${score.for} 대 ${score.against}`}
          data-testid="chapter-score"
        >
          {score.for}:{score.against}
        </span>
      </div>
      <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
        체력 {fitness} · {tacticalInstruction}
      </p>
    </div>
  );
}
