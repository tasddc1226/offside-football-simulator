// 한국 시간(KST = UTC+9) 날짜. 서버(api/time.ts)와 클라이언트(app-core)가 같은 "오늘"을 쓰게 한 곳에 둔다(zod 없음).
export const DAY_MS = 86_400_000;
export const KST_MS = 9 * 3_600_000;

/** UTC ISO → KST 날짜(YYYY-MM-DD). */
export const kstDay = (iso: string): string =>
  new Date(Date.parse(iso) + KST_MS).toISOString().slice(0, 10);
