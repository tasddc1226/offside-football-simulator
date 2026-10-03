import { serviceSeason } from '@offside/contracts/service-seasons';
import { detailOpenNow } from './state.js';

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
    timer = setTimeout(check, Math.min(Date.parse(season.startsAt) - Date.now(), 2_147_483_647));
  };
  check();
  return () => clearTimeout(timer);
}
