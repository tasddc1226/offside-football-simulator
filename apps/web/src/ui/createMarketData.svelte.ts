import {
  fetchMarket,
  fetchMarketChart,
  fetchMarketMe,
  type MarketMeResponse,
  type MarketListing,
  type MarketSale,
  type MarketChartPoint,
  type MarketSort,
} from '@offside/app-core/api/market';
import { fetchOwnerTeam, type OwnerTeamResponse } from '@offside/app-core/api/team';
import { needsOwnerLogin, type MarketView, type MarketFilter } from '@offside/app-core/market';

/** Query state is owned by one screen instance; effects stay beside their tab inputs. */
export function createMarketData(inputs: {
  view: () => MarketView;
  sort: () => MarketSort;
  filter: () => MarketFilter;
  teamSeason: () => number | undefined;
}) {
  const state = $state({
    me: null as MarketMeResponse | null,
    meFailed: null as string | null,
    guest: false,
    items: [] as MarketListing[],
    page: 0,
    hasMore: false,
    season: null as number | null,
    listStatus: 'loading' as 'loading' | 'ok' | 'error',
    recent: [] as MarketSale[],
    indexPoints: [] as MarketChartPoint[],
    team: null as OwnerTeamResponse | null,
    teamFailed: false,
  });
  // 자금 · 구단 가치 · 내 등록 · 최근 거래(1분 메모). 쓰기가 성공하면 apiFetch가 메모를 비우니 다시 받는다.
  // 로그인 전(세션 없음 · 구글 연결 전) — 매물을 누르면 영입 대신 로그인을 권한다.
  async function loadMe() {
    const r = await fetchMarketMe();
    state.meFailed = r.ok ? null : r.error.message;
    state.guest = !r.ok && needsOwnerLogin(r.error);
    if (r.ok) state.me = r.data;
  }

  /** 받은 목록(첫 페이지면 그 페이지)을 돌려준다. 못 받으면 null. */
  async function loadList(next = 0): Promise<MarketListing[] | null> {
    if (next === 0) state.listStatus = 'loading';
    const r = await fetchMarket(inputs.sort(), inputs.filter(), next);
    if (!r.ok) {
      state.listStatus = 'error';
      return null;
    }
    state.items = next === 0 ? r.data.items : [...state.items, ...r.data.items];
    // 정렬·포지션을 바꿔도 띠는 이어서 넘긴다(tick을 되돌리지 않는다). 배포 직후 옛 엣지 응답에는 recent가 없다.
    if (next === 0) state.recent = r.data.recent ?? [];
    state.page = next;
    state.hasMore = r.data.hasMore;
    state.season = r.data.season;
    state.listStatus = 'ok';
    return r.data.items;
  }
  async function loadTeam() {
    const r = await fetchOwnerTeam(inputs.view() === 'sell' ? undefined : inputs.teamSeason());
    state.teamFailed = !r.ok;
    if (r.ok) state.team = r.data;
  }
  const loadIndex = () =>
    fetchMarketChart('week').then((r) => {
      if (r.ok) state.indexPoints = r.data.points;
    });
  async function refresh() {
    const view = inputs.view();
    await Promise.all([
      loadMe(),
      view === 'market' ? loadList(0) : view === 'sell' || view === 'release' ? loadTeam() : null,
    ]);
  }
  return { state, loadMe, loadList, loadTeam, loadIndex, refresh };
}
