// ADR-009 "검토 통과 구현 규칙": 약관·개인정보 처리방침은 SPA 내부 라우트로 렌더링한다. 외부 링크 금지.
import { createFileRoute } from '@tanstack/react-router';
import { TermsContent } from '../legal/terms.js';

export const Route = createFileRoute('/legal/terms')({
  component: TermsScreen,
});

function TermsScreen() {
  return (
    <div className="flex flex-col gap-os-5">
      <h1
        className="font-os font-bold text-os-text"
        style={{ fontSize: 'var(--os-fs-h1)', lineHeight: 'var(--os-lh-h1)' }}
      >
        이용약관
      </h1>
      <TermsContent />
    </div>
  );
}
