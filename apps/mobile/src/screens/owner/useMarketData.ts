import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchMarket,
  fetchMarketChart,
  fetchMarketMe,
  type MarketMeResponse,
  type MarketSort,
  type MarketListing,
  type MarketSale,
  type MarketChartPoint,
} from '@offside/app-core/api/market';
import { fetchOwnerTeam, type OwnerTeamResponse } from '@offside/app-core/api/team';
import {
  needsOwnerLogin,
  pickMarketFilter,
  type MarketFilter,
  type MarketView,
} from '@offside/app-core/market';
import { notificationDestination } from '../../platform/notificationDestination';

/** Screen-owned query state. Native request ordering and silent refresh remain local. */
export function useMarketData(
  view: MarketView,
  destinationMarket: boolean,
  setView: (view: MarketView) => void,
) {
  // 자금 · 구단 가치 · 내 등록 · 최근 거래(1분 메모). 쓰기가 성공하면 apiFetch가 메모를 비우니 다시 받는다.
  const [me, setMe] = useState<MarketMeResponse | null>(null);
  const [meFailed, setMeFailed] = useState<string | null>(null);
  // 로그인 전(세션 없음 · 구글/애플 연결 전) — 매물을 누르면 영입 대신 로그인을 권한다.
  const [guest, setGuest] = useState(false);
  const loadMe = useCallback(async () => {
    const r = await fetchMarketMe();
    setGuest(!r.ok && needsOwnerLogin(r.error));
    if (r.ok) {
      setMe(r.data);
      setMeFailed(null);
    } else setMeFailed(r.error.message);
  }, []);
  const meLoaded = useRef(false);
  useEffect(() => {
    if (destinationMarket) {
      notificationDestination.market = false;
      setView('trades');
      meLoaded.current = true;
      void loadMe();
    } else if (!meLoaded.current) {
      meLoaded.current = true;
      void loadMe();
    }
  }, [loadMe, destinationMarket]);

  // 선수 사기 — 정렬·필터(포지션군 → 세부 포지션 · 유형, T-11-474)가 바뀌면 첫 페이지부터.
  const [sort, setSort] = useState<MarketSort>('new');
  const [filter, setFilter] = useState<MarketFilter>({});
  const pickFilter = (next: MarketFilter) => setFilter((f) => pickMarketFilter(f, next));
  const [items, setItems] = useState<MarketListing[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [season, setSeason] = useState<number | null>(null);
  const [listStatus, setListStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [recent, setRecent] = useState<MarketSale[]>([]);
  const listReq = useRef(0);
  // 정렬을 빠르게 바꿀 때 늦게 온 이전 응답이 덮어쓰지 않게 요청 번호를 둔다.
  const loadList = useCallback(
    /** 받은 목록(첫 페이지면 그 페이지)을 돌려준다. 못 받았거나 늦게 온 응답이면 null. */
    async (next = 0, silent = false): Promise<MarketListing[] | null> => {
      const req = ++listReq.current;
      if (next === 0 && !silent) setListStatus('loading');
      const r = await fetchMarket(sort, filter, next);
      if (req !== listReq.current) return null;
      if (!r.ok) {
        if (!silent) setListStatus('error');
        return null;
      }
      setItems((prev) => (next === 0 ? r.data.items : [...prev, ...r.data.items]));
      // 배포 직후 옛 엣지 응답에는 recent가 없다.
      if (next === 0) setRecent(r.data.recent ?? []);
      setPage(next);
      setHasMore(r.data.hasMore);
      setSeason(r.data.season);
      setListStatus('ok');
      return r.data.items;
    },
    [sort, filter],
  );
  useEffect(() => {
    if (view === 'market') void loadList(0);
  }, [view, loadList]);
  // 시장 지수(최근 7일 · 시장 전체). 선수 사기 탭을 처음 볼 때 한 번(1분 메모).
  const [indexPoints, setIndexPoints] = useState<MarketChartPoint[]>([]);
  const indexAsked = useRef(false);
  const loadIndex = useCallback(
    () => fetchMarketChart('week').then((r) => r.ok && setIndexPoints(r.data.points)),
    [],
  );
  useEffect(() => {
    if (view !== 'market' || indexAsked.current) return;
    indexAsked.current = true;
    void loadIndex();
  }, [view, loadIndex]);

  // 팔기는 지금 가진 모든 시즌 선수(T-11-425), 방출은 시즌을 골라 본다(기본은 지금 시즌).
  const [team, setTeam] = useState<OwnerTeamResponse | null>(null);
  const [teamSeason, setTeamSeason] = useState<number | undefined>(undefined);
  const [teamFailed, setTeamFailed] = useState(false);
  const loadTeam = useCallback(async () => {
    const r = await fetchOwnerTeam(view === 'sell' ? undefined : teamSeason);
    if (r.ok) {
      setTeam(r.data);
      setTeamFailed(false);
    } else setTeamFailed(true);
  }, [view, teamSeason]);
  useEffect(() => {
    // 로그인 전이면 내 선수를 묻지 않고 로그인 안내만 보인다(T-11-442).
    if ((view === 'sell' || view === 'release') && !guest) void loadTeam();
  }, [view, loadTeam, guest]);

  return {
    me,
    meFailed,
    guest,
    loadMe,
    sort,
    setSort,
    filter,
    pickFilter,
    items,
    page,
    hasMore,
    season,
    listStatus,
    recent,
    loadList,
    indexPoints,
    indexAsked,
    loadIndex,
    team,
    teamSeason,
    setTeamSeason,
    teamFailed,
    loadTeam,
  };
}
