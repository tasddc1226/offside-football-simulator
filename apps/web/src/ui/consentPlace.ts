// T-11-437 이용 분석 동의 창을 띄우는 화면. 홈에서만 묻고(선수 생성 · 게임 중에는 끼어들지 않는다), 환경설정은 같은 카드를
// 그 화면에 그린다. 다른 화면에서 고르기 전이면 동의하지 않은 것과 같아 아무것도 보내지 않는다.
import type { Screen } from '@offside/app-core/state';

export const consentHere = (screen: Screen): boolean => screen === 'home';
