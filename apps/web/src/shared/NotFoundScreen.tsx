// 이슈 155: 존재하지 않는 경로·삭제된 커리어 딥링크의 not-found 화면. 루트 라우트의
// notFoundComponent로 등록돼 앱 셸(PageShell·GameNavigation) 안에서 토큰 기반으로 그려진다.
// 라우트 전환 시 스크롤·포커스 리셋은 __root.tsx의 기존 로직이 그대로 맡는다 — 이 화면은 제목만
// 문서 제목에 반영한다(GameNavigation의 제목 effect보다 나중에 실행되는 자식 effect라 덮어쓴다).
import { useEffect } from 'react';
import { buttonClassName, buttonStyle } from '@offside/ui';
import { Link } from '@tanstack/react-router';

export const NOT_FOUND_TITLE = '페이지를 찾을 수 없습니다';

const H1_STYLE = { fontSize: 'var(--os-fs-h1)', lineHeight: 'var(--os-lh-h1)' } as const;
const BODY_STYLE = { fontSize: 'var(--os-fs-body)', lineHeight: 'var(--os-lh-body)' } as const;

export function NotFoundScreen() {
  useEffect(() => {
    document.title = `${NOT_FOUND_TITLE} — OFFSIDE`;
  }, []);

  return (
    <div className="os-screen" data-testid="not-found">
      <section
        className="os-panel flex flex-col items-center gap-os-4 text-center"
        aria-labelledby="not-found-title"
      >
        <p className="os-eyebrow">OFFSIDE</p>
        <h1 id="not-found-title" className="font-os font-bold text-os-text" style={H1_STYLE}>
          {NOT_FOUND_TITLE}
        </h1>
        <p className="font-os text-os-text-2" style={BODY_STYLE}>
          주소가 바뀌었거나 삭제된 커리어일 수 있습니다. 허브에서 커리어를 다시 선택해 주세요.
        </p>
        <Link to="/" className={buttonClassName('primary', 'w-full justify-center')} style={buttonStyle}>
          허브로
        </Link>
      </section>
    </div>
  );
}
