// 뒤 작업(T-1-008·T-1-009)이 채울 화면의 공통 자리표시. 각 라우트 파일 머리 주석에 SCR ID와
// 채우는 작업 ID를 적는다.
import { buttonClassName, buttonStyle, EmptyState } from '@offside/ui';
import { Link } from '@tanstack/react-router';

export function PlaceholderScreen() {
  return (
    <EmptyState
      reason="이 화면은 다음 작업에서 열립니다"
      action={
        <Link to="/" className={buttonClassName('secondary')} style={buttonStyle}>
          허브로 돌아가기
        </Link>
      }
    />
  );
}
