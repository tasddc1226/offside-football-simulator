import type { EventDecisionContext } from '../../shared/event-screen.js';
import { CUP_ROUND_LABEL_KO, INJURY_BODY_PART_LABELS, INJURY_SEVERITY_LABELS } from '../../shared/labels.js';

export function InjuryContext({ state }: EventDecisionContext) {
  const pending = state.pending;
  const episode = pending?.kind === 'INJURY'
    ? state.health.episodes.find((candidate) => candidate.id === pending.episodeId)
    : undefined;
  if (!episode) return null;
  const upcomingCups = (state.season?.schedule ?? [])
    .filter((entry) => !entry.skipped && entry.step > state.currentStep)
    .slice(0, episode.diagnosisRange.maxMatches)
    .filter((entry) => entry.kind === 'CUP');
  return (
    <section className="os-panel flex flex-col gap-os-3" aria-label="부상 진단과 복귀 계획">
      <h2 className="os-section-title">진단과 복귀 계획</h2>
      <dl className="grid grid-cols-2 gap-os-3">
        <div><dt>부상 부위</dt><dd>{INJURY_BODY_PART_LABELS[episode.bodyPart]}</dd></div>
        <div><dt>심각도</dt><dd>{INJURY_SEVERITY_LABELS[episode.severity]}</dd></div>
        <div><dt>예상 복귀</dt><dd>{episode.diagnosisRange.minMatches}~{episode.diagnosisRange.maxMatches}경기</dd></div>
        <div><dt>재발 위험</dt><dd>{(episode.recurrenceRiskBp / 100).toFixed(1)}%</dd></div>
        <div><dt>현재 체력</dt><dd>{state.state.fitness}</dd></div>
      </dl>
      <p className="os-muted">복귀 시점은 재활 선택에 따라 달라집니다. 빠른 복귀는 출전 기회를 늘리지만 재발 위험도 높입니다.</p>
      {upcomingCups.length > 0 ? <div><h3 className="font-semibold">복귀 예상 기간의 주요 일정</h3><ul>
        {upcomingCups.map((entry) => <li key={`${entry.step}-${entry.order}`}>
          {entry.step}단계 · 컵 {CUP_ROUND_LABEL_KO[entry.round as keyof typeof CUP_ROUND_LABEL_KO] ?? entry.round ?? '경기'}
        </li>)}
      </ul><p className="os-muted">이후 컵 진출 여부에 따라 일정이 달라질 수 있습니다.</p></div> : null}
      <p className="os-muted">선택지의 bp는 위험 변화 단위입니다. 100bp는 1%p입니다.</p>
    </section>
  );
}
