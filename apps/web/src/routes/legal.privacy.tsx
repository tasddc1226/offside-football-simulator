// ADR-009 "검토 통과 구현 규칙": 약관·개인정보 처리방침은 SPA 내부 라우트로 렌더링한다. 외부 링크 금지.
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/legal/privacy')({
  component: PrivacyScreen,
});

function PrivacyScreen() {
  return (
    <div className="flex flex-col gap-os-3">
      <h1
        className="font-os font-bold text-os-text"
        style={{ fontSize: 'var(--os-fs-h1)', lineHeight: 'var(--os-lh-h1)' }}
      >
        개인정보 처리방침
      </h1>
      <p
        className="font-os text-os-text-2"
        style={{ fontSize: 'var(--os-fs-body)', lineHeight: 'var(--os-lh-body)' }}
      >
        문서 준비 중입니다.
      </p>
    </div>
  );
}
