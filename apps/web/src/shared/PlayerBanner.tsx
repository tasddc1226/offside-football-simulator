// UX-010 P5: 챕터·이벤트·이벤트 결과·시즌 결과 화면 "본문"에 붙는 선수 정체성 배너(상단 고정
// CareerHeader와는 별개 — 그 헤더는 레이아웃이 모든 /career/:id/* 화면에 항상 그리고, 이 배너는
// 화면 콘텐츠 안에서 그 시점의 맥락(임대·이적 등)을 함께 보여줄 필요가 있는 화면만 쓴다, UX-014
// PR 본문 한계 참고). 각 화면에 흩어져 있던 "이름 · 팀 · 포지션" 중복 텍스트를 이 컴포넌트 하나로
// 모은다 — eyebrow 팀명 → h1 이름 → 우측 큰 숫자 강조 시각 계열은 CareerHeader와 맞추되, 클래스·
// 마크업은 독립이다. 이름은 DSN-CMP-001 관례(13-visual-design-system.md)를 따라 `<h2>`로 h1 토큰
// 크기를 쓴다.
import { ClubBadge } from './ClubBadge.js';

export interface PlayerBannerProps {
  name: string;
  /** team-names.ts resolveTeamName(...) ?? 호출부 대체 문구(예: "무소속")를 거친 최종 표시 문자열. */
  teamName: string;
  /** ClubBadge용 팀 id. 실제 구단이 없으면(계약 전·무소속 등) null — 배지를 그리지 않는다. */
  teamId: string | null;
  position: string;
  shirtNumber: string;
  age: number;
  /** 프로필 확정 전(드래프트 단계 이벤트 등)이면 null — "OVR —"로 표시한다. */
  ovr: number | null;
}

const H1_STYLE = { fontSize: 'var(--os-fs-h1)', lineHeight: 'var(--os-lh-h1)' } as const;
const CAPTION_STYLE = { fontSize: 'var(--os-fs-caption)', lineHeight: 'var(--os-lh-caption)' } as const;

export function PlayerBanner({ name, teamName, teamId, position, shirtNumber, age, ovr }: PlayerBannerProps) {
  return (
    <header className="os-player-banner flex flex-col gap-os-2" aria-label="선수 정보">
      <p className="os-eyebrow flex min-w-0 items-center gap-os-2">
        {teamId !== null ? <ClubBadge teamId={teamId} size="s" /> : null}
        <span className="min-w-0 truncate">{teamName}</span>
      </p>
      <div className="flex items-end justify-between gap-os-3">
        <h2 className="min-w-0 truncate font-os font-bold text-os-text" style={H1_STYLE}>
          {name}
        </h2>
        <span className="os-num shrink-0 font-os font-bold text-os-accent">
          {ovr === null ? 'OVR —' : `OVR ${ovr}`}
        </span>
      </div>
      <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
        {position} · #{shirtNumber} · {age}세
      </p>
    </header>
  );
}
