import type { EventDecisionContext } from '../../shared/event-screen.js';
import { managerTrustTierLabel, popularityTierLabel } from '../../shared/labels.js';

export function MediaContext({ state }: EventDecisionContext) {
  return (
    <section className="os-panel flex flex-col gap-os-4" aria-label="SNS와 평판 맥락">
      <h2 className="os-section-title">그라운드 밖의 목소리</h2>
      <dl className="grid grid-cols-2 gap-os-3">
        <div><dt>공개 범위</dt><dd>이 게임 안의 반응이며 외부에 게시되지 않습니다.</dd></div>
        <div><dt>인기 단계</dt><dd>{popularityTierLabel(state.reputation.popularityCenti)}</dd></div>
        <div><dt>감독 신뢰</dt><dd>{managerTrustTierLabel(state.relationships.managerTrust)}</dd></div>
        <div><dt>사실 여부</dt><dd>상황 설명을 확인하고 신중하게 말하세요.</dd></div>
      </dl>
    </section>
  );
}
