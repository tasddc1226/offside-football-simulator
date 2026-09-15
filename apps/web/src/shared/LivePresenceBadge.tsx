// D-78 API-PRES-001: 값을 계산하지 않는 표시 전용 컴포넌트(ADR-005 — packages/ui가 아니라
// apps/web/src/shared에 둔다). 데이터가 없거나 0이면 null을 반환해 네비바가 흔들리지 않는다.
export function LivePresenceBadge({
  playingNow,
  compact,
}: {
  playingNow: number | undefined;
  /** PR 231 리뷰: CareerHeader 히어로 밴드처럼 공간이 좁은 자리에서는 "N명"만 보여준다(" 플레이
   * 중" 생략) — CareerHeader가 같은 마크업을 다시 만들지 않고 이 컴포넌트를 그대로 재사용한다. */
  compact?: boolean;
}) {
  if (playingNow === undefined || playingNow === 0) return null;
  return (
    <span className="os-nav-live" role="status" aria-live="off">
      <span className="os-nav-live-dot" aria-hidden="true" />
      <span>
        {playingNow.toLocaleString('ko-KR')}명{compact ? '' : ' 플레이 중'}
      </span>
    </span>
  );
}
