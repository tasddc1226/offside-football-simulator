// T-11-590 앱 자동 플레이 탐지(관찰 전용). 웹 sync/playSignals.ts와 같은 요약을 시즌 업로드에 싣는다. 시즌 커리어의 85%가
// 앱인데 이 요약이 없어 앱 매크로는 정황(활동 시간)으로만 볼 수 있었다. 터치 횟수 · 플레이 시간 · 백그라운드 시간에 더해,
// 오토 클리커가 남기는 흔적인 '바로 앞 터치와 똑같은 좌표'를 센다. 무엇을 · 어디를 눌렀는지는 남기지 않는다.
// 앱 첫 화면(_layout)의 루트 뷰가 onTouchStart로 countTouch를 부른다. 모달 안 터치와 화면 읽기 프로그램 입력은 여기까지
// 오지 않으므로 서버는 앱 요약(app: true)을 '입력 없이 진행' 판정에서 뺀다.
import type { PlaySignals } from '@offside/contracts';
import { AppState, type GestureResponderEvent } from 'react-native';

// 서버 스키마 상한(넘으면 서버가 요약을 버린다).
const MAX_COUNT = 1_000_000;
const MAX_MS = 7 * 86_400_000;
/** 같은 좌표인지 비교할 바로 앞 터치 수. 여러 점을 돌아가며 누르는 오토 클리커도 잡는다. */
const RECENT = 4;

let touches = 0;
let same = 0;
let recent: string[] = [];
let since = performance.now();
let hiddenMs = 0;
let hiddenAt: number | null = AppState.currentState === 'active' ? null : since;

AppState.addEventListener('change', (st) => {
  if (st !== 'active') hiddenAt ??= performance.now();
  else if (hiddenAt !== null) {
    hiddenMs += performance.now() - hiddenAt;
    hiddenAt = null;
  }
});

/** 루트 뷰의 onTouchStart. 좌표는 비교에만 쓰고 보내지 않는다. */
export function countTouch(e: GestureResponderEvent) {
  touches++;
  const { pageX, pageY } = e.nativeEvent;
  const spot = `${pageX},${pageY}`;
  if (recent.includes(spot)) same++;
  recent = [spot, ...recent].slice(0, RECENT);
}

/** 지난번 이후(또는 앱 시작 후)의 조작 요약을 돌려주고 다시 센다. */
export function takePlaySignals(): PlaySignals {
  const now = performance.now();
  const ms = (x: number) => Math.min(MAX_MS, Math.max(0, Math.round(x)));
  const n = (x: number) => Math.min(MAX_COUNT, x);
  const s: PlaySignals = {
    ms: ms(now - since),
    clicks: 0,
    keys: 0,
    touches: n(touches),
    moves: 0,
    synthetic: 0,
    hiddenMs: ms(hiddenMs + (hiddenAt === null ? 0 : now - hiddenAt)),
    webdriver: false,
    app: true,
    same: n(same),
  };
  touches = 0;
  same = 0;
  since = now;
  hiddenMs = 0;
  if (hiddenAt !== null) hiddenAt = now;
  return s;
}
