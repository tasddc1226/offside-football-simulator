// T-11-110 기록실 화면의 '지금' — 띄운 채 새 시즌이 열리면 바뀌어 시즌 기본값·'개막 예정' 표시를 다시 고른다.
import { useEffect, useState } from 'react';
import { watchSeasonNow } from '@offside/app-core/season-opening';

export function useSeasonNow(): string {
  const [now, setNow] = useState(() => new Date().toISOString());
  useEffect(() => watchSeasonNow(now, setNow), [now]);
  return now;
}
