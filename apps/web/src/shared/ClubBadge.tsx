// UX-013: apps/web 안에서 구단 배지를 그릴 때 쓰는 래퍼. 팀 id → team-identity.ts(이니셜·팀 컬러) +
// ui-store teamLogos(이 기기에 올린 로고 data URL)를 합쳐 packages/ui TeamBadge에 넘긴다. 화면은
// TeamBadge를 직접 쓰지 않고 이 컴포넌트를 써야 로고 오버라이드가 모든 자리에 함께 적용된다.
import { TeamBadge, type TeamBadgeSize } from '@offside/ui';
import { getTeamIdentity } from './team-identity.js';
import { useUiStore } from './ui-store.js';

export interface ClubBadgeProps {
  teamId: string;
  size?: TeamBadgeSize;
  className?: string;
}

export function ClubBadge({ teamId, size, className }: ClubBadgeProps) {
  const identity = getTeamIdentity(teamId);
  const logoSrc = useUiStore((state) => state.teamLogos[teamId]);
  return (
    <TeamBadge
      initials={identity.initials}
      colorVar={identity.colorVar}
      {...(size !== undefined ? { size } : {})}
      {...(className !== undefined ? { className } : {})}
      {...(logoSrc !== undefined ? { logoSrc } : {})}
    />
  );
}
