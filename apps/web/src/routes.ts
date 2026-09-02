// ADR-001: 화면 명세의 SCR ID가 라우트 이름이 된다. docs/screens/README.md 카탈로그와 맞춘다.
export const SCREEN_ROUTES = {
  'SCR-001': '/',
  'SCR-034': '/onboarding',
  'SCR-030': '/settings',
  // 자리표시(T-1-008이 채운다).
  'SCR-002': '/career/$careerId/create',
  'SCR-003': '/career/$careerId/style',
  'SCR-004': '/career/$careerId/confirm',
  // 자리표시(T-1-009가 채운다).
  'SCR-007': '/career/$careerId/path',
  'SCR-008': '/career/$careerId/tryout',
  'SCR-013': '/career/$careerId/event',
  'SCR-009': '/career/$careerId/offers',
  'SCR-010': '/career/$careerId/contract',
  // 자리표시(T-1-009). 이 작업은 PlayerHeader·"허브로"만 채운다.
  'SCR-029': '/career/$careerId',
} as const;
