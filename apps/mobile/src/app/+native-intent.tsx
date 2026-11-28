// T-11-622 웹 주소로 앱이 열리면 화면은 appState로 옮기고 라우터는 첫 화면에 둔다(없는 경로 화면 방지).
import { isAuthReturnLink } from '@offside/app-core/appLink';
import { receiveAppLink } from '../platform/appLink';
import { receiveAuthReturn } from '../platform/authReturn';

export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  // T-11-794 로그인 복귀 주소는 로그인 흐름(platform/auth)이 직접 받는다. Android에서 라우터가 없는 경로 화면으로 덮지 않게 한다.
  // T-11-846 로그인 흐름이 끝난 뒤(앱 재시작 · 먼저 돌아온 뒤) 온 복귀 주소는 저장해 둔 로그인으로 마저 받는다.
  if (isAuthReturnLink(path)) {
    receiveAuthReturn(path);
    return '/';
  }
  return receiveAppLink(path) ? '/' : path;
}
