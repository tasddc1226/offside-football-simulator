export type TeamBadgeSize = 's' | 'm';

export interface TeamBadgeProps {
  /** 배지에 표시할 1~2자 이니셜(예: apps/web의 getTeamIdentity(teamId).initials). */
  initials: string;
  /** 배지 배경으로 쓸 CSS 색상 값(예: 'var(--os-team-<id>)' 또는 중립 폴백 'var(--os-neutral)'). */
  colorVar: string;
  size?: TeamBadgeSize;
  className?: string;
}

/**
 * UX-008 구단 시각 아이덴티티: 이미지 에셋 없이 이니셜 + 팀 컬러 원형 배지로 구단을 구분한다.
 * 순전히 장식이라 aria-hidden으로 감춘다 — 접근 가능한 이름은 항상 배지 옆에 남겨 두는
 * 실제 팀명 텍스트가 맡는다(이 컴포넌트는 그 텍스트를 대신하지 않는다).
 *
 * 이슈 170: 이니셜은 DOM 텍스트 노드가 아니라 `data-initials` 속성으로만 넘기고 CSS 의사 요소
 * (`.os-team-badge::before { content: attr(data-initials) }`, game.css)가 그린다. aria-hidden은
 * 접근성 트리에서만 빼 주고 `innerText`·`textContent`에는 그대로 남아 "강동강동 로버스"처럼 팀명
 * 앞에 이어져 읽혔다 — 의사 요소 콘텐츠는 접근성 이름 계산·innerText·textContent 모두에서
 * 제외되므로 어느 경로로 읽어도 팀명만 남는다.
 */
export function TeamBadge({ initials, colorVar, size = 'm', className }: TeamBadgeProps) {
  const classes = ['os-team-badge', className].filter(Boolean).join(' ');
  return (
    <span
      className={classes}
      data-size={size}
      data-initials={initials}
      style={{ background: colorVar }}
      aria-hidden="true"
    />
  );
}
