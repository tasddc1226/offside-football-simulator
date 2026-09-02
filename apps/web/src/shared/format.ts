/** 06 "숫자 표시": 로컬 시각 `YYYY-MM-DD HH:mm`. 허브 카드의 마지막 갱신 표시용. */
export function formatLocalDateTime(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 동기화 배지의 "저장됨" 상대 시각: "방금"·"n분 전"·"n시간 전". */
export function formatRelativeTime(iso: string, now: number = Date.now()): string {
  const diffMs = Math.max(0, now - new Date(iso).getTime());
  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 1) return '방금';
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 1) return `${diffMinutes}분 전`;
  return `${diffHours}시간 전`;
}
