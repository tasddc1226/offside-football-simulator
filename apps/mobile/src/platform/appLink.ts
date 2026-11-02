// T-11-622 앱 바로 열기 링크 받기. 앱 시작 때는 첫 화면 준비 전에 링크가 오므로 기억했다가 준비되면 연다.
// expo-router 입구(+native-intent)가 import하므로 화면 코드를 끌어오지 않는다.
import { parseAppLink, type AppLink } from '@offside/app-core/appLink';

let pending: AppLink | null = null;
let open: ((link: AppLink) => void) | null = null;

function flush() {
  if (!pending || !open) return;
  const link = pending;
  pending = null;
  open(link);
}

/** 앱이 처리할 링크면 받아 두고 true. */
export function receiveAppLink(url: string): boolean {
  const link = parseAppLink(url);
  if (!link) return false;
  pending = link;
  flush();
  return true;
}

export function startAppLinks(opener: (link: AppLink) => void) {
  open = opener;
  flush();
}
