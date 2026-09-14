// 사용자 결정(2026-09-14): 커리어 대시보드(SCR-029)를 원작처럼 4탭으로 재편한다 — 시즌(홈+일정
// 병합) · 커리어(기록+계약 병합) · 선수 · 우승 연혁. 값 하나만 이 파일에 두고 index.tsx(패널 내용)와
// CareerHeaderBar(상단 헤더 탭 바)가 함께 참조해 라벨·순서·옛 값 호환 매핑이 어긋나지 않게 한다.
export const DASHBOARD_TABS = ['season', 'career', 'player', 'trophies'] as const;
export type DashboardTab = (typeof DASHBOARD_TABS)[number];

export const DASHBOARD_TAB_LABELS: Record<DashboardTab, string> = {
  season: '시즌',
  career: '커리어',
  player: '선수',
  trophies: '우승 연혁',
};

/** PR 231 리뷰: 헤더의 CareerTabs(role="tab" 버튼)와 index.tsx의 TabsContent(role="tabpanel")는
 * 서로 다른 React 서브트리라 Radix Tabs.Root 컨텍스트로 자동 연결되지 않는다(CareerTabs.tsx 상단
 * 주석) — 두 id를 이 파일 하나에서 값별로 고정해 aria-controls·aria-labelledby가 항상 실존하는
 * 상대를 가리키게 한다. */
export function dashboardTabId(value: DashboardTab): string {
  return `career-tab-${value}`;
}
export function dashboardPanelId(value: DashboardTab): string {
  return `career-panel-${value}`;
}

export const DASHBOARD_TAB_ITEMS: ReadonlyArray<{
  value: DashboardTab;
  label: string;
  id: string;
  controls: string;
}> = DASHBOARD_TABS.map((value) => ({
  value,
  label: DASHBOARD_TAB_LABELS[value],
  id: dashboardTabId(value),
  controls: dashboardPanelId(value),
}));

/** 5탭(홈·일정·선수·계약·기록) 시절의 북마크·공유 링크를 새 4탭으로 되돌린다. 'home'은 과거에도
 * URL에 남지 않는 기본값이었지만(옛 코드 `value === 'home' ? {} : {view: value}`), 혹시 남아 있는
 * 옛 딥링크 대비 방어적으로 같이 매핑한다. */
const LEGACY_DASHBOARD_VIEW_MAP: Readonly<Record<string, DashboardTab>> = {
  home: 'season',
  schedule: 'season',
  contract: 'career',
  records: 'career',
};

/** URL `view` 검색 파라미터 원시값 → 유효한 `DashboardTab`. 새 4탭 값·옛 5탭 값·미지원 값 모두 여기
 * 하나로 처리한다(index.tsx의 `validateSearch`가 이 함수만 부른다). */
export function normalizeDashboardTab(raw: unknown): DashboardTab | undefined {
  if (typeof raw !== 'string') return undefined;
  if ((DASHBOARD_TABS as readonly string[]).includes(raw)) return raw as DashboardTab;
  return LEGACY_DASHBOARD_VIEW_MAP[raw];
}
