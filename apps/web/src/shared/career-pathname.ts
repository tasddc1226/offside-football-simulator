// UX-014: 루트 앱 셸(__root.tsx)이 pathname만으로 "커리어 화면인가·대시보드인가"를 판단하는 순수
// 헬퍼. 라우트 매치 객체 대신 문자열만 받아 React 트리 밖에서도(단위 테스트) 쉽게 검증한다.
export function careerIdFromPathname(pathname: string): string | null {
  const match = /^\/career\/([^/]+)(?:\/|$)/.exec(pathname);
  const careerId = match?.[1];
  return careerId === undefined || careerId.length === 0 ? null : careerId;
}

/** 커리어 대시보드(SCR-029, `/career/$careerId` 정확히)에서만 탭 바를 보여준다 — 챕터·이벤트·제안
 * 같은 하위 화면은 헤더만 고정하고 탭은 없다. */
export function isCareerDashboardPathname(pathname: string, careerId: string): boolean {
  return pathname === `/career/${careerId}` || pathname === `/career/${careerId}/`;
}
