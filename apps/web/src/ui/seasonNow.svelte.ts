// T-11-110 기록실 화면의 '지금' — 띄운 채 새 시즌이 열리면 바뀌어 시즌 기본값·'개막 예정' 표시를 다시 고른다.
import { watchSeasonNow } from '@offside/app-core/season-opening';

/** 컴포넌트 초기화 중에 부른다($effect). */
export function seasonNow() {
  let now = $state(new Date().toISOString());
  $effect(() => watchSeasonNow(now, (t) => (now = t)));
  return {
    get now() {
      return now;
    },
  };
}
