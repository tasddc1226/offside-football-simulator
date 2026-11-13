// T-11-606 홈의 컵 · 리그 소식 줄(웹 Home.svelte .home-events). 둘 다 열리면 한 줄 두 칸, 하나만 열리면 한 칸을 다 쓰고,
// 둘 다 없으면 줄을 그리지 않는다. 응답은 대회 화면과 같은 메모(cachedGet 2분)라 요청이 늘지 않는다. 신청은 각 대회 화면에서.
// 리그가 진행 중이고 로그인한 구단주면 리그 칸에 내 리그 엠블럼을 그린다. 내 배치는 계정마다 다른 응답이라 계정 열쇠별로만
// 들고 있고(leagueHomeSpot), 같은 계정으로 홈에 돌아오면 2분 동안 다시 묻지 않는다.
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { View } from 'react-native';
import { useSnapshot } from 'valtio';
import { hasSessionHint } from '@offside/app-core/api/client';
import { fetchCupHome, type CupHomeResponse } from '@offside/app-core/api/cup';
import { ownerHintState } from '@offside/app-core/api/friendPending';
import { fetchLeague, fetchLeagueMe, type LeagueResponse } from '@offside/app-core/api/league';
import { cupOnHome } from '@offside/app-core/cupHome';
import { createLeagueSpotStore, leagueSpotKey } from '@offside/app-core/leagueHomeSpot';
import { leagueOnHome } from '@offside/app-core/leagueView';
import { ensureAccount } from '../../game/host';
import { go } from '../../game/nav';
import { onSessionChanged, sessionToken } from '../../platform/session';
import { accountCache } from '../../store';
import { useOnPull } from '../../ui/refresh';
import { CupBanner } from '../owner/TeamCup';
import { LeagueBanner } from '../league/LeagueScreen';

/** 홈을 다시 그려도 같은 계정의 내 리그를 다시 묻지 않게 화면 밖에 둔다. */
const mySpot = createLeagueSpotStore(async () => {
  const r = await fetchLeagueMe();
  return r.ok ? r.data : null;
});
const watchSession = (fn: () => void) => {
  const stop = onSessionChanged(fn);
  return () => void stop();
};

export function HomeEvents() {
  const [cup, setCup] = useState<CupHomeResponse | null>(null);
  const [league, setLeague] = useState<LeagueResponse | null>(null);
  const showCup = cup && cupOnHome(cup) ? cup : null;
  const showLeague = league && leagueOnHome(league) ? league : null;
  // 배치는 리그가 시작한 뒤에만 있다. 그 전에는 묻지도 그리지도 않고, 로그인한 구단주가 아니면 열쇠가 없다.
  const running = showLeague?.phase === 'running';
  const account = useSnapshot(accountCache).value;
  const session = useSyncExternalStore(watchSession, sessionToken);
  const spotKey = leagueSpotKey(account, session);
  const spot = useSyncExternalStore(mySpot.subscribe, () => mySpot.get(spotKey));
  const reload = useCallback(async () => {
    const [c, l] = await Promise.all([fetchCupHome(), fetchLeague()]);
    if (c.ok) setCup(c.data);
    if (l.ok) setLeague(l.data);
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  useOnPull(() => Promise.all([reload(), running ? mySpot.sync(spotKey, true) : null]));
  // 구단주로 확인된 기기만 계정을 확인한다(로그인하지 않은 방문자는 요청이 늘지 않는다).
  useEffect(() => {
    if (running && hasSessionHint() && ownerHintState() === true) ensureAccount();
  }, [running]);
  // 로그아웃(열쇠 없음)은 바로 비우고, 리그 응답을 기다리는 동안에는 받아 둔 값을 건드리지 않는다.
  useEffect(() => {
    if (running || spotKey === null) void mySpot.sync(spotKey);
  }, [running, spotKey]);
  if (!showCup && !showLeague) return null;
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      {showCup ? <CupBanner data={showCup} onOpen={() => go('cup')} /> : null}
      {showLeague ? <LeagueBanner data={showLeague} spot={running ? spot : null} /> : null}
    </View>
  );
}
