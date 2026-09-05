import type { EventDecisionContext } from '../../shared/event-screen.js';

export function NationalTeamContext({ state }: EventDecisionContext) {
  return (
    <section className="os-panel flex flex-col gap-os-3" aria-label="대표팀 참가 안내">
      <h2 className="os-section-title">클럽과 대표팀 사이에서</h2>
      <dl className="grid grid-cols-2 gap-os-3">
        <div><dt>대회</dt><dd>국제 일정</dd></div>
        <div><dt>예상 출전</dt><dd>선발 경쟁 결과에 따름</dd></div>
        <div><dt>현재 체력</dt><dd>{state.state.fitness}</dd></div>
        <div><dt>대표팀 경험</dt><dd>{state.nationalTeam.debuted ? '데뷔 경험 있음' : '첫 데뷔를 앞두고 있음'}</dd></div>
      </dl>
      <p>참가·조건부 참가·사양 중 무엇을 선택해도 클럽 감독 신뢰는 변하지 않습니다.</p>
      <p className="os-muted">체력과 팬·협회 관계에 미치는 영향은 선택 전에 확인하세요. 실제 데뷔와 활약은 이후 커리어 기록과 태그에 남습니다.</p>
    </section>
  );
}
