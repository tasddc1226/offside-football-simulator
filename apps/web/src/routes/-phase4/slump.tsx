import type { EventDecisionContext } from '../../shared/event-screen.js';
import { managerTrustTierLabel } from '../../shared/labels.js';

export function SlumpContext({ state }: EventDecisionContext) {
  const matches = state.season?.matches.slice(-5) ?? [];
  const manager = state.season?.manager ?? state.nextManager;
  return (
    <section className="os-panel flex flex-col gap-os-4" aria-label="슬럼프 맥락">
      <div>
        <h2 className="os-section-title">최근 리듬</h2>
        <p className="os-muted">최근 기록된 최대 5경기입니다. 출전 시간이 짧거나 결장한 경기에는 평점이 없을 수 있습니다.</p>
      </div>
      {matches.length > 0 ? (
        <div className="flex flex-col gap-os-2" aria-label="최근 경기 기록">
          {matches.map((match) => (
            <div key={match.id} className="flex items-center justify-between rounded-os-m bg-os-surface-2 px-os-3 py-os-2">
              <span>스텝 {match.step} · {match.appearance === 'OUT' ? '결장' : `${match.minutes}분`}</span>
              <span className="os-num">{match.ratingTenths === null ? '평점 없음' : `${(match.ratingTenths / 10).toFixed(1)}점`}</span>
            </div>
          ))}
        </div>
      ) : <p className="os-muted">현재 시즌 경기 기록이 없습니다.</p>}

      <dl className="grid grid-cols-2 gap-os-3">
        <div><dt>감독</dt><dd>{manager?.name ?? '현재 시즌 감독 정보 없음'}</dd></div>
        <div><dt>감독 신뢰</dt><dd>{managerTrustTierLabel(state.relationships.managerTrust)}</dd></div>
      </dl>
      <p className="os-muted">최근 경기 기록과 감독 신뢰를 바탕으로 다음 선택의 맥락을 확인하세요.</p>
    </section>
  );
}
