import { msUntilNextSeasonStart, serviceSeason } from '@offside/contracts/service-seasons';
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
  return () => {
    clearTimeout(timer);
    stop();
  };
}
