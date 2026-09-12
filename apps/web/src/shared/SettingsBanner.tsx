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
      <span className="os-settings-banner-badge font-os">{badge}</span>
    </header>
  );
}
