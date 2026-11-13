// T-11-606 홈의 컵 · 리그 소식 줄(웹 Home.svelte .home-events). 둘 다 열리면 한 줄 두 칸, 하나만 열리면 한 칸을 다 쓰고,
// 둘 다 없으면 줄을 그리지 않는다. 응답은 대회 화면과 같은 메모(cachedGet 2분)라 요청이 늘지 않는다. 신청은 각 대회 화면에서.
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { fetchCupHome, type CupHomeResponse } from '@offside/app-core/api/cup';
import { fetchLeague, type LeagueResponse } from '@offside/app-core/api/league';
import { cupOnHome } from '@offside/app-core/cupHome';
import { leagueOnHome } from '@offside/app-core/leagueView';
import { go } from '../../game/nav';
import { useOnPull } from '../../ui/refresh';
import { CupBanner } from '../owner/TeamCup';
import { LeagueBanner } from '../league/LeagueScreen';

export function HomeEvents() {
  const [cup, setCup] = useState<CupHomeResponse | null>(null);
  const [league, setLeague] = useState<LeagueResponse | null>(null);
  const reload = useCallback(async () => {
    const [c, l] = await Promise.all([fetchCupHome(), fetchLeague()]);
    if (c.ok) setCup(c.data);
    if (l.ok) setLeague(l.data);
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  useOnPull(reload);
  const showCup = cup && cupOnHome(cup) ? cup : null;
  const showLeague = league && leagueOnHome(league) ? league : null;
  if (!showCup && !showLeague) return null;
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      {showCup ? <CupBanner data={showCup} onOpen={() => go('cup')} /> : null}
      {showLeague ? <LeagueBanner data={showLeague} /> : null}
    </View>
  );
}
