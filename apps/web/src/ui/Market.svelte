<script module lang="ts">
  // T-11-158 '구단 자금 내역 보기'로 나갔다가 뒤로 돌아오면 '내 거래' 탭을 다시 연다(한 번만 읽는다).
  let backToTrades = false;
  function takeBackToTrades() {
    const back = backToTrades;
    backToTrades = false;
    return back;
  }
</script>

<script lang="ts">
  import { tick as flush } from 'svelte';
  import Skeleton from './Skeleton.svelte';
  import LoginButtons from './LoginButtons.svelte';
  import { intlLocale } from '@offside/contracts/i18n';
  import { tn } from '@offside/game/i18n/names';
  // T-11-080 이적시장 — 지금 시즌 은퇴 선수 카드를 구단 자금으로 사고판다. 구단주 화면의 '이적시장'으로 연다.
  // T-11-080d 시안(이적시장 모바일 시안)대로: 초록 머리에 구단 자금과 '자금 만들기', 탭 셋(선수 사기 · 팔기 · 내 거래),
  // 카드 모양 목록, 카드 상세 영입 시트, 카드 고르기 + 슬라이더 판매, 방출 화면. 각 화면은 처음 열 때만 불러온다.
  import {
    buyListing,
    cancelListing,
    createListing,
    fetchMarket,
    fetchMarketChart,
    fetchMarketMe,
    releaseCards,
    setCardLock,
    type MarketCard,
    type MarketChartPoint,
    type MarketListing,
    type MarketSale,
    type MarketMeResponse,
    type MarketSort,
    isStaleListing,
  } from '@offside/app-core/api/market';
  import { fetchOwnerTeam, type OwnerTeamResponse, type TeamPlayer } from '@offside/app-core/api/team';
  import {
    MARKET_POS_FILTERS,
    marketDetailFilters,
    marketFiltered,
    marketFindChips,
    marketSubReset,
    cardFrom,
    marketTypeFilters,
    pickMarketFilter,
    type MarketFilter,
    MARKET_SORT_LABEL,
    MARKET_TICKER_MS,
    MARKET_TOAST,
    marketTabs,
    buyBlock,
    cardMeta,
    cardStyle,
    fundsText,
    lineupOf,
    marketEmptyText,
    marketName,
    priceAtPct,
    staleListingNext,
    cardAttrStrip,
    priceDiff,
    releaseAmount,
    releaseConfirmText,
    releaseLock,
    releaseValue,
    saleText,
    sellCandidates,
    sellNote,
    sellSlider,
    sellable,
    sellQuote,
    type MarketView,
    needsOwnerLogin,
    allReleasePicked,
    marketGuestText,
    pickAllIds,
    pickAllLabel,
    togglePickId,
  } from '@offside/app-core/market';
  import { agoKo, fmtValue } from '@offside/app-core/format';
  import { localCareerNames } from '@offside/game/hof-store';
  import { POS_LABEL } from '@offside/game/pos-label';
  import { DETAIL_LABEL, detailPosOf } from '@offside/contracts/positions';
  import Topbar from './Topbar.svelte';
  import PlayerCard from './team/PlayerCard.svelte';
  import { marketSalaryText } from '@offside/app-core/salary';
  import { teamCoreText as TC } from '@offside/app-core/i18n/ko/teamCore';
  import MarketChart from './MarketChart.svelte';
  import MarketFind from './MarketFind.svelte';
  import { CHART_COPY, marketIndex } from '@offside/app-core/marketChart';
  import { go, takeFocus } from './nav.js';
  import { dur } from './motion.js';
  import { fundsHistoryText as F } from '@offside/app-core/i18n/ko/fundsHistory';
  import { toast } from './helpers.js';
  import { marketText as L } from '@offside/app-core/i18n/ko/market';
  import { RELEASE_MAX } from '@offside/contracts/market-value';

  const local = localCareerNames();
  // T-11-442 상점의 '방출하러 가기'로 오면 방출 화면부터 연다.
  let view = $state<MarketView>(takeFocus('marketRelease') ? 'release' : takeBackToTrades() ? 'trades' : 'market');
  let error = $state<string | null>(null);
  let busy = $state(false);

  // 자금 · 구단 가치 · 내 등록 · 최근 거래(1분 메모). 쓰기가 성공하면 apiFetch가 메모를 비우니 다시 받는다.
  let me = $state<MarketMeResponse | null>(null);
  let meFailed = $state<string | null>(null);
  // 로그인 전(세션 없음 · 구글 연결 전) — 매물을 누르면 영입 대신 로그인을 권한다.
  let guest = $state(false);
  async function loadMe() {
    const r = await fetchMarketMe();
    meFailed = r.ok ? null : r.error.message;
    guest = !r.ok && needsOwnerLogin(r.error);
    if (r.ok) me = r.data;
  }
  void loadMe();

  // 선수 사기 — 정렬·필터(포지션군 → 세부 포지션 · 유형, T-11-474)가 바뀌면 첫 페이지부터.
  let sort = $state<MarketSort>('new');
  let filter = $state<MarketFilter>({});
  const pickFilter = (next: MarketFilter) => (filter = pickMarketFilter(filter, next));
  // T-11-500 국적 · 팀으로 찾기 시트(열 때만 고를 거리를 받는다).
  let finding = $state(false);
  const findChips = $derived(marketFindChips(filter));
  const details = $derived(marketDetailFilters(filter.pos));
  const types = $derived(marketTypeFilters(filter.pos));
  let items = $state<MarketListing[]>([]);
  let page = $state(0);
  let hasMore = $state(false);
  let season = $state<number | null>(null);
  let listStatus = $state<'loading' | 'ok' | 'error'>('loading');
  // '방금 이적' — 첫 페이지 응답에 함께 온 최근 거래. 화면 안에서 한 줄씩 넘기기만 하고 서버는 다시 부르지 않는다.
  let recent = $state<MarketSale[]>([]);
  let tick = $state(0);
  let liveOpen = $state(false);
  const live = $derived(recent.length ? recent[tick % recent.length] : undefined);
  $effect(() => {
    if (view !== 'market' || liveOpen || recent.length < 2) return;
    // 탭이 가려져 있으면 넘기지 않는다.
    const t = setInterval(() => !document.hidden && tick++, MARKET_TICKER_MS);
    return () => clearInterval(t);
  });
  /** 받은 목록(첫 페이지면 그 페이지)을 돌려준다. 못 받으면 null. */
  async function loadList(next = 0): Promise<MarketListing[] | null> {
    if (next === 0) listStatus = 'loading';
    const r = await fetchMarket(sort, filter, next);
    if (!r.ok) {
      listStatus = 'error';
      return null;
    }
    items = next === 0 ? r.data.items : [...items, ...r.data.items];
    // 정렬·포지션을 바꿔도 띠는 이어서 넘긴다(tick을 되돌리지 않는다). 배포 직후 옛 엣지 응답에는 recent가 없다.
    if (next === 0) recent = r.data.recent ?? [];
    page = next;
    hasMore = r.data.hasMore;
    season = r.data.season;
    listStatus = 'ok';
    return r.data.items;
  }
  // 정렬·포지션을 바꾸면 첫 페이지부터 다시 받는다(loadList가 둘을 읽어 의존한다).
  $effect(() => {
    if (view === 'market') void loadList(0);
  });
  // 시장 지수(최근 7일 · 시장 전체). 선수 사기 탭을 처음 볼 때 한 번(1분 메모).
  let indexPoints = $state<MarketChartPoint[]>([]);
  let indexAsked = false;
  $effect(() => {
    if (view !== 'market' || indexAsked) return;
    indexAsked = true;
    void fetchMarketChart('week').then((r) => r.ok && (indexPoints = r.data.points));
  });
  const index = $derived(marketIndex(indexPoints));
  const myListingIds = $derived(new Set(me?.listings.map((l) => l.id) ?? []));

  // 팔기는 지금 가진 모든 시즌 선수(T-11-425), 방출은 시즌을 골라 본다(기본은 지금 시즌).
  let team = $state<OwnerTeamResponse | null>(null);
  let teamSeason = $state<number | undefined>(undefined);
  let teamFailed = $state(false);
  async function loadTeam() {
    const r = await fetchOwnerTeam(view === 'sell' ? undefined : teamSeason);
    teamFailed = !r.ok;
    if (r.ok) team = r.data;
  }
  $effect(() => {
    // 로그인 전이면 내 선수를 묻지 않고 로그인 안내만 보인다(T-11-442).
    if ((view === 'sell' || view === 'release') && !guest) void loadTeam();
  });
  const lineup = $derived(team ? lineupOf(team) : new Set<string>());
  const forSale = $derived(team ? sellCandidates(team.players, lineup) : []);
  const isCurrent = $derived(!!team && team.season === team.current);
  const nameOfPlayer = (p: TeamPlayer) => marketName(p, local);
  const seasonName = $derived(team?.seasons.find((o) => o.id === team?.season)?.name ?? '');

  // 방출 — 고른 선수.
  let picked = $state<ReadonlySet<string>>(new Set());
  const releasable = $derived(team?.players.filter((p) => !releaseLock(p, lineup)) ?? []);
  const pickedPlayers = $derived(releasable.filter((p) => picked.has(p.careerId)));
  const pickedAmount = $derived(me ? releaseAmount(pickedPlayers, me.rules.releaseRate) : 0);
  // T-11-442 서버는 한 번에 RELEASE_MAX명까지 받는다. 전체 선택도 그만큼만 고르고, 더 넣으려 하면 알린다.
  function togglePick(id: string, box: HTMLInputElement) {
    const r = togglePickId(picked, id);
    // 상태가 그대로면 Svelte가 체크를 되돌리지 않으니 직접 푼다.
    if (r.full) return void ((box.checked = false), toast(L.pickLimit({ n: RELEASE_MAX })));
    picked = r.next;
  }
  const allPicked = $derived(allReleasePicked(releasable.length, pickedPlayers.length));
  const pickAll = () => (picked = pickAllIds(releasable, picked));

  // 팔기 — 고른 선수와 판매가(기준가의 %).
  let selling = $state<TeamPlayer | null>(null);
  let pct = $state(100);
  const sellPrice = $derived(selling?.cardValue && me ? priceAtPct(selling.cardValue, pct, me.rules) : 0);
  const quote = $derived(selling?.cardValue && me ? sellQuote(selling.cardValue, sellPrice, me.rules) : null);
  // T-11-442 카드를 고르면 아래 가격 칸이 화면 밖일 수 있어 그 칸이 보이게 내린다(이미 보이면 그대로).
  let priceBox = $state<HTMLElement | null>(null);
  function pickSell(p: TeamPlayer) {
    selling = p;
    pct = 100;
    error = null;
    void flush().then(() => priceBox?.scrollIntoView({ block: 'nearest', behavior: dur(1) ? 'smooth' : 'instant' }));
  }

  // 시트: 영입 · 방출 확인.
  let buying = $state<MarketListing | null>(null);
  let confirmRelease = $state(false);

  function open(v: MarketView) {
    view = v;
    error = null;
    picked = new Set();
    selling = null;
    teamSeason = undefined;
  }
  function closeSheets() {
    buying = null;
    confirmRelease = false;
    error = null;
  }
  async function refresh() {
    await Promise.all([loadMe(), view === 'market' ? loadList(0) : view === 'sell' || view === 'release' ? loadTeam() : null]);
  }
  async function run<T>(send: () => Promise<{ ok: true; data: T } | { ok: false; error: { message: string; reason?: string } }>, done: string) {
    busy = true;
    error = null;
    const sent = buying;
    const r = await send();
    if (!r.ok) {
      // 이미 팔렸거나 가격이 바뀌었으면 목록을 새로 받고, 영입 시트는 새 가격으로 바꾸거나 닫는다(T-11-434).
      // 새 목록을 받는 동안에도 버튼을 막아 낡은 가격으로 다시 보내지 않는다.
      if (isStaleListing(r.error)) await settleStale(sent, r.error);
      else error = r.error.message;
      busy = false;
      return;
    }
    busy = false;
    closeSheets();
    picked = new Set();
    selling = null;
    toast(done);
    await refresh();
  }

  async function settleStale(sent: MarketListing | null, e: { message: string; reason?: string | undefined }) {
    const fresh = await loadList(0);
    // 시트 밖(내 거래 탭의 판매 내리기)이면 오류만 보인다. 그 사이 시트를 닫았거나 다른 매물을 열었으면 시트는 건드리지 않는다.
    if (!sent) return void (error = e.message);
    if (buying?.id !== sent.id) return;
    const next = staleListingNext(sent, e.reason, fresh);
    if ('listing' in next) {
      buying = next.listing;
      error = next.notice;
    } else {
      closeSheets();
      toast(next.toast);
    }
  }

  const asPlayer = (c: MarketCard): TeamPlayer => ({ ...c, roles: null });
</script>

<!-- T-11-356 선수 유형(스피드스터 등) 띠 — 카드 상세의 유형 띠와 같은 이름. 없으면 그리지 않는다. -->
{#snippet styleTag(c: MarketCard)}
  {@const style = cardStyle(c)}
  {#if style}<em class="mk-style" data-card-type={c.type}>{style}</em>{/if}
{/snippet}

<!-- T-11-442 로그인 전 기기 — 팔기 · 내 거래 · 방출은 오류 대신 이 탭에서 할 수 있는 일과 로그인 버튼을 보인다. -->
{#snippet guestPane(v: MarketView)}
  <div class="mk-guest" data-market-guest={v}>
    <p>{marketGuestText(v)}</p>
    <LoginButtons act="market-guest-login" back={{ market: true }} />
  </div>
{/snippet}

{#snippet mini(p: TeamPlayer, name: string, dim = false)}
  <span class="mk-card" class:dim aria-hidden="true">
    <PlayerCard compact mini player={p} {name} rating={p.peak} role={detailPosOf(p)} />
  </span>
{/snippet}

<div class="wrap market">
  <Topbar />

  <section class="mk-hero" aria-label={L.funds} data-market-funds>
    <div class="mk-hero-head">
      <div class="eyebrow">Transfer market</div>
      <h1>{L.title}</h1>
    </div>
    <div class="mk-wallet">
      <div class="mk-wallet-sum">
        <span>{L.funds}</span>
        <b>{me ? fundsText(me.balance) : '–'}</b>
      </div>
      <button class="mk-make" data-act="open-release" aria-pressed={view === 'release'} onclick={() => open('release')}>{L.makeFunds}</button>
    </div>
    {#if me}
      <dl class="mk-hero-stats">
        <div><dt>{L.statClubValue}</dt><dd>{fmtValue(me.clubValue)}</dd></div>
        <div><dt>{L.statBuysToday}</dt><dd>{me.boughtToday}</dd></div>
        <div><dt>{L.statListed}</dt><dd>{me.listings.length}</dd></div>
      </dl>
    {:else if guest}
      <p class="mk-hero-note" data-market-guest-note>{L.guestHero}</p>
    {:else if meFailed}
      <p class="mk-hero-note">{meFailed}</p>
    {/if}
  </section>

  {#if view === 'release'}
    <section class="mk-pane" aria-label={L.releasePane}>
      <div class="mk-pane-head">
        <h2>{L.releasePane}</h2>
        <button class="mk-link" onclick={() => open('market')}>{L.backToMarket}</button>
      </div>
      <p class="muted fs-sm">{L.releaseIntro}</p>
      <div class="mk-chips-row">
        <div class="mk-chips" role="group" aria-label={L.seasonGroup}>
          {#each team?.seasons ?? [] as o (o.id)}
            <button class="mk-chip" aria-pressed={team?.season === o.id} onclick={() => ((teamSeason = o.id), (picked = new Set()))}>{L.seasonChip({ name: o.name })}</button>
          {/each}
        </div>
        {#if releasable.length > 0}<button class="mk-link" data-act="pick-all" onclick={pickAll}>{pickAllLabel(releasable.length, allPicked)}</button>{/if}
      </div>
      {#if guest}
        {@render guestPane('release')}
      {:else if !team}
        {#if teamFailed}<p class="muted">{L.playersFailed}</p>{:else}<Skeleton rows={4} />{/if}
      {:else}
        <ul class="mk-rel-list">
          {#each team.players as p (p.careerId)}
            {@const lock = releaseLock(p, lineup)}
            <li>
              <label class="mk-rel" class:on={picked.has(p.careerId)} class:locked={!!lock} class:unlockable={p.locked && p.raised} data-mine={p.careerId}>
                <input type="checkbox" checked={picked.has(p.careerId)} disabled={!!lock} aria-label={L.releasePickLabel({ name: nameOfPlayer(p) })} onchange={(e) => togglePick(p.careerId, e.currentTarget)} />
                {@render mini(p, nameOfPlayer(p), !!lock)}
                <span class="mk-info">
                  <strong class="mk-name">{nameOfPlayer(p)}</strong>
                  <small class:mk-lock={!!lock}>{lock ?? L.releaseInfo({ score: (p.legendScore ?? 0).toLocaleString(intlLocale()) })}</small>
                </span>
                {#if !lock && me}<b class="mk-rel-value">{fundsText(releaseValue(p, me.rules.releaseRate))}</b>{/if}
              </label>
              {#if p.locked && p.raised}<button class="mk-link mk-unlock" data-act="unlock" data-unlock={p.careerId} disabled={busy} onclick={() => run(() => setCardLock(p.careerId, false), MARKET_TOAST.unlocked)}>{L.playerUnlock}</button>{/if}
            </li>
          {:else}
            <li class="muted">{L.noRetired({ season: seasonName })}</li>
          {/each}
        </ul>
      {/if}
    </section>
    {#if pickedPlayers.length > 0}
      <div class="mk-dock" aria-label={L.dockLabel}>
        <div class="mk-dock-sum"><span>{L.dockSum({ n: pickedPlayers.length })}</span><b>+{fundsText(pickedAmount)}</b></div>
        <p class="mk-warn">{L.dockWarn}</p>
        <button class="btn btn-block mk-danger" data-act="release" onclick={() => ((confirmRelease = true), (error = null))}>{L.releaseBtn({ n: pickedPlayers.length })}</button>
      </div>
    {/if}
  {:else}
    <nav class="mk-tabs" aria-label={L.menu}>
      {#each marketTabs() as [k, label] (k)}
        <button aria-pressed={view === k} data-market-tab={k} onclick={() => open(k)}>{label}</button>
      {/each}
    </nav>

    {#if view === 'market'}
      <section class="mk-pane" aria-label={L.tabBuy}>
        {#if index}
          <div class="mk-index mk-idx-{index.tone}" data-market-index>
            <span class="mk-info">
              <small class="mk-idx-head"><span class="mk-live-dot" aria-hidden="true"></span>{CHART_COPY.index}</small>
              <span class="mk-idx-row"><b>{index.pct}</b><em>{index.change}</em></span>
              <small>{CHART_COPY.indexSub(index.trades)}</small>
              <small class="mk-idx-today" data-market-index-today>{CHART_COPY.lastDay(index.today, index.lastTrades)}</small>
            </span>
            <!-- T-11-474 살아 있는 시세: 면 그라데이션 · 마지막 거래일 맥박 · 아래 거래량 막대 -->
            <span class="mk-spark-wrap" aria-hidden="true">
              <span class="mk-spark-plot">
              <svg class="mk-spark" viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="mk-spark-fill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stop-color="currentColor" stop-opacity="0.3" />
                    <stop offset="1" stop-color="currentColor" stop-opacity="0" />
                  </linearGradient>
                </defs>
                {#if index.spark.area}<path class="mk-spark-area" d={index.spark.area} fill="url(#mk-spark-fill)" />{/if}
                <line x1="0" x2="100" y1={index.spark.base} y2={index.spark.base} />
                <path class="mk-spark-line" d={index.spark.line} pathLength="1" />
              </svg>
              {#if index.spark.last}<span class="mk-spark-pulse" style:left="{index.spark.last.x}%" style:top="{index.spark.last.y}%"></span>{/if}
              </span>
              <span class="mk-spark-vol">
                {#each index.spark.bars as b (b.p.day)}<i style:left="{b.x}%" style:height="{b.h}%"></i>{/each}
              </span>
            </span>
          </div>
        {/if}
        {#if live}
          <div class="mk-live" data-market-live>
            <button class="mk-live-bar" aria-expanded={liveOpen} aria-label={L.liveAll({ n: recent.length })} onclick={() => (liveOpen = !liveOpen)}>
              <span class="mk-live-dot" aria-hidden="true"></span>
              <b>{L.justSold}</b>
              {#key tick}
                <span class="mk-live-line">{saleText(live, local)}</span>
              {/key}
              <small>{agoKo(Date.now() - Date.parse(live.soldAt))}</small>
            </button>
            {#if liveOpen}
              <ul class="mk-live-list">
                {#each recent as s (s.id)}
                  <li>
                    {@render mini(asPlayer(s.card), marketName(s.card, local))}
                    <span class="mk-info">
                      <span class="mk-name">{marketName(s.card, local)}</span>
                      <small>{@render styleTag(s.card)}{L.liveBase({ ago: agoKo(Date.now() - Date.parse(s.soldAt)), value: fmtValue(s.card.cardValue) })}</small>
                    </span>
                    <b>{fmtValue(s.price)}</b>
                  </li>
                {/each}
              </ul>
            {/if}
          </div>
        {/if}
        <div class="mk-chips" role="group" aria-label={L.position}>
          {#each MARKET_POS_FILTERS as p (p ?? 'all')}
            <button class="mk-chip" aria-pressed={filter.pos === p} data-market-pos={p ?? 'all'} onclick={() => pickFilter({ pos: p })}>{p ? tn(POS_LABEL[p]) : L.posAll}</button>
          {/each}
        </div>
        <div class="mk-find" role="group" aria-label={L.findTitle}>
          <button class="mk-chip mk-find-open" data-act="market-find" aria-haspopup="dialog" onclick={() => (finding = true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            {L.findOpen}
          </button>
          {#each findChips as c (c.key)}
            <button class="mk-chip mk-find-chip" aria-pressed="true" aria-label={L.findRemove({ name: c.name })} data-market-find-chip={c.key} onclick={() => pickFilter({ [c.key]: undefined })}>
              {c.name}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          {/each}
        </div>
        {#if filter.pos}
          <div class="mk-subfilters" data-market-subfilters>
            {#if details.length}
              <div class="mk-subrow" role="group" aria-label={L.detailPos}>
                <div class="mk-subhead">
                  <span class="mk-sublabel">{L.detailPos}</span>
                  {#if filter.dpos || filter.type}
                    <button class="mk-reset" data-market-reset onclick={() => (filter = marketSubReset(filter))}>{L.filterReset}</button>
                  {/if}
                </div>
                <div class="mk-subchips">
                  <button class="mk-chip mk-chip-sm" aria-pressed={!filter.dpos} data-market-dpos="all" onclick={() => pickFilter({ dpos: undefined })}>{L.posAll}</button>
                  {#each details as d (d)}
                    <button class="mk-chip mk-chip-sm" aria-pressed={filter.dpos === d} data-market-dpos={d} aria-label={tn(DETAIL_LABEL[d])} title={tn(DETAIL_LABEL[d])} onclick={() => pickFilter({ dpos: d })}>{d}</button>
                  {/each}
                </div>
              </div>
            {/if}
            <div class="mk-subrow" role="group" aria-label={L.playerType}>
              <div class="mk-subhead">
                <span class="mk-sublabel">{L.playerType}</span>
                {#if !details.length && (filter.dpos || filter.type)}
                  <button class="mk-reset" data-market-reset onclick={() => (filter = marketSubReset(filter))}>{L.filterReset}</button>
                {/if}
              </div>
              <div class="mk-subchips">
                <button class="mk-chip mk-chip-sm" aria-pressed={!filter.type} data-market-type="all" onclick={() => pickFilter({ type: undefined })}>{L.posAll}</button>
                {#each types as [id, name] (id)}
                  <button class="mk-chip mk-chip-sm" aria-pressed={filter.type === id} data-market-type={id} onclick={() => pickFilter({ type: id })}>{name}</button>
                {/each}
              </div>
            </div>
          </div>
        {/if}
        <div class="mk-sort">
          <span class="muted fs-sm">{season === null ? '' : L.listCount({ n: items.length, more: hasMore })}</span>
          <label class="fs-sm">{L.sortLabel}
            <select bind:value={sort} data-market-sort>
              {#each Object.entries(MARKET_SORT_LABEL) as [k, label] (k)}<option value={k}>{label}</option>{/each}
            </select>
          </label>
        </div>
        {#if listStatus === 'loading'}
          <Skeleton rows={5} />
        {:else if listStatus === 'error'}
          <p class="muted">{L.listFailed}</p>
          <button class="btn btn-block" onclick={() => loadList(0)}>{L.reload}</button>
        {:else}
          <ul class="mk-rows">
            {#each items as l (l.id)}
              {@const diff = priceDiff(l.price, l.card.cardValue)}
              <li>
                <button class="mk-row" data-listing={l.id} onclick={() => ((buying = l), (error = null))}>
                  {@render mini(asPlayer(l.card), marketName(l.card, local))}
                  <span class="mk-info">
                    <span class="mk-name">{marketName(l.card, local)}{#if myListingIds.has(l.id)}<em class="mk-tag">{L.myListing}</em>{/if}</span>
                    <small>{@render styleTag(l.card)}{cardMeta(l.card, season)}</small>
                    <small class="mk-from" data-listing-from>{cardFrom(l.card)}</small>
                  </span>
                  <span class="mk-price"><b>{fmtValue(l.price)}</b><small class="mk-{diff.tone}">{diff.text}</small></span>
                  {#if l.card.attrs}
                    <span class="mk-attrs" data-listing-attrs>
                      {#each cardAttrStrip(l.card) as a (a.key)}<span class="mk-attr"><small>{a.label}</small><b class="num mk-attr-{a.tone}">{a.value}</b></span>{/each}
                    </span>
                  {/if}
                </button>
              </li>
            {:else}
              <li class="muted">{marketEmptyText(season, marketFiltered(filter))}</li>
            {/each}
          </ul>
          {#if hasMore}<button class="btn btn-block" onclick={() => loadList(page + 1)}>{L.more}</button>{/if}
        {/if}
      </section>
    {:else if view === 'sell'}
      <section class="mk-pane" aria-label={L.tabSell}>
        <h2 class="mk-step">{L.sellStep1}</h2>
        {#if guest}
          {@render guestPane('sell')}
        {:else if !team}
          {#if teamFailed}<p class="muted">{L.playersFailed}</p>{:else}<Skeleton rows={4} />{/if}
        {:else if !isCurrent || team.players.length === 0}
          <p class="muted">{L.sellNone}</p>
        {:else}
          {#if forSale.length < team.players.length}<p class="muted fs-sm" data-sell-starters>{L.sellStartersHidden}</p>{/if}
          <div class="mk-pick-grid">
            {#each forSale as p (p.careerId)}
              {@const note = sellNote(p)}
              {@const off = !sellable(p)}
              <div class="mk-pick-cell">
                <button class="mk-pick" aria-pressed={selling?.careerId === p.careerId} disabled={off} data-sell-pick={p.careerId} onclick={() => pickSell(p)}>
                  {@render mini(p, nameOfPlayer(p), off)}
                  <span class="mk-pick-name">{nameOfPlayer(p)}</span>
                  <small>{selling?.careerId === p.careerId ? L.sellSelected : note}</small>
                </button>
                {#if p.locked}<button class="mk-link" data-act="unlock" data-unlock={p.careerId} disabled={busy} onclick={() => run(() => setCardLock(p.careerId, false), MARKET_TOAST.unlocked)}>{L.playerUnlock}</button>{/if}
              </div>
            {/each}
          </div>
        {/if}
        {#if selling && quote && me}
          {@const diff = priceDiff(sellPrice, selling.cardValue!)}
          {@const range = sellSlider(me.rules)}
          <div class="mk-price-box" bind:this={priceBox}>
            <h2 class="mk-step">{L.sellStep2({ name: nameOfPlayer(selling), pos: detailPosOf(selling), peak: selling.peak })}</h2>
            <div class="mk-presets">
              <button aria-pressed={pct === 100} onclick={() => (pct = 100)}><span>{L.presetBase}</span><b>{fmtValue(selling.cardValue!)}</b></button>
              <button aria-pressed={pct !== 100} onclick={() => (pct = pct === 100 ? 110 : pct)}><span>{L.presetCustom}</span><b>{pct === 100 ? L.presetSlider : fmtValue(sellPrice)}</b></button>
            </div>
            <label class="mk-slider">
              <span class="mk-slider-top"><span>{L.price}</span><b>{fmtValue(sellPrice)} <small class="mk-{diff.tone}">{diff.text}</small></b></span>
              <input type="range" min={range.minPct} max={range.maxPct} step={range.step} bind:value={pct} aria-label={L.sliderLabelWeb} data-sell-pct />
              <span class="mk-slider-ends"><span>{fmtValue(quote.band.min)} ({range.minPct}%)</span><span>{fmtValue(quote.band.max)} ({range.maxPct}%)</span></span>
            </label>
            <dl class="mk-lines">
              <div><dt>{L.fee({ pct: range.feePct })}</dt><dd>−{fmtValue(quote.fee)}</dd></div>
              <div class="strong"><dt>{L.gets}</dt><dd>{fmtValue(quote.gets)}</dd></div>
            </dl>
            <p class="muted fs-sm">{L.sellHelp}</p>
            {#if error}<p class="mk-err" role="alert">{error}</p>{/if}
            <button class="btn btn-primary btn-block" data-act="list" disabled={busy || !!quote.error} onclick={() => run(() => createListing(selling!.careerId, sellPrice), MARKET_TOAST.listed)}>
              {L.listFor({ price: fmtValue(sellPrice) })}
            </button>
          </div>
        {/if}
      </section>
    {:else}
      <section class="mk-pane" aria-label={L.tabTrades}>
        {#if guest}
          {@render guestPane('trades')}
        {:else if !me}
          {#if meFailed}<p class="muted">{meFailed}</p>{:else}<Skeleton rows={4} />{/if}
        {:else}
          <h2 class="mk-step">{L.tradesListed}</h2>
          <ul class="mk-rows">
            {#each me.listings as l (l.id)}
              <li class="mk-row mk-row-static">
                {@render mini(asPlayer(l.card), marketName(l.card, local))}
                <span class="mk-info">
                  <span class="mk-name">{marketName(l.card, local)}</span>
                  <small>{@render styleTag(l.card)}{L.listedAgo({ price: fmtValue(l.price), ago: agoKo(Date.now() - Date.parse(l.createdAt)) })}</small>
                </span>
                <button class="icon-btn" disabled={busy} data-act="cancel-listing" onclick={() => run(() => cancelListing(l.id), MARKET_TOAST.unlisted)}>{L.unlistBtn}</button>
              </li>
            {:else}
              <li class="muted">{L.noListed}</li>
            {/each}
          </ul>
          <!-- T-11-158 자금 내역은 구단주 화면의 구단 자금 내역 한 곳에서 본다(방출 · 거래 · 구단 자금 사용 전부). -->
          <button class="btn btn-sm self-start" data-act="market-funds-history" onclick={() => ((backToTrades = true), go('funds'))}>{F.openAria}</button>
        {/if}
      </section>
    {/if}
  {/if}


</div>

{#if buying && (me || guest)}
  {@const block = !me ? null : myListingIds.has(buying.id) ? L.ownListing : buyBlock(buying.price, me.balance)}
  {@const diff = priceDiff(buying.price, buying.card.cardValue)}
  <button class="mk-scrim" aria-label={L.close} onclick={closeSheets}></button>
  <div class="mk-sheet" role="dialog" aria-modal="true" aria-label={L.sheetBuy}>
    <div class="mk-detail">
      <div class="mk-detail-card">
        <PlayerCard player={asPlayer(buying.card)} name={marketName(buying.card, local)} rating={buying.card.peak} role={detailPosOf(buying.card)} />
      </div>
      <dl class="mk-detail-stats">
        <div><dt>{L.detailLegend}</dt><dd>{buying.card.legendScore.toLocaleString(intlLocale())}</dd></div>
        <div><dt>{L.detailTransfers}</dt><dd>{L.transferTimes({ n: buying.card.transfers })}</dd></div>
        <div><dt>{L.position}</dt><dd>{tn(POS_LABEL[buying.card.pos])}</dd></div>
      </dl>
      <p class="mk-salary" data-market-salary>{TC.salaryLabel} · {marketSalaryText(buying.card, season)}</p>
    </div>
    <div class="mk-confirm">
      <h2>{me ? L.buyTitle : L.loginTitle}</h2>
      <dl class="mk-lines">
        <div><dt>{L.baseLine}</dt><dd>{fmtValue(buying.card.cardValue)}</dd></div>
        <div class="big"><dt>{L.price}</dt><dd>{fmtValue(buying.price)} <small class="mk-{diff.tone}">{diff.text}</small></dd></div>
        {#if me}
          <div class="rule"></div>
          <div><dt>{L.fundsNow}</dt><dd>{fundsText(me.balance)}</dd></div>
          <div class="strong"><dt>{L.fundsAfter}</dt><dd>{me.balance >= buying.price ? fundsText(me.balance - buying.price) : L.notEnough}</dd></div>
        {/if}
      </dl>
      <MarketChart card={buying.card} />
      <p class="mk-note" data-market-login={!me ? '' : undefined}>{me ? L.buyNote : L.loginToBuy}</p>
      {#if block}<p class="mk-err">{block}</p>{/if}
      {#if error}<p class="mk-err" role="alert">{error}</p>{/if}
      <div class="mk-actions">
        <button class="btn" onclick={closeSheets}>{L.close}</button>
        {#if !me}
          <LoginButtons act="market-login" back={{ market: true }} />
        {:else if myListingIds.has(buying.id)}
          <button class="btn" disabled={busy} onclick={() => run(() => cancelListing(buying!.id), MARKET_TOAST.unlisted)}>{L.unlist}</button>
        {:else}
          <button class="btn btn-accent" data-act="buy" disabled={busy || !!block} onclick={() => run(() => buyListing(buying!.id, buying!.price), MARKET_TOAST.bought)}>
            {L.buyFor({ price: fmtValue(buying.price) })}
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

{#if finding}
  <MarketFind {filter} onpick={pickFilter} onclose={() => (finding = false)} />
{/if}

{#if confirmRelease && me}
  <button class="mk-scrim" aria-label={L.close} onclick={closeSheets}></button>
  <div class="mk-sheet mk-confirm" role="dialog" aria-modal="true" aria-label={L.sheetRelease}>
    <h2>{L.sheetRelease}</h2>
    <p>{releaseConfirmText(pickedPlayers.length, pickedAmount)}</p>
    {#if error}<p class="mk-err" role="alert">{error}</p>{/if}
    <div class="mk-actions">
      <button class="btn" onclick={closeSheets}>{L.close}</button>
      <button class="btn mk-danger" data-act="release-confirm" disabled={busy} onclick={() => run(() => releaseCards(pickedPlayers.map((p) => p.careerId)), MARKET_TOAST.released(pickedPlayers.length))}>
        {L.releaseBtn({ n: pickedPlayers.length })}
      </button>
    </div>
  </div>
{/if}

<style>
  .mk-guest {display:flex;flex-direction:column;gap:10px;}
  .mk-guest p {margin:0;}
  .mk-salary {margin:6px 0 0;font-size:12px;font-weight:600;text-align:center;opacity:.85;}
  /* 초록 머리 — 구단 자금 · 자금 만들기 · 요약 셋 */
  .mk-hero {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    border-radius: var(--radius-lg);
    background: var(--pitch);
    color: var(--on-pitch);
  }
  .mk-hero-head h1 {
    margin: 0;
    font-size: var(--fs-title2);
  }
  .mk-hero-head .eyebrow {
    color: var(--on-pitch);
    opacity: 0.75;
  }
  .mk-wallet {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 14px;
    border-radius: var(--radius-md);
    background: rgb(255 255 255 / 0.08);
    border: 1px solid rgb(255 255 255 / 0.16);
  }
  .mk-wallet-sum {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .mk-wallet-sum span {
    font-size: var(--fs-caption);
    opacity: 0.8;
  }
  .mk-wallet-sum b {
    font-family: var(--display);
    font-size: 1.875rem;
    line-height: 1;
    color: var(--pitch-accent);
    overflow-wrap: anywhere;
  }
  .mk-make {
    flex: none;
    min-height: 40px;
    padding: 0 14px;
    border: 0;
    border-radius: var(--radius-pill);
    background: var(--pitch-accent);
    color: var(--accent-ink);
    font: inherit;
    font-size: var(--fs-label);
    font-weight: 700;
    cursor: pointer;
  }
  .mk-hero-stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
    margin: 0;
    text-align: center;
  }
  .mk-hero-stats div {
    padding: 8px 4px;
    border-radius: var(--radius-md);
    background: rgb(255 255 255 / 0.08);
    min-width: 0;
  }
  .mk-hero-stats dt {
    font-size: var(--fs-caption2);
    opacity: 0.8;
  }
  .mk-hero-stats dd {
    margin: 2px 0 0;
    font-family: var(--display);
    font-size: var(--fs-title3);
    font-weight: 700;
    overflow-wrap: anywhere;
  }
  .mk-hero-note {
    margin: 0;
    font-size: var(--fs-label);
    opacity: 0.85;
  }

  /* 밑줄 탭 */
  .mk-tabs {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    margin: 12px 0 0;
    border-radius: var(--radius-md) var(--radius-md) 0 0;
    background: var(--surface);
    border-bottom: 1px solid var(--line);
  }
  .mk-tabs button {
    min-height: 46px;
    border: 0;
    border-bottom: 3px solid transparent;
    background: none;
    color: var(--muted);
    font: inherit;
    font-size: var(--fs-body2);
    cursor: pointer;
  }
  .mk-tabs button[aria-pressed='true'] {
    color: var(--ink);
    font-weight: 700;
    border-bottom-color: var(--accent);
  }
  .mk-pane {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px 0;
  }
  .mk-pane-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-top: 12px;
  }
  .mk-pane-head h2,
  .mk-step {
    margin: 0;
    font-size: var(--fs-body2);
    font-weight: 700;
  }
  .mk-step small {
    color: var(--muted);
    font-weight: 500;
  }
  .mk-pane p {
    margin: 0;
  }
  .mk-link {
    min-height: 34px;
    padding: 0 4px;
    border: 0;
    background: none;
    color: var(--accent-text);
    font: inherit;
    font-size: var(--fs-label);
    font-weight: 600;
    cursor: pointer;
  }

  /* 방금 이적 — 살아 있는 점 + 한 줄씩 넘어가는 최근 거래 */
  .mk-live {
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    background: var(--surface);
    overflow: hidden;
  }
  .mk-live-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-height: 44px;
    padding: 0 12px;
    border: 0;
    background: none;
    color: var(--ink);
    font: inherit;
    font-size: var(--fs-label);
    text-align: left;
    cursor: pointer;
  }
  .mk-live-bar b {
    flex: none;
    color: var(--bad);
    font-size: var(--fs-caption);
  }
  .mk-live-bar small {
    flex: none;
    color: var(--muted);
    font-size: var(--fs-caption2);
  }
  .mk-live-dot {
    flex: none;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--bad);
    animation: mk-pulse 1.6s ease-out infinite;
  }
  .mk-live-line {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    animation: mk-tick 0.35s ease-out;
  }
  @keyframes mk-pulse {
    0% {
      box-shadow: 0 0 0 0 color-mix(in srgb, var(--bad) 55%, transparent);
    }
    100% {
      box-shadow: 0 0 0 8px transparent;
    }
  }
  @keyframes mk-tick {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .mk-live-dot,
    .mk-live-line {
      animation: none;
    }
  }
  .mk-live-list {
    list-style: none;
    margin: 0;
    padding: 0 12px 4px;
    border-top: 1px solid var(--line);
  }
  .mk-live-list li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 0;
    border-bottom: 1px solid var(--line);
  }
  .mk-live-list li:last-child {
    border-bottom: 0;
  }
  .mk-live-list li > b {
    flex: none;
    font-size: var(--fs-body2);
  }

  /* 칩 · 정렬 */
  .mk-chips-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .mk-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    flex: 1;
  }
  .mk-chip {
    min-height: 34px;
    padding: 0 13px;
    border-radius: var(--radius-pill);
    border: 1px solid transparent;
    background: var(--surface);
    color: var(--ink);
    font: inherit;
    font-size: var(--fs-label);
    cursor: pointer;
  }
  .mk-chip[aria-pressed='true'] {
    border-color: var(--ink);
    background: var(--ink);
    color: var(--surface);
    font-weight: 600;
  }
  /* T-11-500 국적 · 팀으로 찾기 — 여는 칩 + 고른 것(지울 수 있는 칩) */
  .mk-find {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .mk-find .mk-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .mk-find-open {
    border-color: var(--accent);
    color: var(--accent-text);
    font-weight: 600;
  }
  .mk-from {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* 세부 포지션 · 유형 — 라벨은 위, 칩은 아래에 줄바꿈으로 놓는다. 선택은 강조색 톤으로 위 포지션 칩과 위계를 나눈다. */
  .mk-subfilters {
    display: grid;
    gap: 12px;
    padding: 12px 0;
    border-radius: var(--radius-md);
    background: var(--surface);
  }
  .mk-subrow {
    display: grid;
    gap: 6px;
    min-width: 0;
  }
  .mk-subhead {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 14px;
  }
  .mk-sublabel {
    color: var(--muted);
    font-size: var(--fs-caption);
    font-weight: 600;
  }
  .mk-subchips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 0 14px;
  }
  .mk-chip-sm {
    flex: none;
    min-height: 30px;
    padding: 0 12px;
    border-color: var(--line);
    background: var(--bg);
    white-space: nowrap;
  }
  .mk-chip-sm[aria-pressed='true'] {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 18%, var(--surface));
    color: var(--accent-text);
  }
  .mk-reset {
    border: 0;
    padding: 0;
    background: none;
    color: var(--muted);
    font: inherit;
    font-size: var(--fs-caption);
    text-decoration: underline;
    cursor: pointer;
  }
  .mk-sort {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .mk-sort label {
    flex: none;
    white-space: nowrap;
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--muted);
  }
  .mk-sort select {
    font: inherit;
    color: var(--ink);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface);
    padding: 4px 6px;
  }

  /* 목록·고르기 카드 — 진짜 PlayerCard의 compact·mini판(OVR·자리·시즌·국기·등번호). 판 폭은 pitch 슬롯과 같은 64px */
  .mk-card {
    flex: none;
    display: block;
    width: 64px;
  }
  .mk-card.dim {
    opacity: 0.45;
  }

  /* 목록 줄 */
  .mk-rows,
  .mk-rel-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .mk-row {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 10px 12px;
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    background: var(--surface);
    color: inherit;
    font: inherit;
    text-align: left;
  }
  button.mk-row {
    cursor: pointer;
  }
  /* T-11-477 매물 줄 아래 능력치 6개 — 줄을 내려 카드 · 이름 · 가격 아래에 칸을 고르게 나눈다. */
  .mk-row:has(.mk-attrs) {
    flex-wrap: wrap;
  }
  .mk-attrs {
    flex-basis: 100%;
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 4px;
    padding-top: 8px;
    border-top: 1px solid var(--line);
  }
  .mk-attr {
    display: grid;
    justify-items: center;
    gap: 1px;
    min-width: 0;
  }
  .mk-attr small {
    max-width: 100%;
    overflow: hidden;
    color: var(--muted);
    font-size: var(--fs-caption2);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .mk-attr b {
    font-size: var(--fs-body2);
  }
  .mk-attr-hi {
    color: var(--accent-text);
  }
  .mk-attr-lo {
    color: var(--muted);
    font-weight: 500;
  }
  .mk-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }
  .mk-info small {
    font-size: var(--fs-caption);
    color: var(--muted);
  }
  .mk-name {
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .mk-style {
    margin-right: 6px;
    padding: 0 6px;
    border: 1px solid var(--line);
    border-radius: var(--radius-pill);
    color: var(--ink);
    font-style: normal;
    font-weight: 700;
  }
  .mk-tag {
    margin-left: 6px;
    padding: 1px 6px;
    border-radius: var(--radius-pill);
    background: var(--surface-2);
    color: var(--muted);
    font-size: var(--fs-caption2);
    font-style: normal;
    font-weight: 700;
  }
  .mk-price {
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
  }
  .mk-price b {
    font-family: var(--display);
    font-size: var(--fs-title2);
    line-height: 1.1;
  }
  .mk-price small,
  .mk-slider small,
  .mk-lines small {
    font-size: var(--fs-caption2);
    font-weight: 600;
  }
  /* 시장 지수 한 줄(T-11-080f). 국내 증권 관례대로 오름 빨강 · 내림 파랑. */
  .mk-index {
    --tone: var(--muted);
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    margin-bottom: 10px;
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    background: var(--surface);
  }
  .mk-idx-up {
    --tone: var(--up);
  }
  .mk-idx-down {
    --tone: var(--down);
  }
  .mk-index b {
    font-family: var(--display);
    font-size: var(--fs-title2);
    line-height: 1.1;
  }
  .mk-index small {
    color: var(--muted);
    font-size: var(--fs-caption2);
  }
  .mk-index em {
    font-style: normal;
    font-weight: 700;
    font-size: var(--fs-caption);
    color: var(--tone);
    white-space: nowrap;
  }
  .mk-index .mk-info {
    gap: 1px;
  }
  .mk-idx-head {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .mk-idx-row {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  .mk-idx-today {
    color: var(--ink) !important;
    font-weight: 600;
  }
  .mk-spark-wrap {
    display: grid;
    gap: 3px;
    width: 128px;
    flex: none;
    color: var(--tone);
  }
  .mk-spark-plot {
    position: relative;
    height: 44px;
  }
  .mk-spark {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  .mk-spark-line {
    fill: none;
    stroke: var(--tone);
    stroke-width: 2;
    vector-effect: non-scaling-stroke;
    stroke-linejoin: round;
    stroke-dasharray: 1;
    animation: mk-draw 1s ease-out;
  }
  @keyframes mk-draw {
    from {
      stroke-dashoffset: 1;
    }
  }
  .mk-spark-pulse {
    position: absolute;
    width: 8px;
    height: 8px;
    margin: -4px 0 0 -4px;
    border-radius: 50%;
    background: var(--tone);
    box-shadow: 0 0 0 2px var(--surface);
  }
  .mk-spark-pulse::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: var(--tone);
    animation: mk-ping 1.8s ease-out infinite;
  }
  @keyframes mk-ping {
    from {
      transform: scale(1);
      opacity: 0.55;
    }
    to {
      transform: scale(3.2);
      opacity: 0;
    }
  }
  .mk-spark-vol {
    position: relative;
    height: 11px;
  }
  .mk-spark-vol i {
    position: absolute;
    bottom: 0;
    width: 4px;
    margin-left: -2px;
    border-radius: 1px 1px 0 0;
    background: var(--tone);
    opacity: 0.35;
  }
  @media (prefers-reduced-motion: reduce) {
    .mk-spark-line,
    .mk-spark-pulse::after {
      animation: none;
    }
  }
  .mk-spark line {
    stroke: var(--muted);
    stroke-dasharray: 3 3;
    vector-effect: non-scaling-stroke;
  }
  .mk-up {
    color: var(--warn);
  }
  .mk-down {
    color: var(--good);
  }
  .mk-same {
    color: var(--muted);
  }

  /* 팔기 — 카드 고르기 + 가격 */
  .mk-pick-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
  }
  .mk-pick-cell {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 2px;
    min-width: 0;
  }
  .mk-pick-cell .mk-link {
    min-height: 32px;
    font-size: var(--fs-caption);
  }
  .mk-pick {
    min-height: 104px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    padding: 6px 4px;
    border-radius: var(--radius-md);
    border: 1px solid transparent;
    background: var(--surface);
    color: var(--ink);
    font: inherit;
    cursor: pointer;
    min-width: 0;
  }
  .mk-pick[aria-pressed='true'] {
    border: 2px solid var(--accent);
    background: color-mix(in srgb, var(--accent) 10%, var(--surface));
  }
  .mk-pick:disabled {
    cursor: default;
  }
  .mk-pick-name {
    max-width: 100%;
    font-size: var(--fs-caption2);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .mk-pick small {
    min-height: 13px;
    font-size: var(--fs-caption2);
    font-weight: 600;
    color: var(--muted);
  }
  .mk-pick[aria-pressed='true'] small {
    color: var(--accent-text);
  }
  .mk-price-box {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px;
    border: 1px solid transparent;
    border-radius: var(--radius-lg);
    background: var(--surface);
  }
  .mk-presets {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .mk-presets button {
    min-height: 56px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    border-radius: var(--radius-md);
    border: 1px solid transparent;
    background: var(--surface-2);
    color: var(--ink);
    font: inherit;
    cursor: pointer;
  }
  .mk-presets button[aria-pressed='true'] {
    border: 2px solid var(--accent);
    background: color-mix(in srgb, var(--accent) 10%, var(--surface));
  }
  .mk-presets span {
    font-size: var(--fs-caption);
    color: var(--muted);
  }
  .mk-presets b {
    font-size: var(--fs-body2);
  }
  .mk-slider {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: var(--fs-label);
  }
  .mk-slider-top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }
  .mk-slider-top b {
    font-family: var(--display);
    font-size: var(--fs-title2);
  }
  .mk-slider input {
    width: 100%;
    height: 28px;
    margin: 0;
    accent-color: var(--accent);
  }
  .mk-slider-ends {
    display: flex;
    justify-content: space-between;
    font-size: var(--fs-caption2);
    color: var(--muted);
  }
  .mk-lines {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0;
    font-size: var(--fs-body2);
  }
  .mk-lines div {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
  }
  .mk-lines dt {
    color: var(--muted);
  }
  .mk-lines dd {
    margin: 0;
    font-variant-numeric: tabular-nums;
  }
  .mk-lines .strong {
    font-weight: 700;
  }
  .mk-lines .strong dt {
    color: var(--ink);
  }
  .mk-lines .big dd {
    font-family: var(--display);
    font-size: var(--fs-title1);
    font-weight: 700;
  }
  .mk-lines .rule {
    height: 1px;
    background: var(--line);
  }
  .mk-price-box .mk-lines {
    padding-top: 10px;
    border-top: 1px solid var(--line);
  }

  /* 방출 */
  .mk-rel-list li:has(.mk-unlock) {
    position: relative;
  }
  .mk-rel.unlockable {
    padding-right: 92px;
  }
  .mk-unlock {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
  }
  .mk-rel {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 64px;
    padding: 6px 12px;
    border-radius: var(--radius-md);
    border: 1px solid transparent;
    background: var(--surface);
    cursor: pointer;
  }
  .mk-rel.on {
    border-color: color-mix(in srgb, var(--bad) 35%, var(--line));
    background: color-mix(in srgb, var(--bad) 7%, var(--surface));
  }
  .mk-rel.locked {
    cursor: default;
  }
  .mk-rel input {
    flex: none;
    width: 20px;
    height: 20px;
    margin: 0;
    accent-color: var(--bad);
  }
  .mk-lock {
    color: var(--bad) !important;
  }
  .mk-rel-value {
    flex: none;
    font-size: var(--fs-body2);
    white-space: nowrap;
  }
  .mk-dock {
    position: sticky;
    bottom: calc(var(--tabbar-h) + var(--safe-b) + 8px);
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px 16px;
    border: 1px solid transparent;
    border-radius: var(--radius-lg);
    background: var(--surface);
    box-shadow: var(--shadow);
  }
  .mk-dock-sum {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
    font-size: var(--fs-body2);
  }
  .mk-dock-sum b {
    font-family: var(--display);
    font-size: var(--fs-title1);
    color: var(--accent-text);
  }
  .mk-warn {
    margin: 0;
    font-size: var(--fs-caption);
    color: var(--bad);
  }
  .mk-danger {
    border: 0;
    background: var(--bad);
    color: #fff;
  }

  /* 내 거래 */
  .mk-row-static .icon-btn {
    flex: none;
  }

  /* 시트 — 영입(카드 상세 + 확인) · 방출 확인 */
  .mk-scrim {
    position: fixed;
    inset: 0;
    z-index: 60;
    border: 0;
    padding: 0;
    background: rgb(0 0 0 / 0.45);
  }
  .mk-sheet {
    position: fixed;
    z-index: 61;
    left: 50%;
    bottom: 0;
    transform: translateX(-50%);
    width: min(100%, 560px);
    max-height: 92vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    background: var(--surface);
    color: var(--ink);
    box-shadow: var(--shadow);
  }
  .mk-detail {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 20px 16px 16px;
    background: var(--pitch);
    color: var(--on-pitch);
  }
  .mk-detail-card {
    /* 라커룸 카드와 같은 폭(.locker-player max-width) */
    width: 170px;
  }
  .mk-detail-stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    width: 100%;
    margin: 0;
    text-align: center;
  }
  .mk-detail-stats div {
    padding: 8px 4px;
    border-radius: var(--radius-md);
    background: rgb(255 255 255 / 0.08);
  }
  .mk-detail-stats dt {
    font-size: var(--fs-caption2);
    opacity: 0.8;
  }
  .mk-detail-stats dd {
    margin: 2px 0 0;
    font-size: var(--fs-label);
    font-weight: 600;
  }
  .mk-confirm {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px 20px calc(16px + var(--safe-b));
  }
  .mk-confirm h2 {
    margin: 0;
    font-size: var(--fs-title3);
  }
  .mk-confirm p {
    margin: 0;
  }
  .mk-note {
    padding: 10px 12px;
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    color: var(--muted);
    font-size: var(--fs-caption);
    line-height: 1.5;
  }
  .mk-actions {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: 8px;
  }
  .mk-actions .btn {
    min-height: 50px;
  }
  .mk-err {
    color: var(--bad);
    font-weight: 600;
  }
</style>
