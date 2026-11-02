// T-11-622 웹 주소로 앱이 열리면 화면은 appState로 옮기고 라우터는 첫 화면에 둔다(없는 경로 화면 방지).
import { receiveAppLink } from '../platform/appLink';

export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  return receiveAppLink(path) ? '/' : path;
}
