import type { LegacyResult } from '@offside/domain';
import { legacyBandPresentation, legacyEndingPresentation } from '@offside/domain';
import { buttonClassName, buttonStyle } from '@offside/ui';

export type LegacyScoreCardProps = {
  result: LegacyResult;
  onSourceClick?: (sourceId: string) => void;
};

const COMPONENT_LABELS: Record<keyof LegacyResult['componentScores'], string> = {
  achievement: '성취',
  contribution: '기여',
  longevity: '장기성',
  relationship: '관계',
  narrative: '서사',
};

function reasonLabel(_reasonTag: string, component: keyof LegacyResult['componentScores']): string {
  return {
    achievement: '우승·개인 시즌 평가·결정적 경기',
    contribution: '포지션에 맞는 기록과 출전·약속 이행',
    longevity: '꾸준히 쌓은 시즌과 출전 경험',
    relationship: '시즌마다 함께 쌓아 온 신뢰',
    narrative: '당신만의 커리어 태그',
  }[component];
}

function SourceAction({
  sourceId,
  label,
  onSourceClick,
}: {
  sourceId: string;
  label: string;
  onSourceClick: ((sourceId: string) => void) | undefined;
}) {
  if (onSourceClick === undefined) return <span>{label}</span>;
  return (
    <button
      type="button"
      className={buttonClassName('secondary', 'min-h-11 w-full justify-start text-left')}
      style={buttonStyle}
      onClick={() => onSourceClick(sourceId)}
    >
      {label}
    </button>
  );
}

export function LegacyScoreCard({ result, onSourceClick }: LegacyScoreCardProps) {
  const ending = legacyEndingPresentation(result.endingId);
  const band = legacyBandPresentation(result.bandId);
  const factors = result.topFactors.slice(0, 3);
  const missed = result.missedOpportunity;
  const bestMomentSource = result.bestMomentRef;

  return (
    <article className="os-panel flex flex-col gap-os-4" aria-labelledby="legacy-score-card-title">
      <header className="flex flex-col gap-os-2">
        <p className="text-os-caption text-os-text-2">LEGACY SCORE</p>
        <h2 id="legacy-score-card-title" className="text-os-heading font-semibold">
          {ending.title}
        </h2>
        <p className="text-os-text-2">{ending.sentence}</p>
        <div
          className="flex flex-wrap items-baseline gap-x-os-3 gap-y-os-1"
          aria-label="Legacy 점수와 밴드"
        >
          <strong className="text-os-display" aria-label={`총점 ${result.totalScore}점`}>
            {result.totalScore}
          </strong>
          <span className="text-os-text-2">/ 100</span>
          <span className="rounded-full bg-os-surface-2 px-os-2 py-os-1 font-medium">
            {band.label}
          </span>
        </div>
      </header>

      <section aria-labelledby="legacy-top-factors-title" className="flex flex-col gap-os-2">
        <h3 id="legacy-top-factors-title" className="font-semibold">
          상위 기여 요인
        </h3>
        <ol className="flex flex-col gap-os-2">
          {factors.map((factor) => {
            const sourceId = factor.sourceIds[0];
            return (
              <li key={factor.component} className="flex flex-col gap-os-1">
                <span>
                  {reasonLabel(factor.reasonTag, factor.component)} · {factor.value}점
                </span>
                {sourceId !== undefined ? (
                  <SourceAction
                    sourceId={sourceId}
                    label="근거 보기"
                    onSourceClick={onSourceClick}
                  />
                ) : null}
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="legacy-missed-title" className="flex flex-col gap-os-1">
        <h3 id="legacy-missed-title" className="font-semibold">
          아쉬운 기회
        </h3>
        <p>
          {missed.reasonTag === 'UNCHOSEN_COACH_EPILOGUE'
            ? '선택하지 않은 경로: 지도자로 이어지는 에필로그'
            : missed.reasonTag === 'UNCHOSEN_PLAYER_ONLY_EPILOGUE'
              ? '선택하지 않은 경로: 선수의 기록만으로 마무리하는 에필로그'
              : `다시 도전한다면: ${reasonLabel(missed.reasonTag, missed.component)}`}
        </p>
      </section>

      <section aria-labelledby="legacy-best-title" className="flex flex-col gap-os-1">
        <h3 id="legacy-best-title" className="font-semibold">
          최고의 순간
        </h3>
        <SourceAction
          sourceId={bestMomentSource}
          label="커리어를 대표하는 기록 보기"
          onSourceClick={onSourceClick}
        />
      </section>

      <details>
        <summary className="cursor-pointer font-medium">5축 점수 자세히 보기</summary>
        <p className="text-os-caption text-os-text-2">자동 시뮬레이션 참조집단 기준</p>
        <p className="text-os-caption text-os-text-2">실제 이용자 순위가 아닙니다.</p>
        {result.percentileHidden === false && result.percentile !== undefined ? (
          <p className="text-os-caption text-os-text-2">
            참조집단의 {result.percentile}%보다 앞섰다
          </p>
        ) : null}
        <dl className="mt-os-2 grid grid-cols-2 gap-os-2 text-os-text-2">
          {(Object.keys(COMPONENT_LABELS) as Array<keyof LegacyResult['componentScores']>).map(
            (component) => (
              <div key={component} className="flex justify-between gap-os-2">
                <dt>{COMPONENT_LABELS[component]}</dt>
                <dd>{result.componentScores[component]}점</dd>
              </div>
            ),
          )}
        </dl>
      </details>
    </article>
  );
}
