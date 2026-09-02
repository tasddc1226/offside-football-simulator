// D-20: 사업자명·연락처·시행일은 이 상수 한 곳에 둔다. 최종 문안·사업자 정보는 U-010(사용자)이
// 채운다. 값이 비면 legal/privacy.tsx·terms.tsx가 "준비 중"으로 표시한다.
export const OPERATOR = {
  name: 'OFFSIDE 운영팀',
  contactEmail: '',
  effectiveDate: '2026-09-02',
} as const;

/** 값이 비어 있거나 공백만 있으면 "준비 중"으로 표시한다. */
export function operatorFieldOrPending(value: string): string {
  return value.trim().length > 0 ? value : '준비 중';
}
