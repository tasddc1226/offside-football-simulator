/**
 * D-21: 화면에는 이메일 전체 대신 마스킹만 보여 준다(`a***@gmail.com` 형태 — 첫 글자 + `***` +
 * `@도메인`). `@`가 없거나 로컬 파트가 비어 있으면(입력이 이론상 잘못된 이메일이면) null을 돌려준다.
 */
export function maskEmail(email: string | null): string | null {
  if (email === null) return null;
  const atIndex = email.indexOf('@');
  if (atIndex <= 0 || atIndex === email.length - 1) return null;
  const firstChar = email[0];
  const domain = email.slice(atIndex + 1);
  return `${firstChar}***@${domain}`;
}
