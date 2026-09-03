// 뒤 작업이 채울 화면의 공통 자리표시. 각 라우트 파일 머리 주석에 SCR ID와 채우는 작업 ID를 적는다.
// T-2-007: SCR-031·015가 이 컴포넌트를 처음 쓴다 — "준비 중" + 대시보드로 버튼(브리프 지시).
import { buttonClassName, buttonStyle, EmptyState } from '@offside/ui';
import { Link } from '@tanstack/react-router';

export function PlaceholderScreen({ careerId }: { careerId: string }) {
  return (
    <EmptyState
      reason="준비 중"
      action={
        <Link to="/career/$careerId" params={{ careerId }} className={buttonClassName('secondary')} style={buttonStyle}>
          대시보드로
        </Link>
      }
    />
  );
}
