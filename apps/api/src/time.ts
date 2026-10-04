// 한국 시간(KST = UTC+9) 날짜 계산. 저장·비교는 UTC ISO로 하고, "오늘"의 경계만 KST로 자른다.
export const DAY_MS = 86_400_000;
const KST_MS = 9 * 3_600_000;

/** UTC ISO → KST 날짜(YYYY-MM-DD). */
export const kstDay = (iso: string): string =>
  new Date(Date.parse(iso) + KST_MS).toISOString().slice(0, 10);

/** now 기준 최근 days일의 KST 날짜(오래된 날부터)와 그 첫날 0시(KST)의 UTC ISO. */
export function kstDays(now: Date, days: number): { days: string[]; startIso: string } {
  const today = new Date(now.getTime() + KST_MS);
  today.setUTCHours(0, 0, 0, 0);
  const list = Array.from({ length: days }, (_, i) =>
    new Date(today.getTime() - (days - 1 - i) * DAY_MS).toISOString().slice(0, 10),
  );
  return {
    days: list,
    startIso: new Date(today.getTime() - (days - 1) * DAY_MS - KST_MS).toISOString(),
  };
}
