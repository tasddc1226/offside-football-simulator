// UX-014 커리어 상단 헤더: 원작 SLB 캡처의 네이비 히어로 밴드를 재현한다(사용자 결정 2026-09-14) —
// 왼쪽 둥근 홈 버튼, 구단 배지, 이름(+역할·나이 캡션), 오른쪽 큰 OVR. `/career/:id/*` 전 화면(선수
// 생성 단계 제외)에 고정되고, 대시보드에서만 `tabs`(CareerTabs)를 함께 받아 밴드 아래에 그린다.
// 표시 값은 전부 props로만 받는다(ADR-005 — 게임 규칙 계산 금지, 값은 career-header-data.ts가 뽑는다).
import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { ClubBadge } from './ClubBadge.js';
import { LivePresenceBadge } from './LivePresenceBadge.js';

export interface CareerHeaderProps {
  name: string;
  /** ClubBadge에는 쓰지 않지만(장식·aria-hidden) 배지 옆에 시각 텍스트가 없어 스크린리더 전용으로 붙인다. */
  teamName: string;
  /** 실제 구단이 없으면(계약 전·무소속) null — 배지를 그리지 않는다. */
  teamId: string | null;
  roleLabel: string;
  age: number;
  /** Stable identity context shown after profile confirmation. */
  nationalityName?: string | undefined;
  genderLabel?: string | undefined;
  /** 프로필 확정 전(드래프트 단계)이면 null — "OVR —"로 표시한다. */
  ovr: number | null;
  /** T-7-015 실시간 플레이 중 인원 — 없거나 0이면 표시하지 않는다. exactOptionalPropertyTypes라
   * 호출부(CareerHeaderBar)가 명시적으로 `undefined`를 넘길 수 있게 유니온에 적어 둔다. */
  playingNow?: number | undefined;
  /** 홈 버튼이 커밋 중 명령을 우회하지 않도록(루트 GameNavigation과 같은 정책) 진행 중이면 막는다. */
  homeDisabled?: boolean | undefined;
  /** 대시보드(SCR-029)에서만 전달되는 4탭. 그 외 화면은 생략해 헤더만 고정한다. */
  tabs?: ReactNode | undefined;
}

const NAME_STYLE = { fontSize: 'var(--os-fs-h2)', lineHeight: 'var(--os-lh-h2)' } as const;
const CAPTION_STYLE = {
  fontSize: 'var(--os-fs-caption)',
  lineHeight: 'var(--os-lh-caption)',
} as const;

function HomeIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 11.5 12 4l8 7.5" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M6 10v9a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1v-9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CareerHeader({
  name,
  teamName,
  teamId,
  roleLabel,
  age,
  nationalityName,
  genderLabel,
  ovr,
  playingNow,
  homeDisabled,
  tabs,
}: CareerHeaderProps) {
  return (
    // PageShell 헤더 슬롯(.os-shell-header)은 <main>의 형제라 HTML 스펙상 <header>가 제외 대상(article·
    // aside·main·nav·section)에 안 들어가 암묵적 banner 랜드마크를 받는다 — season-result.spec.ts가
    // `page.locator('header')`로 이 헤더를 찾는다.
    <header className="os-career-header">
      <div className="os-career-header-band">
        <Link
          to="/"
          className="os-career-header-home"
          aria-label="허브로"
          aria-disabled={homeDisabled === true || undefined}
          onClick={(event) => {
            if (homeDisabled === true) event.preventDefault();
          }}
        >
          <HomeIcon />
        </Link>
        {teamId !== null ? (
          <ClubBadge
            teamId={teamId}
            teamName={teamName}
            size="m"
            className="os-career-header-badge"
          />
        ) : null}
        <div className="os-career-header-identity min-w-0">
          <span className="sr-only">{teamName}</span>
          <p className="os-career-header-name" style={NAME_STYLE}>
            {name}
          </p>
          <p className="os-career-header-meta" style={CAPTION_STYLE}>
            {roleLabel} {age}세{nationalityName !== undefined ? ` · ${nationalityName}` : ''}
            {genderLabel !== undefined ? ` · ${genderLabel}` : ''}
          </p>
        </div>
        <div className="os-career-header-ovr">
          {/* 시즌 결과 화면이 이 "OVR {값}" 문자열을 통째로 찾는다(season-result.spec.ts) —
              PlayerBanner와 같은 형식을 유지하려고 라벨·값 사이에 실제 공백 텍스트 노드를 둔다. */}
          <span className="os-career-header-ovr-label" style={CAPTION_STYLE}>
            OVR
          </span>{' '}
          <span className="os-num os-career-header-ovr-value">{ovr ?? '—'}</span>
        </div>
        <LivePresenceBadge playingNow={playingNow} compact />
      </div>
      {tabs}
    </header>
  );
}
