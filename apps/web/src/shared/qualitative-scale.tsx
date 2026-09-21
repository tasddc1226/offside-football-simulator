import type { ReactNode } from 'react';

/** Shared 0–100 display scale for values that are scores, not probabilities. */
export const QUALITATIVE_SCALE_BOUNDARIES = [20, 40, 60, 80] as const;
const SCORE_LABELS = ['매우 낮음', '낮음', '보통', '높음', '매우 높음'] as const;

export type QualitativeScore = {
  value: number;
  label: string;
  meaning: string;
};

function scoreIndex(value: number): number {
  return QUALITATIVE_SCALE_BOUNDARIES.filter((boundary) => value >= boundary).length;
}

/** The meaning deliberately describes the displayed scale; it is not a chance or forecast. */
export function qualitativeScore(value: number): QualitativeScore {
  const normalized = Math.max(0, Math.min(100, Math.round(value)));
  const label = SCORE_LABELS[scoreIndex(normalized)] ?? SCORE_LABELS[0];
  return {
    value: normalized,
    label,
    meaning: `0에서 100까지의 현재 점수 중 ${label} 구간`,
  };
}

export function managerTrustScore(value: number): QualitativeScore {
  return qualitativeScore(value);
}

export function tacticalFitScore(value: number): QualitativeScore {
  return qualitativeScore(value);
}

export function ScoreScale({
  label,
  score,
  children,
}: {
  label: string;
  score: QualitativeScore;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-os-1" aria-label={`${label} ${score.meaning}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-os-1 font-os">
        <span className="text-os-text-2">{label}</span>
        <span className="os-num font-semibold text-os-text">
          {score.value} · {score.label}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`${label} 점수`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={score.value}
        aria-valuetext={`${score.value}점, ${score.label}. ${score.meaning}`}
        className="h-2 w-full overflow-hidden rounded-full bg-os-surface-2"
      >
        <span
          className="block h-full rounded-full bg-os-accent"
          style={{ width: `${score.value}%` }}
          aria-hidden="true"
        />
      </div>
      {children ?? (
        <span className="font-os text-os-text-2" style={{ fontSize: 'var(--os-fs-caption)' }}>
          {score.meaning}
        </span>
      )}
    </div>
  );
}
