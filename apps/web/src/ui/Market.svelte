<script lang="ts">
  import { intlLocale } from '@offside/contracts/i18n';
  import { tn } from '@offside/game/i18n/names';
  // T-11-080 이적시장 — 지금 시즌 은퇴 선수 카드를 구단 자금으로 사고판다. 구단주 화면의 '이적시장'으로 연다.
  // T-11-080d 시안(이적시장 모바일 시안)대로: 초록 머리에 구단 자금과 '자금 만들기', 탭 셋(선수 사기 · 팔기 · 내 거래),
  // 카드 모양 목록, 카드 상세 영입 시트, 카드 고르기 + 슬라이더 판매, 방출 화면. 각 화면은 처음 열 때만 불러온다.
  import type { CareerPos } from '@offside/contracts';
  import {
    buyListing,
    cancelListing,
    createListing,
    fetchMarket,
    fetchMarketChart,
    fetchMarketMe,
    releaseCards,
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
    MARKET_SORT_LABEL,
    MARKET_TICKER_MS,
    MARKET_TOAST,
    marketTabs,
    TRADE_LABEL,
    buyBlock,
    cardMeta,
    fundsText,
    lineupOf,
    marketEmptyText,
    marketName,
    priceAtPct,
    priceDiff,
    releaseAmount,
    releaseConfirmText,
    releaseLock,
    releaseValue,
    saleText,
    sellNote,
    sellSlider,
    sellable,
    sellQuote,
    tradeAmount,
    type MarketView,
  } from '@offside/app-core/market';
  import { agoKo, cardTier, fmtValue } from '@offside/app-core/format';
  import { localCareerNames } from '@offside/game/hof-store';
  import { POS_LABEL } from '@offside/game/pos-label';
  import { detailPosOf, type DetailPos } from '@offside/contracts/positions';
  import Topbar from './Topbar.svelte';
  import BackBar from './BackBar.svelte';
  import PlayerCard from './team/PlayerCard.svelte';
  import MarketChart from './MarketChart.svelte';
  import { CHART_COPY, marketIndex } from '@offside/app-core/marketChart';
  import { go } from './nav.js';
  import { toast } from './helpers.js';
  import { marketText as L } from '@offside/app-core/i18n/ko/market';

  const local = localCareerNames();
  let view = $state<MarketView>('market');
  let error = $state<string | null>(null);
  let busy = $state(false);

  // 자금 · 구단 가치 · 내 등록 · 최근 거래(1분 메모). 쓰기가 성공하면 apiFetch가 메모를 비우니 다시 받는다.
  let me = $state<MarketMeResponse | null>(null);
  let meFailed = $state<string | null>(null);
  async function loadMe() {
    const r = await fetchMarketMe();
    meFailed = r.ok ? null : r.error.message;
    if (r.ok) me = r.data;
  }
  void loadMe();

  // 선수 사기 — 정렬·포지션이 바뀌면 첫 페이지부터.
  let sort = $state<MarketSort>('new');
  let pos = $state<CareerPos | undefined>(undefined);
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
  async function loadList(next = 0) {
    if (next === 0) listStatus = 'loading';
    const r = await fetchMarket(sort, pos, next);
    if (!r.ok) return void (listStatus = 'error');
    items = next === 0 ? r.data.items : [...items, ...r.data.items];
    // 정렬·포지션을 바꿔도 띠는 이어서 넘긴다(tick을 되돌리지 않는다). 배포 직후 옛 엣지 응답에는 recent가 없다.
    if (next === 0) recent = r.data.recent ?? [];
    page = next;
    hasMore = r.data.hasMore;
    season = r.data.season;
    listStatus = 'ok';
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

  // 팔기는 지금 시즌 선수, 방출은 시즌을 골라 본다(기본은 지금 시즌).
  let team = $state<OwnerTeamResponse | null>(null);
  let teamSeason = $state<number | undefined>(undefined);
  let teamFailed = $state(false);
  async function loadTeam() {
    const r = await fetchOwnerTeam(view === 'sell' ? undefined : teamSeason);
    teamFailed = !r.ok;
    if (r.ok) team = r.data;
  }
  $effect(() => {
    if (view === 'sell' || view === 'release') void loadTeam();
  });
  const lineup = $derived(team ? lineupOf(team) : new Set<string>());
  const isCurrent = $derived(!!team && team.season === team.current);
  const nameOfPlayer = (p: TeamPlayer) => marketName(p, local);
  const seasonName = $derived(team?.seasons.find((o) => o.id === team?.season)?.name ?? '');

  // 방출 — 고른 선수.
  let picked = $state<ReadonlySet<string>>(new Set());
  const releasable = $derived(team?.players.filter((p) => !releaseLock(p, lineup)) ?? []);
  const pickedPlayers = $derived(releasable.filter((p) => picked.has(p.careerId)));
  const pickedAmount = $derived(me ? releaseAmount(pickedPlayers, me.rules.releaseRate) : 0);
  function togglePick(id: string) {
    picked = picked.has(id) ? new Set([...picked].filter((x) => x !== id)) : new Set([...picked, id]);
  }
  const allPicked = $derived(releasable.length > 0 && pickedPlayers.length === releasable.length);
  const pickAll = () => (picked = allPicked ? new Set() : new Set(releasable.map((p) => p.careerId)));

  // 팔기 — 고른 선수와 판매가(기준가의 %).
  let selling = $state<TeamPlayer | null>(null);
  let pct = $state(100);
  const sellPrice = $derived(selling?.cardValue && me ? priceAtPct(selling.cardValue, pct, me.rules) : 0);
  const quote = $derived(selling?.cardValue && me ? sellQuote(selling.cardValue, sellPrice, me.rules) : null);
  function pickSell(p: TeamPlayer) {
    selling = p;
    pct = 100;
    error = null;
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
    const r = await send();
    busy = false;
    if (!r.ok) {
      error = r.error.message;
      // 이미 팔렸거나 가격이 바뀌었으면 목록을 새로 받는다.
      if (isStaleListing(r.error)) void loadList(0);
      return;
    }
    closeSheets();
    picked = new Set();
    selling = null;
    toast(done);
    await refresh();
  }

  const asPlayer = (c: MarketCard): TeamPlayer => ({ ...c, roles: null });
</script>

{#snippet mini(c: { peak: number; legendScore: number | null; dpos: DetailPos | null; pos: CareerPos }, dim = false)}
  <span class="mk-mini" data-tier={cardTier(c.legendScore, c.peak)} class:dim aria-hidden="true">
    <b>{c.peak}</b><small>{detailPosOf(c)}</small>
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
        <div><dt>{L.statBuysToday}</dt><dd>{me.rules.dailyBuys - me.buysLeft} / {me.rules.dailyBuys}</dd></div>
        <div><dt>{L.statListed}</dt><dd>{me.listings.length} / {me.rules.listLimit}</dd></div>
      </dl>
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
        {#if releasable.length > 0}<button class="mk-link" data-act="pick-all" onclick={pickAll}>{allPicked ? L.pickNone : L.pickAll}</button>{/if}
      </div>
      {#if !team}
        <p class="muted">{teamFailed ? L.playersFailed : L.loading}</p>
      {:else}
        <ul class="mk-rel-list">
          {#each team.players as p (p.careerId)}
            {@const lock = releaseLock(p, lineup)}
            <li>
              <label class="mk-rel" class:on={picked.has(p.careerId)} class:locked={!!lock} data-mine={p.careerId}>
                <input type="checkbox" checked={picked.has(p.careerId)} disabled={!!lock} aria-label={L.releasePickLabel({ name: nameOfPlayer(p) })} onchange={() => togglePick(p.careerId)} />
                {@render mini(p, !!lock)}
                <span class="mk-info">
                  <strong class="mk-name">{nameOfPlayer(p)}</strong>
                  <small class:mk-lock={!!lock}>{lock ?? L.releaseInfo({ score: (p.legendScore ?? 0).toLocaleString(intlLocale()) })}</small>
                </span>
                {#if !lock && me}<b class="mk-rel-value">{fundsText(releaseValue(p, me.rules.releaseRate))}</b>{/if}
              </label>
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
              <small>{CHART_COPY.index}</small>
              <b>{index.pct}</b>
              <small>{CHART_COPY.indexSub(index.trades)}</small>
            </span>
              <svg class="mk-spark" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <line x1="0" x2="100" y1={index.spark.base} y2={index.spark.base} />
                <path d={index.spark.line} />
              </svg>
            <em>{index.change}</em>
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
                    {@render mini(s.card)}
                    <span class="mk-info">
                      <span class="mk-name">{marketName(s.card, local)}</span>
                      <small>{L.liveBase({ ago: agoKo(Date.now() - Date.parse(s.soldAt)), value: fmtValue(s.card.cardValue) })}</small>
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
            <button class="mk-chip" aria-pressed={pos === p} data-market-pos={p ?? 'all'} onclick={() => (pos = p)}>{p ? tn(POS_LABEL[p]) : L.posAll}</button>
          {/each}
        </div>
        <div class="mk-sort">
          <span class="muted fs-sm">{season === null ? '' : L.seasonCount({ n: items.length, more: hasMore })}</span>
          <label class="fs-sm">{L.sortLabel}
            <select bind:value={sort} data-market-sort>
              {#each Object.entries(MARKET_SORT_LABEL) as [k, label] (k)}<option value={k}>{label}</option>{/each}
            </select>
          </label>
        </div>
        {#if listStatus === 'loading'}
          <p class="muted">{L.loading}</p>
        {:else if listStatus === 'error'}
          <p class="muted">{L.listFailed}</p>
          <button class="btn btn-block" onclick={() => loadList(0)}>{L.reload}</button>
        {:else}
          <ul class="mk-rows">
            {#each items as l (l.id)}
              {@const diff = priceDiff(l.price, l.card.cardValue)}
              <li>
                <button class="mk-row" data-listing={l.id} onclick={() => ((buying = l), (error = null))}>
                  {@render mini(l.card)}
                  <span class="mk-info">
                    <span class="mk-name">{marketName(l.card, local)}{#if myListingIds.has(l.id)}<em class="mk-tag">{L.myListing}</em>{/if}</span>
                    <small>{cardMeta(l.card)}</small>
                  </span>
                  <span class="mk-price"><b>{fmtValue(l.price)}</b><small class="mk-{diff.tone}">{diff.text}</small></span>
                </button>
              </li>
            {:else}
              <li class="muted">{marketEmptyText(season, !!pos)}</li>
            {/each}
          </ul>
          {#if hasMore}<button class="btn btn-block" onclick={() => loadList(page + 1)}>{L.more}</button>{/if}
        {/if}
      </section>
    {:else if view === 'sell'}
      <section class="mk-pane" aria-label={L.tabSell}>
        <h2 class="mk-step">{L.sellStep1} <small>{L.sellSeasonOnly({ season: seasonName || L.thisSeason })}</small></h2>
        {#if !team}
          <p class="muted">{teamFailed ? L.playersFailed : L.loading}</p>
        {:else if !isCurrent || team.players.length === 0}
          <p class="muted">{L.sellNone}</p>
        {:else}
          <div class="mk-pick-grid">
            {#each team.players as p (p.careerId)}
              {@const note = sellNote(p, lineup)}
              {@const off = !sellable(p)}
              <button class="mk-pick" aria-pressed={selling?.careerId === p.careerId} disabled={off} data-sell-pick={p.careerId} onclick={() => pickSell(p)}>
                {@render mini(p, off)}
                <span class="mk-pick-name">{nameOfPlayer(p)}</span>
                <small>{selling?.careerId === p.careerId ? L.sellSelected : note}</small>
              </button>
            {/each}
          </div>
        {/if}
        {#if selling && quote && me}
          {@const diff = priceDiff(sellPrice, selling.cardValue!)}
          {@const range = sellSlider(me.rules)}
          <div class="mk-price-box">
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
        {#if !me}
          <p class="muted">{meFailed ?? L.loading}</p>
        {:else}
          <h2 class="mk-step">{L.tradesListed}</h2>
          <ul class="mk-rows">
            {#each me.listings as l (l.id)}
              <li class="mk-row mk-row-static">
                {@render mini(l.card)}
                <span class="mk-info">
                  <span class="mk-name">{marketName(l.card, local)}</span>
                  <small>{L.listedAgo({ price: fmtValue(l.price), ago: agoKo(Date.now() - Date.parse(l.createdAt)) })}</small>
                </span>
                <button class="icon-btn" disabled={busy} data-act="cancel-listing" onclick={() => run(() => cancelListing(l.id), MARKET_TOAST.unlisted)}>{L.unlistBtn}</button>
              </li>
            {:else}
              <li class="muted">{L.noListed}</li>
            {/each}
          </ul>
          <h2 class="mk-step">{L.fundsLog}</h2>
          <ul class="mk-log">
            {#each me.trades as t (t.id)}
              <li data-trade={t.kind}>
                <span class="mk-badge mk-badge-{t.kind}">{TRADE_LABEL[t.kind]}</span>
                <span class="mk-info">
                  <span>{marketName(t.card, local)} {tn(POS_LABEL[t.card.pos])} {t.card.peak}</span>
                  <small>{agoKo(Date.now() - Date.parse(t.at))}{t.kind === 'sold' ? L.feeTaken : ''}</small>
                </span>
                <b class:mk-plus={t.kind !== 'bought'}>{tradeAmount(t)}</b>
              </li>
            {:else}
              <li class="muted">{L.noTrades}</li>
            {/each}
          </ul>
        {/if}
      </section>
    {/if}
  {/if}

  <BackBar act="owner" fallback={() => go('owner')} />
</div>

{#if buying && me}
  {@const block = myListingIds.has(buying.id) ? L.ownListing : buyBlock(buying.price, me.balance, me.buysLeft)}
  {@const diff = priceDiff(buying.price, buying.card.cardValue)}
  <button class="mk-scrim" aria-label={L.close} onclick={closeSheets}></button>
  <div class="mk-sheet" role="dialog" aria-modal="true" aria-label={L.sheetBuy}>
    <div class="mk-detail">
      <div class="mk-detail-card">
        <PlayerCard player={asPlayer(buying.card)} name={marketName(buying.card, local)} rating={buying.card.peak} role={detailPosOf(buying.card)} nation={buying.card.nation} />
      </div>
      <dl class="mk-detail-stats">
        <div><dt>{L.detailLegend}</dt><dd>{buying.card.legendScore.toLocaleString(intlLocale())}</dd></div>
        <div><dt>{L.detailTransfers}</dt><dd>{L.transferTimes({ n: buying.card.transfers })}</dd></div>
        <div><dt>{L.position}</dt><dd>{tn(POS_LABEL[buying.card.pos])}</dd></div>
      </dl>
    </div>
    <div class="mk-confirm">
      <h2>{L.buyTitle}</h2>
      <dl class="mk-lines">
        <div><dt>{L.baseLine}</dt><dd>{fmtValue(buying.card.cardValue)}</dd></div>
        <div class="big"><dt>{L.price}</dt><dd>{fmtValue(buying.price)} <small class="mk-{diff.tone}">{diff.text}</small></dd></div>
        <div class="rule"></div>
        <div><dt>{L.fundsNow}</dt><dd>{fundsText(me.balance)}</dd></div>
        <div class="strong"><dt>{L.fundsAfter}</dt><dd>{me.balance >= buying.price ? fundsText(me.balance - buying.price) : L.notEnough}</dd></div>
      </dl>
      <MarketChart card={buying.card} />
      <p class="mk-note">{L.buyNote}</p>
      {#if block}<p class="mk-err">{block}</p>{/if}
      {#if error}<p class="mk-err" role="alert">{error}</p>{/if}
      <div class="mk-actions">
        <button class="btn" onclick={closeSheets}>{L.close}</button>
        {#if myListingIds.has(buying.id)}
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
  /* 초록 머리 — 구단 자금 · 자금 만들기 · 요약 셋 */
  .mk-hero {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    border-radius: 18px;
    background: var(--pitch);
    color: var(--on-pitch);
  }
  .mk-hero-head h1 {
    margin: 0;
    font-size: 1.375rem;
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
    border-radius: 14px;
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
    font-size: 0.75rem;
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
    border-radius: 999px;
    background: var(--pitch-accent);
    color: var(--accent-ink);
    font: inherit;
    font-size: 0.8125rem;
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
    border-radius: 12px;
    background: rgb(255 255 255 / 0.08);
    min-width: 0;
  }
  .mk-hero-stats dt {
    font-size: 0.6875rem;
    opacity: 0.8;
  }
  .mk-hero-stats dd {
    margin: 2px 0 0;
    font-family: var(--display);
    font-size: 1.125rem;
    font-weight: 700;
    overflow-wrap: anywhere;
  }
  .mk-hero-note {
    margin: 0;
    font-size: 0.8125rem;
    opacity: 0.85;
  }

  /* 밑줄 탭 */
  .mk-tabs {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    margin: 12px 0 0;
    border-radius: 14px 14px 0 0;
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
    font-size: 0.875rem;
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
    font-size: 0.875rem;
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
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
  }

  /* 방금 이적 — 살아 있는 점 + 한 줄씩 넘어가는 최근 거래 */
  .mk-live {
    border: 1px solid var(--line);
    border-radius: 14px;
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
    font-size: 0.8125rem;
    text-align: left;
    cursor: pointer;
  }
  .mk-live-bar b {
    flex: none;
    color: var(--bad);
    font-size: 0.75rem;
  }
  .mk-live-bar small {
    flex: none;
    color: var(--muted);
    font-size: 0.6875rem;
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
  .mk-live-list .mk-mini {
    width: 34px;
    height: 40px;
  }
  .mk-live-list .mk-mini b {
    font-size: 1rem;
  }
  .mk-live-list li > b {
    flex: none;
    font-size: 0.875rem;
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
    border-radius: 999px;
    border: 1px solid var(--line);
    background: var(--surface);
    color: var(--ink);
    font: inherit;
    font-size: 0.8125rem;
    cursor: pointer;
  }
  .mk-chip[aria-pressed='true'] {
    border-color: var(--ink);
    background: var(--ink);
    color: var(--surface);
    font-weight: 600;
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
    border-radius: 8px;
    background: var(--surface);
    padding: 4px 6px;
  }

  /* 작은 방패 카드(OVR · 세부 포지션) — 카드 색은 PlayerCard와 같은 등급 */
  .mk-mini {
    --mk-a: #e8d5a8;
    --mk-b: #8a6324;
    --mk-ink: #392b14;
    flex: none;
    width: 52px;
    height: 60px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    background: linear-gradient(165deg, var(--mk-a), var(--mk-b));
    color: var(--mk-ink);
    clip-path: polygon(0 9%, 16% 9%, 25% 2%, 50% 0, 75% 2%, 84% 9%, 100% 9%, 98% 84%, 86% 93%, 50% 100%, 14% 93%, 2% 84%);
  }
  .mk-mini[data-tier='legend'] {
    --mk-a: #28382e;
    --mk-b: #101e17;
    --mk-ink: #fce7b1;
  }
  .mk-mini[data-tier='silver'] {
    --mk-a: #d6dfe0;
    --mk-b: #83989c;
    --mk-ink: #243339;
  }
  .mk-mini.dim {
    opacity: 0.45;
  }
  .mk-mini b {
    font-family: var(--display);
    font-size: 1.375rem;
    line-height: 1;
    font-weight: 800;
  }
  .mk-mini small {
    font-family: var(--display);
    font-size: 0.6875rem;
    font-weight: 700;
  }

  /* 목록 줄 */
  .mk-rows,
  .mk-rel-list,
  .mk-log {
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
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--surface);
    color: inherit;
    font: inherit;
    text-align: left;
  }
  button.mk-row {
    cursor: pointer;
  }
  .mk-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }
  .mk-info small {
    font-size: 0.75rem;
    color: var(--muted);
  }
  .mk-name {
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .mk-tag {
    margin-left: 6px;
    padding: 1px 6px;
    border-radius: 999px;
    background: var(--surface-2);
    color: var(--muted);
    font-size: 0.6875rem;
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
    font-size: 1.1875rem;
    line-height: 1.1;
  }
  .mk-price small,
  .mk-slider small,
  .mk-lines small {
    font-size: 0.6875rem;
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
    border: 1px solid var(--line);
    border-radius: 12px;
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
    font-size: 1.375rem;
    line-height: 1.1;
  }
  .mk-index small {
    color: var(--muted);
    font-size: 0.6875rem;
  }
  .mk-index em {
    font-style: normal;
    font-weight: 700;
    font-size: 0.75rem;
    color: var(--tone);
    white-space: nowrap;
  }
  .mk-spark {
    width: 72px;
    height: 32px;
    flex: none;
    overflow: visible;
  }
  .mk-spark path {
    fill: none;
    stroke: var(--tone);
    stroke-width: 2;
    vector-effect: non-scaling-stroke;
    stroke-linejoin: round;
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
  .mk-pick {
    min-height: 104px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    padding: 6px 4px;
    border-radius: 12px;
    border: 1px solid var(--line);
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
    font-size: 0.6875rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .mk-pick small {
    min-height: 13px;
    font-size: 0.625rem;
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
    border: 1px solid var(--line);
    border-radius: 16px;
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
    border-radius: 12px;
    border: 1px solid var(--line);
    background: var(--surface);
    color: var(--ink);
    font: inherit;
    cursor: pointer;
  }
  .mk-presets button[aria-pressed='true'] {
    border: 2px solid var(--accent);
    background: color-mix(in srgb, var(--accent) 10%, var(--surface));
  }
  .mk-presets span {
    font-size: 0.75rem;
    color: var(--muted);
  }
  .mk-presets b {
    font-size: 0.875rem;
  }
  .mk-slider {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 0.8125rem;
  }
  .mk-slider-top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }
  .mk-slider-top b {
    font-family: var(--display);
    font-size: 1.375rem;
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
    font-size: 0.6875rem;
    color: var(--muted);
  }
  .mk-lines {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0;
    font-size: 0.875rem;
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
    font-size: 1.5rem;
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
  .mk-rel {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 64px;
    padding: 6px 12px;
    border-radius: 12px;
    border: 1px solid var(--line);
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
  .mk-rel .mk-mini {
    width: 40px;
    height: 46px;
  }
  .mk-rel .mk-mini b {
    font-size: 1.125rem;
  }
  .mk-lock {
    color: var(--bad) !important;
  }
  .mk-rel-value {
    flex: none;
    font-size: 0.875rem;
    white-space: nowrap;
  }
  .mk-dock {
    position: sticky;
    bottom: calc(var(--tabbar-h) + var(--safe-b) + 8px);
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px 16px;
    border: 1px solid var(--line);
    border-radius: 16px;
    background: var(--surface);
    box-shadow: var(--shadow);
  }
  .mk-dock-sum {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
    font-size: 0.875rem;
  }
  .mk-dock-sum b {
    font-family: var(--display);
    font-size: 1.75rem;
    color: var(--accent-text);
  }
  .mk-warn {
    margin: 0;
    font-size: 0.75rem;
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
  .mk-log {
    gap: 0;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--surface);
  }
  .mk-log li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-bottom: 1px solid var(--line);
  }
  .mk-log li:last-child {
    border-bottom: 0;
  }
  .mk-log b {
    flex: none;
    font-size: 0.875rem;
    white-space: nowrap;
  }
  .mk-plus {
    color: var(--good);
  }
  .mk-badge {
    flex: none;
    min-width: 36px;
    padding: 3px 6px;
    border-radius: 6px;
    text-align: center;
    font-size: 0.6875rem;
    font-weight: 700;
  }
  .mk-badge-bought {
    background: color-mix(in srgb, #1f4f8f 14%, var(--surface));
    color: color-mix(in srgb, #1f4f8f 80%, var(--ink));
  }
  .mk-badge-sold {
    background: color-mix(in srgb, var(--accent) 18%, var(--surface));
    color: var(--accent-text);
  }
  .mk-badge-released {
    background: color-mix(in srgb, var(--bad) 12%, var(--surface));
    color: var(--bad);
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
    border-radius: 22px 22px 0 0;
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
    width: 188px;
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
    border-radius: 12px;
    background: rgb(255 255 255 / 0.08);
  }
  .mk-detail-stats dt {
    font-size: 0.6875rem;
    opacity: 0.8;
  }
  .mk-detail-stats dd {
    margin: 2px 0 0;
    font-size: 0.8125rem;
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
    font-size: 1.0625rem;
  }
  .mk-confirm p {
    margin: 0;
  }
  .mk-note {
    padding: 10px 12px;
    border-radius: 10px;
    background: var(--surface-2);
    color: var(--muted);
    font-size: 0.75rem;
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
