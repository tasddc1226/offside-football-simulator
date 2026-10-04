<script lang="ts">
  // T-11-080 이적시장 — 지금 시즌 은퇴 선수 카드를 구단 자금으로 사고판다. 구단주 화면의 '이적시장'으로 연다.
  // 탭 셋: 시장(열린 등록) · 내 선수(내놓기 · 방출) · 내 거래(판매 중 · 최근 거래). 탭을 처음 열 때만 불러온다.
  import type { CareerPos } from '@offside/contracts';
  import {
    buyListing,
    cancelListing,
    createListing,
    fetchMarket,
    fetchMarketMe,
    releaseCards,
    type MarketListing,
    type MarketMeResponse,
    type MarketSort,
  } from '@offside/app-core/api/market';
  import { fetchOwnerTeam, type OwnerTeamResponse, type TeamPlayer } from '@offside/app-core/api/team';
  import {
    MARKET_POS_FILTERS,
    MARKET_SORT_LABEL,
    MARKET_TABS,
    TRADE_LABEL,
    buyBlock,
    fundsText,
    lineupOf,
    marketEmptyText,
    marketName,
    mineState,
    parseEok,
    priceRatio,
    releaseAmount,
    releaseConfirmText,
    sellQuote,
    toEok,
    tradeAmount,
    type MarketTab,
  } from '@offside/app-core/market';
  import { agoKo, fmtValue } from '@offside/app-core/format';
  import { localCareerNames } from '@offside/game/season';
  import { POS_LABEL } from '@offside/game/pos-label';
  import { DETAIL_LABEL } from '@offside/contracts/owner-team';
  import Topbar from './Topbar.svelte';
  import BackBar from './BackBar.svelte';
  import { go } from './nav.js';

  const local = localCareerNames();
  let tab = $state<MarketTab>('market');
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

  // 시장 목록 — 정렬·포지션이 바뀌면 첫 페이지부터.
  let sort = $state<MarketSort>('new');
  let pos = $state<CareerPos | undefined>(undefined);
  let items = $state<MarketListing[]>([]);
  let page = $state(0);
  let hasMore = $state(false);
  let season = $state<number | null>(null);
  let listStatus = $state<'loading' | 'ok' | 'error'>('loading');
  async function loadList(next = 0) {
    if (next === 0) listStatus = 'loading';
    const r = await fetchMarket(sort, pos, next);
    if (!r.ok) return void (listStatus = 'error');
    items = next === 0 ? r.data.items : [...items, ...r.data.items];
    page = next;
    hasMore = r.data.hasMore;
    season = r.data.season;
    listStatus = 'ok';
  }
  // 정렬·포지션을 바꾸면 첫 페이지부터 다시 받는다(loadList가 둘을 읽어 의존한다).
  $effect(() => {
    if (tab === 'market') void loadList(0);
  });
  const myListingIds = $derived(new Set(me?.listings.map((l) => l.id) ?? []));

  // 내 선수 — 시즌을 골라 본다(기본은 지금 시즌).
  let team = $state<OwnerTeamResponse | null>(null);
  let teamSeason = $state<number | undefined>(undefined);
  let teamFailed = $state(false);
  async function loadTeam() {
    const r = await fetchOwnerTeam(teamSeason);
    teamFailed = !r.ok;
    if (r.ok) team = r.data;
  }
  $effect(() => {
    if (tab === 'mine') void loadTeam();
  });
  const lineup = $derived(team ? lineupOf(team) : new Set<string>());
  const isCurrent = $derived(!!team && team.season === team.current);
  const nameOfPlayer = (p: TeamPlayer) => marketName(p, local);

  // 일괄 방출 — 고른 선수.
  let picked = $state<ReadonlySet<string>>(new Set());
  const pickedPlayers = $derived(team?.players.filter((p) => picked.has(p.careerId)) ?? []);
  const pickedAmount = $derived(me ? releaseAmount(pickedPlayers, me.rules.releaseRate) : 0);
  function togglePick(id: string) {
    picked = picked.has(id) ? new Set([...picked].filter((x) => x !== id)) : new Set([...picked, id]);
  }

  // 시트: 영입 · 내놓기 · 방출 확인.
  let buying = $state<MarketListing | null>(null);
  let selling = $state<TeamPlayer | null>(null);
  let sellInput = $state('');
  let confirmRelease = $state(false);
  const sellPrice = $derived(parseEok(sellInput));
  const quote = $derived(selling?.cardValue && me ? sellQuote(selling.cardValue, sellPrice, me.rules) : null);

  function closeSheets() {
    buying = null;
    selling = null;
    confirmRelease = false;
    error = null;
  }
  async function refresh() {
    await Promise.all([loadMe(), tab === 'market' ? loadList(0) : tab === 'mine' ? loadTeam() : null]);
  }
  async function run<T>(send: () => Promise<{ ok: true; data: T } | { ok: false; error: { message: string; reason?: string } }>, done: string) {
    busy = true;
    error = null;
    const r = await send();
    busy = false;
    if (!r.ok) {
      error = r.error.message;
      // 이미 팔렸거나 가격이 바뀌었으면 목록을 새로 받는다.
      if (r.error.reason === 'LISTING_GONE' || r.error.reason === 'PRICE_CHANGED') void loadList(0);
      return;
    }
    closeSheets();
    picked = new Set();
    toast = done;
    await refresh();
  }
  let toast = $state<string | null>(null);
  $effect(() => {
    if (!toast) return;
    const t = setTimeout(() => (toast = null), 2400);
    return () => clearTimeout(t);
  });

  const posOf = (c: { dpos: keyof typeof DETAIL_LABEL | null; pos: CareerPos }) => (c.dpos ? DETAIL_LABEL[c.dpos] : POS_LABEL[c.pos]);
</script>

<div class="wrap market">
  <Topbar />
  <header class="settings-head">
    <div class="eyebrow">Transfer market</div>
    <h1>이적시장</h1>
  </header>

  <section class="card mk-funds" aria-label="구단 자금" data-market-funds>
    {#if me}
      <dl>
        <div class="mk-balance"><dt>구단 자금</dt><dd>{fundsText(me.balance)}</dd></div>
        <div><dt>구단 가치</dt><dd>{fmtValue(me.clubValue)}</dd></div>
        <div><dt>오늘 남은 영입</dt><dd>{me.buysLeft}/{me.rules.dailyBuys}</dd></div>
      </dl>
      <p class="muted fs-sm">직접 키운 선수를 방출하면 자금이 생겨요. 판매 대금의 {Math.round(me.rules.feeRate * 100)}%는 수수료로 빠져요.</p>
    {:else}
      <p class="muted fs-sm">{meFailed ?? '불러오는 중…'}</p>
    {/if}
  </section>

  <div class="seg three mk-tabs" role="group" aria-label="이적시장">
    {#each MARKET_TABS as [k, label] (k)}
      <button class="opt" aria-pressed={tab === k} data-market-tab={k} onclick={() => (tab = k)}>{label}</button>
    {/each}
  </div>

  {#if tab === 'market'}
    <section class="card mk-list" aria-label="시장 목록">
      <div class="mk-filters">
        <div class="seg hof-pos" role="group" aria-label="포지션">
          {#each MARKET_POS_FILTERS as p (p ?? 'all')}
            <button class="opt" aria-pressed={pos === p} data-market-pos={p ?? 'all'} onclick={() => (pos = p)}>{p ? POS_LABEL[p] : '전체'}</button>
          {/each}
        </div>
        <div class="seg two" role="group" aria-label="정렬">
          {#each Object.entries(MARKET_SORT_LABEL) as [k, label] (k)}
            <button class="opt" aria-pressed={sort === k} data-market-sort={k} onclick={() => (sort = k as MarketSort)}>{label}</button>
          {/each}
        </div>
      </div>
      {#if listStatus === 'loading'}
        <p class="muted">불러오는 중…</p>
      {:else if listStatus === 'error'}
        <p class="muted">시장을 불러오지 못했어요.</p>
        <button class="btn btn-block" onclick={() => loadList(0)}>다시 불러오기</button>
      {:else}
        {#each items as l (l.id)}
          <button class="mk-row" data-listing={l.id} onclick={() => ((buying = l), (error = null))}>
            <b class="mk-ovr">{l.card.peak}</b>
            <span class="mk-info">
              <span class="mk-name">{marketName(l.card, local)}{#if myListingIds.has(l.id)}<em class="mk-tag">내 등록</em>{/if}</span>
              <small class="muted">{posOf(l.card)} · 기준가 {fmtValue(l.card.cardValue)}{l.card.transfers ? ` · 이적 ${l.card.transfers}회` : ''}</small>
            </span>
            <span class="mk-price"><b>{fmtValue(l.price)}</b><small class="muted">기준가 {priceRatio(l.price, l.card.cardValue)}%</small></span>
          </button>
        {:else}
          <p class="muted">{marketEmptyText(season, !!pos)}</p>
        {/each}
        {#if hasMore}<button class="btn btn-block" onclick={() => loadList(page + 1)}>더 보기</button>{/if}
      {/if}
    </section>
  {:else if tab === 'mine'}
    <section class="card mk-list" aria-label="내 선수">
      {#if team && team.seasons.length > 1}
        <div class="seg board-tabs hof-seasons" role="group" aria-label="시즌">
          {#each team.seasons as o (o.id)}
            <button class="opt" aria-pressed={team.season === o.id} onclick={() => ((teamSeason = o.id), (picked = new Set()))}>{o.name}</button>
          {/each}
        </div>
      {/if}
      {#if !team}
        <p class="muted">{teamFailed ? '내 선수를 불러오지 못했어요.' : '불러오는 중…'}</p>
      {:else}
        <p class="muted fs-sm">{isCurrent ? '이번 시즌 선수는 시장에 내놓을 수 있어요. 직접 키운 선수는 방출해 자금으로 바꿀 수 있어요.' : '지난 시즌 선수는 시장에 내놓을 수 없어요. 직접 키운 선수는 방출해 자금으로 바꿀 수 있어요.'}</p>
        {#each team.players as p (p.careerId)}
          {@const st = mineState(p, lineup, isCurrent)}
          <div class="mk-row mk-mine" data-mine={p.careerId}>
            {#if st.releasable}
              <input type="checkbox" class="mk-check" aria-label="{nameOfPlayer(p)} 방출할 선수로 고르기" checked={picked.has(p.careerId)} onchange={() => togglePick(p.careerId)} />
            {:else}
              <span class="mk-check" aria-hidden="true"></span>
            {/if}
            <b class="mk-ovr">{p.peak}</b>
            <span class="mk-info">
              <span class="mk-name">{nameOfPlayer(p)}</span>
              <small class="muted">{posOf(p)}{p.cardValue ? ` · 기준가 ${fmtValue(p.cardValue)}` : ''}{p.raised ? '' : ' · 영입'}{st.starter ? ' · 선발' : ''}{p.listing ? ` · ${fmtValue(p.listing.price)}에 판매 중` : ''}</small>
            </span>
            {#if p.listing}
              <button class="icon-btn" disabled={busy} data-act="cancel-listing" onclick={() => run(() => cancelListing(p.listing!.id), '판매를 내렸어요.')}>내리기</button>
            {:else if st.listable}
              <button class="icon-btn" data-act="sell" onclick={() => ((selling = p), (sellInput = toEok(p.cardValue!)), (error = null))}>내놓기</button>
            {/if}
          </div>
        {:else}
          <p class="muted">이 시즌에 은퇴한 내 선수가 없어요.</p>
        {/each}
      {/if}
    </section>
    {#if picked.size > 0}
      <div class="mk-bulk card">
        <span><b>{picked.size}명</b> 고름 · 받을 자금 {fmtValue(pickedAmount)}</span>
        <button class="btn btn-accent" data-act="release" onclick={() => ((confirmRelease = true), (error = null))}>방출</button>
      </div>
    {/if}
  {:else}
    <section class="card mk-list" aria-label="내 거래">
      {#if !me}
        <p class="muted">{meFailed ?? '불러오는 중…'}</p>
      {:else}
        <h2 class="mk-sub">판매 중 {me.listings.length}/{me.rules.listLimit}</h2>
        {#each me.listings as l (l.id)}
          <div class="mk-row">
            <b class="mk-ovr">{l.card.peak}</b>
            <span class="mk-info">
              <span class="mk-name">{marketName(l.card, local)}</span>
              <small class="muted">{posOf(l.card)} · {agoKo(Date.now() - Date.parse(l.createdAt))} 등록</small>
            </span>
            <span class="mk-price"><b>{fmtValue(l.price)}</b></span>
            <button class="icon-btn" disabled={busy} onclick={() => run(() => cancelListing(l.id), '판매를 내렸어요.')}>내리기</button>
          </div>
        {:else}
          <p class="muted">판매 중인 선수가 없어요.</p>
        {/each}
        <h2 class="mk-sub">최근 거래</h2>
        {#each me.trades as t (t.id)}
          <div class="mk-row" data-trade={t.kind}>
            <em class="mk-kind mk-{t.kind}">{TRADE_LABEL[t.kind]}</em>
            <span class="mk-info">
              <span class="mk-name">{marketName(t.card, local)}</span>
              <small class="muted">{POS_LABEL[t.card.pos]} · 최고 {t.card.peak} · {agoKo(Date.now() - Date.parse(t.at))}</small>
            </span>
            <span class="mk-price mk-{t.kind}"><b>{tradeAmount(t)}</b></span>
          </div>
        {:else}
          <p class="muted">아직 거래가 없어요.</p>
        {/each}
      {/if}
    </section>
  {/if}

  {#if toast}<p class="mk-toast" role="status">{toast}</p>{/if}
  <BackBar act="owner" fallback={() => go('owner')} />
</div>

{#if buying && me}
  {@const block = myListingIds.has(buying.id) ? '내가 내놓은 선수예요.' : buyBlock(buying.price, me.balance, me.buysLeft)}
  <button class="tm-scrim" aria-label="닫기" onclick={closeSheets}></button>
  <div class="tm-sheet" role="dialog" aria-modal="true" aria-label="선수 영입">
    <div class="tm-sheet-head">
      <div>
        <div class="eyebrow">{posOf(buying.card)} · 최고 OVR {buying.card.peak}</div>
        <h2>{marketName(buying.card, local)}</h2>
      </div>
      <button class="icon-btn" onclick={closeSheets}>닫기</button>
    </div>
    <dl class="mk-quote">
      <div><dt>판매가</dt><dd>{fmtValue(buying.price)}</dd></div>
      <div><dt>기준가</dt><dd>{fmtValue(buying.card.cardValue)} ({priceRatio(buying.price, buying.card.cardValue)}%)</dd></div>
      <div><dt>레전드 점수</dt><dd>{buying.card.legendScore}</dd></div>
      <div><dt>이적</dt><dd>{buying.card.transfers}회</dd></div>
      <div><dt>영입 뒤 자금</dt><dd>{me.balance >= buying.price ? fundsText(me.balance - buying.price) : '모자라요'}</dd></div>
    </dl>
    <p class="muted fs-sm">영입한 선수는 바로 팀에 넣을 수 있어요. 다시 팔 수는 있지만 방출할 수는 없어요.</p>
    {#if block}<p class="mk-err">{block}</p>{/if}
    {#if error}<p class="mk-err" role="alert">{error}</p>{/if}
    {#if myListingIds.has(buying.id)}
      <button class="btn btn-block" disabled={busy} onclick={() => run(() => cancelListing(buying!.id), '판매를 내렸어요.')}>판매 내리기</button>
    {:else}
      <button class="btn btn-primary btn-block" data-act="buy" disabled={busy || !!block} onclick={() => run(() => buyListing(buying!.id, buying!.price), '선수를 영입했어요.')}>
        {fmtValue(buying.price)}에 영입하기
      </button>
    {/if}
  </div>
{/if}

{#if selling && me && quote}
  <button class="tm-scrim" aria-label="닫기" onclick={closeSheets}></button>
  <div class="tm-sheet" role="dialog" aria-modal="true" aria-label="선수 내놓기">
    <div class="tm-sheet-head">
      <div>
        <div class="eyebrow">{posOf(selling)} · 최고 OVR {selling.peak}</div>
        <h2>{nameOfPlayer(selling)}</h2>
      </div>
      <button class="icon-btn" onclick={closeSheets}>닫기</button>
    </div>
    <label class="mk-price-in">
      <span>판매가(억)</span>
      <input type="text" inputmode="decimal" bind:value={sellInput} data-sell-price />
    </label>
    <p class="muted fs-sm">기준가 {fmtValue(selling.cardValue!)} · {fmtValue(quote.band.min)}부터 {fmtValue(quote.band.max)}까지 정할 수 있어요.</p>
    {#if !Number.isNaN(sellPrice) && !quote.error}
      <dl class="mk-quote">
        <div><dt>수수료</dt><dd>{fmtValue(quote.fee)}</dd></div>
        <div><dt>팔리면 받는 돈</dt><dd>{fmtValue(quote.gets)}</dd></div>
      </dl>
    {/if}
    {#if quote.error && sellInput.trim()}<p class="mk-err">{quote.error}</p>{/if}
    {#if error}<p class="mk-err" role="alert">{error}</p>{/if}
    <p class="muted fs-sm">팔리기 전까지는 팀에서 계속 뛰어요. 팔리면 선발 자리는 유스 선수가 채워요.</p>
    <button class="btn btn-primary btn-block" data-act="list" disabled={busy || Number.isNaN(sellPrice) || !!quote.error} onclick={() => run(() => createListing(selling!.careerId, sellPrice), '시장에 내놓았어요.')}>
      시장에 내놓기
    </button>
  </div>
{/if}

{#if confirmRelease && me}
  <button class="tm-scrim" aria-label="닫기" onclick={closeSheets}></button>
  <div class="tm-sheet" role="dialog" aria-modal="true" aria-label="선수 방출">
    <div class="tm-sheet-head">
      <h2>선수 방출</h2>
      <button class="icon-btn" onclick={closeSheets}>닫기</button>
    </div>
    <p>{releaseConfirmText(picked.size, pickedAmount)}</p>
    {#if error}<p class="mk-err" role="alert">{error}</p>{/if}
    <button class="btn btn-accent btn-block" data-act="release-confirm" disabled={busy} onclick={() => run(() => releaseCards([...picked]), `${picked.size}명을 방출했어요.`)}>
      {picked.size}명 방출하기
    </button>
  </div>
{/if}

<style>
  .mk-funds dl {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin: 0 0 8px;
  }
  .mk-funds dl div,
  .mk-quote div {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 10px 12px;
    border-radius: 12px;
    background: var(--surface-2);
    min-width: 0;
  }
  .mk-funds dt,
  .mk-quote dt {
    font-size: 0.75rem;
    color: var(--muted);
  }
  .mk-funds dd,
  .mk-quote dd {
    margin: 0;
    font-family: var(--display);
    font-size: 1.125rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }
  .mk-balance {
    grid-column: 1 / -1;
  }
  .mk-funds .mk-balance dd {
    font-size: 1.75rem;
    color: var(--accent-text);
  }
  .mk-funds p {
    margin: 0;
  }
  .mk-tabs {
    margin: 12px 0;
  }
  .mk-tabs .opt {
    align-items: center;
    font-weight: 700;
  }
  .mk-filters {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 8px;
  }
  .mk-filters .seg.hof-pos {
    margin-top: 0;
  }
  .mk-row {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 0;
    border: 0;
    border-top: 1px solid var(--line);
    background: none;
    color: inherit;
    text-align: left;
    font: inherit;
  }
  button.mk-row {
    cursor: pointer;
  }
  .mk-ovr {
    flex: none;
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: var(--pitch);
    color: var(--pitch-accent);
    font-family: var(--display);
    font-size: 1.125rem;
  }
  .mk-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .mk-name {
    font-weight: 700;
    overflow-wrap: anywhere;
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
    font-variant-numeric: tabular-nums;
  }
  .mk-check {
    flex: none;
    width: 20px;
    height: 20px;
  }
  .mk-kind {
    flex: none;
    width: 40px;
    font-style: normal;
    font-weight: 700;
    font-size: 0.8125rem;
    text-align: center;
  }
  .mk-sold,
  .mk-released {
    color: var(--good);
  }
  .mk-bought {
    color: var(--bad);
  }
  .mk-sub {
    margin: 12px 0 4px;
    font-size: 1rem;
  }
  .mk-sub:first-child {
    margin-top: 0;
  }
  .mk-bulk {
    position: sticky;
    bottom: calc(76px + var(--safe-b));
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 12px;
    box-shadow: var(--shadow);
  }
  .mk-quote {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin: 4px 0 10px;
  }
  .mk-price-in {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-weight: 700;
  }
  .mk-price-in input {
    font-size: 1.25rem;
  }
  .mk-err {
    color: var(--bad);
    font-weight: 600;
  }
  .mk-toast {
    position: fixed;
    left: 50%;
    bottom: calc(84px + var(--safe-b));
    z-index: 70;
    transform: translateX(-50%);
    padding: 8px 14px;
    border-radius: 999px;
    background: var(--ink);
    color: var(--surface);
    font-size: 0.875rem;
    font-weight: 700;
  }
  .tm-scrim {
    position: fixed;
    inset: 0;
    z-index: 60;
    border: 0;
    padding: 0;
    background: rgba(0, 0, 0, 0.45);
  }
  .tm-sheet {
    position: fixed;
    z-index: 61;
    left: 50%;
    bottom: 0;
    transform: translateX(-50%);
    width: min(100%, 560px);
    max-height: 78vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px 16px calc(12px + var(--safe-b));
    border-radius: 18px 18px 0 0;
    background: var(--surface);
    color: var(--ink);
    box-shadow: var(--shadow);
  }
  .tm-sheet-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }
  .tm-sheet-head h2 {
    margin: 0;
  }
  .tm-sheet p {
    margin: 0;
  }
</style>
