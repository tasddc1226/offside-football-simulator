import type { EventDecisionContext } from '../../shared/event-screen.js';
import { relationTierLabel } from '../../shared/labels.js';

export function EthicsContext({ state, definition }: EventDecisionContext) {
  const hasFailure = definition.choices.some((choice) => choice.outcomes.some((outcome) => outcome.kind === 'FAIL'));
  return (
    <section className="os-panel flex flex-col gap-os-4" aria-label="윤리와 위기 맥락">
      <h2 className="os-section-title">확인하고 선택하기</h2>
      <div className="rounded-os-m bg-os-surface-2 p-os-3">
        <h3 className="font-semibold">확인된 상황</h3>
        <p className="mt-os-2">알려진 상황과 아직 확인되지 않은 이야기를 구분해 판단하세요.</p>
      </div>
      <div className="rounded-os-m bg-os-surface-2 p-os-3">
        <h3 className="font-semibold">지원 가능한 관계</h3>
        <dl className="mt-os-2 grid grid-cols-2 gap-os-3">
          <div><dt>에이전트 관계</dt><dd>{relationTierLabel(state.relationships.agent)}</dd></div>
          <div><dt>주장 관계</dt><dd>{relationTierLabel(state.relationships.captain)}</dd></div>
        </dl>
      </div>
      <div>
        <h3 className="font-semibold">확인할 위험</h3>
        <p className="mt-os-2 text-os-text-2">{hasFailure ? '뜻대로 풀리지 않을 수도 있습니다. 위험과 관계에 미칠 영향을 함께 살펴보세요.' : '각 선택이 남길 관계의 변화를 확인하세요.'}</p>
      </div>
    </section>
  );
}
