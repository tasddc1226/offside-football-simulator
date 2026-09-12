import { rulesetForCareer } from '../../engine/content.js';
import type { EventDecisionContext } from '../../shared/event-screen.js';
import { CUP_ROUND_LABEL_KO, INJURY_BODY_PART_LABELS, INJURY_SEVERITY_LABELS } from '../../shared/labels.js';
import { injuryRecurrenceNotice } from '../../shared/play-guidance.js';

export function InjuryContext({ state }: EventDecisionContext) {
  const pending = state.pending;
  const episode = pending?.kind === 'INJURY'
    ? state.health.episodes.find((candidate) => candidate.id === pending.episodeId)
    : undefined;
  if (!episode) return null;
  // 이슈 164: 이전 부상의 재발이면 배지와 누적 재발 정보를 보여준다(저장된 에피소드 이력만 읽는다).
  const recurrence = injuryRecurrenceNotice(state.health.episodes, episode.id);
  const recurrenceWindowMatches = rulesetForCareer(state).injuryRules.recurrenceWindowMatches;
  const upcomingCups = (state.season?.schedule ?? [])
    .filter((entry) => !entry.skipped && entry.step > state.currentStep)
    .slice(0, episode.diagnosisRange.maxMatches)
    .filter((entry) => entry.kind === 'CUP');
  return (
    <section className="os-panel flex flex-col gap-os-3" aria-label="부상 진단과 복귀 계획">
      <h2 className="os-section-title">진단과 복귀 계획</h2>
      {recurrence !== null ? (
        <div className="flex flex-col gap-os-1 rounded-os-m bg-os-surface-2 p-os-3" data-testid="injury-recurrence">
          <p className="os-eyebrow flex items-center gap-os-1">
            <span aria-hidden="true" className="text-os-warning">▲</span>
            이전 {INJURY_BODY_PART_LABELS[recurrence.bodyPart]} 부상 재발
          </p>
          <p className="os-muted">
            같은 부위 재발 {recurrence.chainLength}회째 · 심각도 {INJURY_SEVERITY_LABELS[recurrence.priorSeverity]} → {INJURY_SEVERITY_LABELS[recurrence.severity]} · 누적 재발 위험 {(recurrence.recurrenceRiskBp / 100).toFixed(1)}%
            {' · '}회복 뒤 {recurrenceWindowMatches}경기 동안 재발 판정을 다시 받습니다.
          </p>
        </div>
      ) : null}
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
