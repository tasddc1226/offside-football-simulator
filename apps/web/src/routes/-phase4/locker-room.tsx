import type { EventDecisionContext } from '../../shared/event-screen.js';
import { relationshipReasonLabel, relationTierLabel, relationshipDirectionArrow } from '../../shared/labels.js';
import type { RelationTarget } from '@offside/domain';

const RELATIONS: readonly { target: RelationTarget; label: string }[] = [
  { target: 'managerTrust', label: '감독 신뢰' },
  { target: 'captain', label: '주장' },
  { target: 'rival', label: '라이벌' },
  { target: 'fans', label: '팬' },
  { target: 'agent', label: '에이전트' },
];

export function LockerRoomContext({ state }: EventDecisionContext) {
  return (
    <section className="os-panel flex flex-col gap-os-4" aria-label="라커룸 관계 맥락">
      <div>
        <h2 className="os-section-title">라커룸의 온도</h2>
        <p className="os-muted">최근 관계 기록의 방향과 현재 단계만 표시합니다.</p>
      </div>
      <div className="grid grid-cols-1 gap-os-2 sm:grid-cols-2" aria-label="관계 5축">
        {RELATIONS.map(({ target, label }) => (
          <div key={target} className="rounded-os-m bg-os-surface-2 p-os-3">
            <div className="flex items-center justify-between gap-os-2"><span>{label}</span><span aria-label={`${label} 방향`}>{relationshipDirectionArrow(state.relationshipLog, target)}</span></div>
            <p className="os-muted">{relationTierLabel(state.relationships[target])}</p>
            <p className="mt-os-1 text-os-text-2">기억: {state.memoryTags[target].length > 0 ? state.memoryTags[target].map((tag) => relationshipReasonLabel(tag)).join(' · ') : '기록 없음'}</p>
          </div>
        ))}
      </div>
      <div>
        <h3 className="font-semibold">최근 변화</h3>
        {state.relationshipLog.length > 0 ? (
          <ul className="mt-os-2 flex flex-col gap-os-1 text-os-text-2">
            {state.relationshipLog.slice(-3).reverse().map((entry, index) => <li key={`${entry.sourceId}-${entry.step}-${index}`}>{RELATIONS.find((relation) => relation.target === entry.target)?.label} {entry.delta > 0 ? '상승' : entry.delta < 0 ? '하락' : '변화 없음'} · {relationshipReasonLabel(entry.reasonTag)}</li>)}
          </ul>
        ) : <p className="os-muted mt-os-2">최근 관계 변화 기록이 없습니다.</p>}
      </div>
    </section>
  );
}
