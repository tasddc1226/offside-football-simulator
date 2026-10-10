import {
  msUntilNextSeasonStart,
  onSeasonSchedule,
  openTeamSeasons,
  serviceSeason,
} from '@offside/contracts/service-seasons';
import { isVisible, watchVisibility } from './api/liveSocket.js';
import { detailOpenNow } from './state.js';

// setTimeout의 32비트 상한 — 넘기면 즉시 실행돼 반복된다.
const MAX_DELAY = 2_147_483_647;

/** 생성 화면을 열어 둔 채 개막해도 선택지를 연다. 서버 요청·주기적 폴링 없이 경계에서 한 번만 알린다. */
export function watchDetailOpening(onOpen: () => void): () => void {
  const season = serviceSeason(1);
  if (!season) return () => {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  const check = () => {
    if (detailOpenNow()) {
      onOpen();
      return;
    }
    // 긴 대기에서 setTimeout의 32비트 상한을 넘겨 즉시 반복되는 것을 막는다.
    timer = setTimeout(check, Math.min(Date.parse(season.startsAt) - Date.now(), MAX_DELAY));
  };
  check();
  return () => clearTimeout(timer);
}

/**
 * T-11-107 화면을 띄운 채 다음 시즌 개막을 넘기거나 화면으로 돌아오면 onTick — 시즌 기본값을 그 자리에서 다시 고르게 한다.
 * 폴링 없이 개막 시각 타이머와 화면 복귀만 본다.
 */
export function watchSeasonClock(onTick: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    clearTimeout(timer);
    const ms = msUntilNextSeasonStart(new Date().toISOString());
    if (ms !== null) timer = setTimeout(tick, Math.min(ms + 1000, MAX_DELAY));
  };
  const tick = () => {
    onTick();
    schedule();
  };
  schedule();
  const stop = watchVisibility(() => isVisible() && tick());
  // 서버 시즌 일정이 다음 시즌을 더하거나 바꾸면 그 개막에 맞춰 다시 건다.
  const off = onSeasonSchedule(tick);
  return () => {
    clearTimeout(timer);
    stop();
    off();
  };
}

/**
 * T-11-110 기록실 화면용 시각 — since 뒤로 새 시즌이 열렸을 때만 그 시각을 알린다. 화면 복귀마다 `now`를 바꾸면
 * 그 시각으로 다시 불러오는 화면(내 선수)이 매번 요청하므로, 시즌 기본값·'개막 예정'이 실제로 달라질 때만 부른다.
 */
export function watchSeasonNow(since: string, onChange: (now: string) => void): () => void {
  let opened = openTeamSeasons(since).length;
  return watchSeasonClock(() => {
    const now = new Date().toISOString();
    const n = openTeamSeasons(now).length;
    if (n === opened) return;
    opened = n;
    onChange(now);
  });
}
