/**
 * T-11-602 무한히 반짝이는 장식(등급 엠블럼 · 컵 트로피)은 이 크기부터만 움직인다. 목록 줄(랭킹 · 게시판 · 칭호 배지)의 작은
 * 장식까지 줄마다 애니메이션 뷰 여러 개를 계속 돌리면 안드로이드 UI 스레드가 매 프레임 속성 갱신(Reanimated
 * synchronouslyUpdateUIProps)에 묶여 입력이 밀리고 ANR이 난다. 작은 장식은 움직임 줄이기와 같은 모양으로 멈춰 그린다.
 */
export const DECOR_MOTION_MIN = 40;
