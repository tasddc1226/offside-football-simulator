// UX-013: 설정 화면 맨 위 배너 헤더(원작 SLB의 프리셋 색 배너). 배경 --os-hero는 "홈 색상" 프리셋에
// 따라 물들고(tokens.css data-accent 블록), 뒤로가기는 허브로, 오른쪽 배지는 저장 위치를 알린다.
// 전역 nav(__root)는 그대로 두고 설정 본문 최상단에만 둔다 — 페이지 유일의 h1.
import { Link } from '@tanstack/react-router';
import './settings-screen.css';

export interface SettingsBannerProps {
  /** 저장 위치 배지 문구(예: "Google 동기화" / "내 기기"). */
  badge: string;
}

export function SettingsBanner({ badge }: SettingsBannerProps) {
  return (
    <header className="os-settings-banner">
      <Link to="/" className="os-settings-banner-back" aria-label="허브로">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </Link>
      <div className="os-settings-banner-body">
        <p className="os-eyebrow os-settings-banner-eyebrow">SETTINGS</p>
        <h1 className="font-os os-settings-banner-title">설정</h1>
      </div>
      <span className="os-settings-banner-badge font-os">
        {/* UX-013 후속: 배지 문구("Google 동기화"·"내 기기"·"자동 저장")만으로는 스크린리더가 무엇의
            상태인지 문맥 없이 읽는다. sr-only는 여기서 안전하다 — .os-settings-banner-badge에는
            settings-screen.css에도 game.css에도 이 span의 크기를 되돌릴 언레이어드 규칙이 없다
            (os-team-logo-input과 달리). */}
        <span className="sr-only">저장 위치: </span>
        {badge}
      </span>
    </header>
  );
}
