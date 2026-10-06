// T-11-124 명예의 전당 시상대의 전성기 도트 선수(웹 PrimeAvatar.svelte와 같다). 시상대는 검색 입력마다 다시 렌더되니
// 모습은 선수·구단이 바뀔 때만 만든다(PixelAvatar는 memo).
import { useMemo } from 'react';
import { primeAvatarSpec } from '@offside/game/avatar';
import { PixelAvatar } from '../ui/PixelAvatar';

export function PrimeAvatar({
  id,
  lastClub,
  lastClubId,
  width,
}: {
  id: string;
  lastClub: string;
  lastClubId?: string | null | undefined;
  width: number;
}) {
  const spec = useMemo(
    () => primeAvatarSpec({ id, lastClub, lastClubId }),
    [id, lastClub, lastClubId],
  );
  return <PixelAvatar spec={spec} width={width} />;
}
