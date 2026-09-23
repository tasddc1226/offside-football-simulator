// ───────── 작은 DOM/문자열 유틸 ─────────
// account.ts와 ui.ts에서 중복 정의되던 HTML 이스케이프 헬퍼를 한 곳에 모은다.
export const esc = (t: unknown): string =>
  String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
