// 자동 플레이 탐지(관찰 전용). 시즌마다 조작 횟수만 세어 시즌 업로드에 싣는다 — 무엇을 눌렀는지·어디를 눌렀는지는
// 남기지 않는다. 게임에는 아무 영향이 없고, 운영 도구가 자동화 브라우저·스크립트 클릭 같은 흐름을 모아 보는 데만 쓴다.
import type { PlaySignals } from '@offside/contracts';

type Counts = Pick<PlaySignals, 'clicks' | 'keys' | 'touches' | 'moves' | 'synthetic'>;
const zero = (): Counts => ({ clicks: 0, keys: 0, touches: 0, moves: 0, synthetic: 0 });
// 서버 스키마 상한(넘으면 시즌 업로드가 거절된다).
const MAX_COUNT = 1_000_000;
const MAX_MS = 7 * 86_400_000;

let counts = zero();
let since = 0;
let hiddenMs = 0;
let hiddenAt: number | null = null;

export function installPlaySignals() {
  since = performance.now();
  const on = (type: string, f: (e: Event) => void) =>
    addEventListener(type, f, { capture: true, passive: true });
  on('click', (e) => (e.isTrusted ? counts.clicks++ : counts.synthetic++));
  on('keydown', (e) => e.isTrusted && counts.keys++);
  on('touchstart', (e) => e.isTrusted && counts.touches++);
  on(
    'pointermove',
    (e) => e.isTrusted && (e as PointerEvent).pointerType === 'mouse' && counts.moves++,
  );
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') hiddenAt = performance.now();
    else if (hiddenAt !== null) {
      hiddenMs += performance.now() - hiddenAt;
      hiddenAt = null;
    }
  });
}

/** 지난번 이후(또는 앱 시작 후)의 조작 요약을 돌려주고 다시 센다. */
export function takePlaySignals(): PlaySignals {
  const now = performance.now();
  const ms = (x: number) => Math.min(MAX_MS, Math.max(0, Math.round(x)));
  const n = (x: number) => Math.min(MAX_COUNT, x);
  const s: PlaySignals = {
    ms: ms(now - since),
    clicks: n(counts.clicks),
    keys: n(counts.keys),
    touches: n(counts.touches),
    moves: n(counts.moves),
    synthetic: n(counts.synthetic),
    hiddenMs: ms(hiddenMs + (hiddenAt === null ? 0 : now - hiddenAt)),
    webdriver: navigator.webdriver === true,
  };
  counts = zero();
  since = now;
  hiddenMs = 0;
  if (hiddenAt !== null) hiddenAt = now;
  return s;
}
