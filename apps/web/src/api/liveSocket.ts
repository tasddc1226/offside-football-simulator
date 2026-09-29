import { LIVE_PING, LIVE_PING_SEC, LIVE_SOCKET_PATH } from '@offside/contracts/polling';
import type { LivePush } from '@offside/contracts';
import { apiBaseUrl } from '@offside/app-core/api/client';

// T-10-072 홈 라이브 실시간 소켓. 새 시즌·은퇴 소식을 올라오는 즉시 받는다. 화면이 보일 때만 붙어 있고(숨으면
// 끊고, 다시 보이면 붙는다), 끊기면 5초부터 두 배씩 최대 5분까지 기다렸다 다시 붙는다 — 그동안 홈은 1분 폴링으로
// 계속 보인다(HomeLive.svelte). 서버 허브는 핑에 깨지 않고 자동으로 pong을 돌려준다.
// T-10-076 영구결번 알림은 어느 화면에서나 받는다 — 듣는 쪽이 여럿이어도 소켓은 하나만 연다.

const RETRY_MIN_MS = 5_000;
const RETRY_MAX_MS = 5 * 60_000;

export const liveSocketUrl = (base = apiBaseUrl()) =>
  `${base.replace(/^http/, 'ws')}${LIVE_SOCKET_PATH}`;

const listeners = new Set<(p: LivePush) => void>();
let stop: (() => void) | null = null;

/** 소켓 메시지를 듣는다. 첫 구독에 연결하고 마지막 구독이 풀리면 끊는다. 멈추는 함수를 돌려준다. */
export function onLive(listener: (p: LivePush) => void): () => void {
  listeners.add(listener);
  stop ??= connect((p) => listeners.forEach((l) => l(p)));
  return () => {
    listeners.delete(listener);
    if (listeners.size || !stop) return;
    stop();
    stop = null;
  };
}

/** 연결을 시작하고, 멈추는 함수를 돌려준다. WebSocket이 없는 환경이면 아무것도 하지 않는다. */
function connect(onPush: (p: LivePush) => void): () => void {
  if (typeof WebSocket === 'undefined') return () => {};
  let ws: WebSocket | null = null;
  let ping: ReturnType<typeof setInterval> | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let wait = RETRY_MIN_MS;
  let stopped = false;

  const drop = () => {
    clearInterval(ping);
    clearTimeout(retry);
    if (ws) {
      ws.onclose = null;
      ws.close();
      ws = null;
    }
  };
  const open = () => {
    drop();
    if (stopped || document.visibilityState !== 'visible') return;
    const sock = new WebSocket(liveSocketUrl());
    ws = sock;
    sock.onopen = () => {
      wait = RETRY_MIN_MS;
      ping = setInterval(() => sock.send(LIVE_PING), LIVE_PING_SEC * 1000);
    };
    sock.onmessage = (m) => {
      if (typeof m.data !== 'string' || !m.data.startsWith('{')) return; // pong
      try {
        onPush(JSON.parse(m.data) as LivePush);
      } catch {
        // 알 수 없는 메시지는 버린다.
      }
    };
    sock.onclose = () => {
      clearInterval(ping);
      ws = null;
      retry = setTimeout(open, wait);
      wait = Math.min(wait * 2, RETRY_MAX_MS);
    };
  };
  const onVisibility = () => (document.visibilityState === 'visible' ? ws || open() : drop());

  open();
  document.addEventListener('visibilitychange', onVisibility);
  return () => {
    stopped = true;
    document.removeEventListener('visibilitychange', onVisibility);
    drop();
  };
}
