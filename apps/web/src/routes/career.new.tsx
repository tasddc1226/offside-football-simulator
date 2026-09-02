// SCR-002 자리표시. 커리어 생성 흐름은 T-0-007에서 구현한다.
import { buttonClassName, buttonStyle, EmptyState } from '@offside/ui';
import { createFileRoute, Link } from '@tanstack/react-router';

export const Route = createFileRoute('/career/new')({
  component: CareerNewScreen,
});

function CareerNewScreen() {
  return (
    <EmptyState
      reason="커리어 생성은 다음 단계에서 열립니다"
      action={
        <Link to="/" className={buttonClassName('secondary')} style={buttonStyle}>
          허브로 돌아가기
        </Link>
      }
    />
  );
}
