/** 06 "숫자 표시": 로컬 시각 `YYYY-MM-DD HH:mm`. 허브 카드의 마지막 갱신 표시용. */
export function formatLocalDateTime(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
