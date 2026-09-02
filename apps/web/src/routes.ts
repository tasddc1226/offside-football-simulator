// ADR-001: 화면 명세의 SCR ID가 라우트 이름이 된다. docs/screens/README.md 카탈로그와 맞춘다.
export const SCREEN_ROUTES = {
  'SCR-001': '/',
  // SCR-002 자리표시(EMPTY 상태). 실제 선수 생성 흐름은 T-0-007 이후 구현한다.
  'SCR-002': '/career/new',
} as const;
