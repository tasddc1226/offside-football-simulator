// UX-014: __root.tsx가 `/career/:id/*` 경로에서 전역 브랜드 헤더 대신 그리는 컨테이너. 커리어
// 상태를 읽어(useCareer — 레이아웃 라우트 loader가 이미 캐시를 채워 둔 같은 쿼리 키라 추가 요청이
// 없다) CareerHeader(+대시보드에서만 CareerTabs)에 값을 내려준다.
//
// 사용자 결정(2026-09-14): 선수 생성 단계(create·style·confirm — CareerState.status === 'DRAFT',
// screenForCareer.ts와 같은 판별 기준)는 히어로 헤더 대상에서 뺀다 — 이 화면들과, 아직 쿼리가
// 로드되지 않은 순간에는 기존 최소 내비(브랜드 + "커리어" 라벨, 설정 진입 없음)를 그대로 보여준다.
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useIsMutating } from '@tanstack/react-query';
import { BrandMark } from '@offside/ui';
import { LivePresenceBadge } from './LivePresenceBadge.js';
import { rulesetForCareer } from '../engine/content.js';
import { useCareer } from '../engine/use-career.js';
import { careerHeaderName, careerHeaderOvr, careerHeaderRoleLabel } from './career-header-data.js';
import { CareerHeader } from './CareerHeader.js';
import { CareerTabs } from './CareerTabs.js';
import { useIsCommittingGuardActive } from './committing-guard.js';
import { currentTeamId, currentTeamName } from './current-team.js';
import { DASHBOARD_TAB_ITEMS, normalizeDashboardTab, type DashboardTab } from './dashboard-tabs.js';
import { isCareerDashboardPathname } from './career-pathname.js';
import { useUiStore } from './ui-store.js';
import './career-header.css';

function SkipLink() {
  return (
    <a href="#game-content" className="os-skip-link">
      본문으로 건너뛰기
    </a>
  );
}

/** DRAFT 단계·아직 로드 전: 루트 GameNavigation이 기존에 쓰던 것과 같은 최소 내비(브랜드 링크
 * 없이 텍스트만 — "선수 생성 단계 화면은 안전한 뒤로가기 흐름을 스스로 관리한다"는 기존 정책을
 * 그대로 지킨다, __root.tsx 원래 주석 참고). */
function FallbackCareerNav({ playingNow }: { playingNow: number | undefined }) {
  return (
    <nav className="os-app-nav" aria-label="게임 메뉴">
      <span className="os-brand">
        <BrandMark />
        <span>OFFSIDE</span>
      </span>
      <div className="os-nav-right">
        <LivePresenceBadge playingNow={playingNow} />
        <span className="os-nav-context">커리어</span>
      </div>
    </nav>
  );
}

export function CareerHeaderBar({
  careerId,
  pathname,
  playingNow,
}: {
  careerId: string;
  pathname: string;
  playingNow: number | undefined;
}) {
  const query = useCareer(careerId);
  const navigate = useNavigate();
  // strict:false — 이 컴포넌트는 대시보드(`/career/$careerId`) 밖의 경로에서도 마운트되므로 특정
  // 라우트의 search 스키마에 묶일 수 없다(그 경로들엔 애초에 `view`가 없다).
  const search = useSearch({ strict: false }) as { view?: unknown; signed?: unknown };
  const signedFlag = search.signed === true;
  const teamNameOverrides = useUiStore((state) => state.teamNameOverrides);
  // PR 231 리뷰: 전역 useIsMutating()만 보면 confirm.tsx(SCR-004) 등 COMMITTING 화면의 결과 연출·
  // 복구 코드 대기 구간(뮤테이션은 끝났지만 화면 FSM은 아직 COMMITTING)에서 홈 버튼이 이탈 방지를
  // 우회한다 — useCommittingExitGuard가 켜는 전역 신호도 함께 반영한다. 두 훅 모두 매 렌더 항상
  // 호출해야 하므로(Rules of Hooks) `||`로 묶어 단축 평가되지 않게 먼저 각자 변수에 담는다.
  const isMutating = useIsMutating() > 0;
  const isCommittingGuardActive = useIsCommittingGuardActive();
  const mutating = isMutating || isCommittingGuardActive;

  const data = query.data;
  if (data === undefined || data.state.status === 'DRAFT') {
    return (
      <>
        <SkipLink />
        <FallbackCareerNav playingNow={playingNow} />
      </>
    );
  }

  const { state } = data;
  const ruleset = rulesetForCareer(state);
  const showTabs = isCareerDashboardPathname(pathname, careerId);
  const activeTab = normalizeDashboardTab(search.view) ?? 'season';

  function changeTab(value: string) {
    if (mutating) return;
    // CareerTabs는 재사용 가능한 범용 tablist라 value 타입이 string이다 — 이 컨테이너가 항상
    // DASHBOARD_TAB_ITEMS(DashboardTab 값)만 넘기므로 여기서만 좁혀 쓴다.
    const tab = value as DashboardTab;
    void navigate({
      to: '/career/$careerId',
      params: { careerId },
      search: {
        ...(signedFlag ? { signed: true } : {}),
        ...(tab === 'season' ? {} : { view: tab }),
      },
      replace: true,
    });
  }

  return (
    <>
      <SkipLink />
      <CareerHeader
        name={careerHeaderName(state)}
        teamName={currentTeamName(state, ruleset, teamNameOverrides)}
        teamId={currentTeamId(state, ruleset)}
        roleLabel={careerHeaderRoleLabel(state)}
        age={state.age}
        ovr={careerHeaderOvr(state)}
        playingNow={playingNow}
        homeDisabled={mutating}
        tabs={
          showTabs ? (
            <CareerTabs items={DASHBOARD_TAB_ITEMS} active={activeTab} onChange={changeTab} />
          ) : undefined
        }
      />
    </>
  );
}
