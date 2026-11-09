// 새 소식 배너(웹 NewsBanner.svelte · 앱 useTopBanner)를 띄울 화면. 웹·앱이 같은 규칙을 쓴다.
// 소식 화면은 이미 글을 보고 있어서, 선수 만들기는 배너가 제목과 단계 버튼을 덮어서(audit F1) 띄우지 않는다.
// 숨기기만 하고 본 것으로 치지 않는다: 다른 화면으로 돌아가면 같은 알림이 다시 보인다.
// 새 버전(OTA) 배너는 이 규칙과 상관없이 어느 화면에서나 먼저 뜬다.
import type { Screen } from './state.js';

const HIDDEN: ReadonlySet<Screen> = new Set<Screen>(['board', 'create']);

export const newsBannerOnScreen = (screen: Screen): boolean => !HIDDEN.has(screen);
