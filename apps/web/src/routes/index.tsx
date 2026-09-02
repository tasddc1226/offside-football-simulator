// SCR-001 홈·커리어 허브. 이 작업에서는 항상 EMPTY 상태다.
import { buttonClassName, buttonStyle, DisplayWord, EmptyState } from '@offside/ui';
import { createFileRoute, Link } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: HubScreen,
});

const CAPTION_STYLE = { fontSize: 'var(--os-fs-caption)', lineHeight: 'var(--os-lh-caption)' } as const;

function HubScreen() {
  return (
    <div className="flex flex-col items-center gap-os-6">
      <DisplayWord word="KICKOFF" caption="첫 커리어를 시작할 준비가 됐습니다" />
      <EmptyState
        reason="아직 만든 커리어가 없습니다"
        action={
          <Link to="/career/new" className={buttonClassName('primary')} style={buttonStyle}>
            커리어 시작
          </Link>
        }
      />
      <footer className="flex gap-os-4 pt-os-6">
        <Link to="/legal/terms" className="font-os text-os-text-2" style={CAPTION_STYLE}>
          이용약관
        </Link>
        <Link to="/legal/privacy" className="font-os text-os-text-2" style={CAPTION_STYLE}>
          개인정보 처리방침
        </Link>
      </footer>
    </div>
  );
}
