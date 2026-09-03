// ADR-001: 화면 명세의 SCR ID가 라우트 이름이 된다. docs/screens/README.md 카탈로그와 맞춘다.
export const SCREEN_ROUTES = {
  'SCR-001': '/',
  'SCR-034': '/onboarding',
  'SCR-030': '/settings',
  // 자리표시(T-1-008이 채운다).
  'SCR-002': '/career/$careerId/create',
  'SCR-003': '/career/$careerId/style',
  'SCR-004': '/career/$careerId/confirm',
  'SCR-007': '/career/$careerId/path',
  'SCR-008': '/career/$careerId/tryout',
  'SCR-013': '/career/$careerId/event',
  'SCR-014': '/career/$careerId/event/result',
  'SCR-009': '/career/$careerId/offers',
  'SCR-010': '/career/$careerId/contract',
  'SCR-029': '/career/$careerId',
  // T-2-007: SCR-031·015은 자리표시(T-2-008·009가 채운다).
  'SCR-005': '/career/$careerId/preseason',
  'SCR-011': '/career/$careerId/season-prep',
  'SCR-012': '/career/$careerId/role',
  'SCR-033': '/career/$careerId/attributes',
  'SCR-031': '/career/$careerId/chapter',
  'SCR-015': '/career/$careerId/season-result',
} as const;
