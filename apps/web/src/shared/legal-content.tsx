// 설정의 서비스 정책 시트(SheetContent)와 /legal/* 전체 페이지 라우트가 같은 본문 컴포넌트를
// 렌더하도록 raw 본문(TermsContent·PrivacyContent)을 여기서 한 번만 감싼다. 문구 자체는 바뀌지
// 않는다 — kind로 어느 본문을 그릴지만 고른다(ADR-009: 약관·개인정보는 SPA 내부 컴포넌트로만).
import { PrivacyContent } from '../legal/privacy.js';
import { TermsContent } from '../legal/terms.js';

export type LegalDocumentKind = 'terms' | 'privacy';

const LEGAL_DOCUMENT_TITLE: Record<LegalDocumentKind, string> = {
  terms: '이용약관',
  privacy: '개인정보 처리방침',
};

const LEGAL_DOCUMENT_PATH: Record<LegalDocumentKind, '/legal/terms' | '/legal/privacy'> = {
  terms: '/legal/terms',
  privacy: '/legal/privacy',
};

export function legalDocumentTitle(kind: LegalDocumentKind): string {
  return LEGAL_DOCUMENT_TITLE[kind];
}

export function legalDocumentPath(kind: LegalDocumentKind): '/legal/terms' | '/legal/privacy' {
  return LEGAL_DOCUMENT_PATH[kind];
}

export function LegalDocument({ kind }: { kind: LegalDocumentKind }) {
  return kind === 'terms' ? <TermsContent /> : <PrivacyContent />;
}
