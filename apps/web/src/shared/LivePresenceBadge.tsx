// D-78 API-PRES-001: 값을 계산하지 않는 표시 전용 컴포넌트(ADR-005 — packages/ui가 아니라
// apps/web/src/shared에 둔다). 데이터가 없거나 0이면 null을 반환해 네비바가 흔들리지 않는다.
export function LivePresenceBadge({ playingNow }: { playingNow: number | undefined }) {
  if (playingNow === undefined || playingNow === 0) return null;
  return (
    <span className="os-nav-live" role="status" aria-live="off">
      <span className="os-nav-live-dot" aria-hidden="true" />
      <span>{playingNow.toLocaleString('ko-KR')}명 플레이 중</span>
    </span>
  );
}
