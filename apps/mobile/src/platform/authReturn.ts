// T-11-846 로그인 복귀 주소(offside://auth?...) 받기. expo-router 입구(+native-intent)가 import하므로 화면 · 로그인 코드를
// 끌어오지 않는다. 앱 시작 때는 첫 화면 준비 전에 주소가 오므로 기억했다가, 로그인 흐름(platform/auth)이 받는 쪽을 등록하면 넘긴다.
// 브라우저에 가 있는 동안 앱이 종료됐거나(Android), 로그인을 마치기 전에 앱으로 먼저 돌아온 뒤 브라우저에서 마친 경우를 위한 길이다.
let pending: string | null = null;
let handler: ((url: string) => void) | null = null;

function flush() {
  if (!pending || !handler) return;
  const url = pending;
  pending = null;
  handler(url);
}

export function receiveAuthReturn(url: string) {
  pending = url;
  flush();
}

export function onAuthReturn(fn: (url: string) => void) {
  handler = fn;
  flush();
}
