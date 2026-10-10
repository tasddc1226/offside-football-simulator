<script lang="ts">
  // 구단 자금 내역 — 구단주 화면의 '구단 자금' 칸으로 연다. 지금 자금, 들어온·나간 자금 합(출처별), 그리고 방출·판매·
  // 영입·구단 자금 사용을 한국 시각 날짜로 묶어 최근 순으로 보여 준다(30줄씩 더 보기).
  import Topbar from './Topbar.svelte';
  import BackBar from './BackBar.svelte';
  import { go } from './nav.js';
  import type { FundsHistoryEntry, FundsHistoryResponse } from '@offside/contracts';
  import { fetchFundsHistory, fundsHistoryDays, fundsHistoryTotals } from '@offside/app-core/fundsHistory';
  import { fundsText } from '@offside/app-core/market';
  import { fundsHistoryText as H } from '@offside/app-core/i18n/ko/fundsHistory';
  import { localCareerNames } from '@offside/game/hof-store';

  const local = localCareerNames();
  let res = $state<FundsHistoryResponse | null>(null);
  let items = $state<FundsHistoryEntry[]>([]);
  let page = $state(0);
  let failed = $state(false);
  let loading = $state(false);
  const days = $derived(fundsHistoryDays(items, local));
  const totals = $derived(res ? fundsHistoryTotals(res.totals) : null);

  async function load(next: number) {
    loading = true;
    failed = false;
    const r = await fetchFundsHistory(next);
    loading = false;
    if (!r.ok) return void (failed = true);
    res = r.data;
    items = next === 0 ? r.data.items : [...items, ...r.data.items];
    page = next;
  }
  void load(0);
</script>

<div class="wrap funds-history" data-funds-history>
  <Topbar />
  <header class="settings-head">
    <div class="eyebrow">{H.eyebrow}</div>
    <h1>{H.title}</h1>
  </header>

  {#if failed && !res}
    <section class="card fh-fail">
      <p class="muted">{H.loadFail}</p>
      <button class="btn" data-act="funds-retry" onclick={() => void load(0)}>{H.retry}</button>
    </section>
  {:else if !res || !totals}
    <section class="card"><p class="muted" aria-live="polite">…</p></section>
  {:else}
    <section class="card fh-sum" aria-label={H.balance}>
      <div class="fh-balance">
        <span>{H.balance}</span>
        <b data-funds-balance>{fundsText(res.balance)}</b>
      </div>
      <dl class="fh-totals">
        <div data-funds-income>
          <dt>{H.income}</dt>
          <dd class="fh-plus">{totals.income.total}</dd>
          {#each totals.income.lines as l (l.label)}<span class="muted fs-sm">{l.label} {l.value}</span>{/each}
        </div>
        <div data-funds-spending>
          <dt>{H.spending}</dt>
          <dd>{totals.spending.total}</dd>
          {#each totals.spending.lines as l (l.label)}<span class="muted fs-sm">{l.label} {l.value}</span>{/each}
        </div>
      </dl>
    </section>

    <section class="fh-log" aria-label={H.log}>
      {#each days as g (g.day)}
        <h2 class="fh-day">{g.label}</h2>
        <ul class="fh-rows">
          {#each g.rows as r (r.id)}
            <li data-funds-row={r.kind}>
              <span class="funds-badge funds-badge-{r.kind}">{r.badge}</span>
              <span class="fh-info">
                <span class="fh-title">{r.title}</span>
                <small>{r.sub}</small>
              </span>
              <b class:fh-plus={r.plus}>{r.amount}</b>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="card muted fs-sm" data-funds-empty>{H.empty}</p>
      {/each}
      {#if res.hasMore}
        <button class="btn btn-block" data-act="funds-more" disabled={loading} onclick={() => void load(page + 1)}>{H.more}</button>
      {/if}
      {#if failed}<p class="muted fs-sm">{H.loadFail}</p>{/if}
    </section>
  {/if}

  <BackBar act="owner" fallback={() => go('owner')} />
</div>

<style>
  .funds-history {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .fh-fail {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
  .fh-sum {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .fh-balance {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .fh-balance span {
    font-size: 0.8125rem;
    color: var(--muted);
  }
  .fh-balance b {
    font-family: var(--display);
    font-size: 1.75rem;
    color: var(--accent-text);
    font-variant-numeric: tabular-nums;
  }
  .fh-totals {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin: 0;
  }
  .fh-totals div {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 10px 12px;
    border-radius: 12px;
    background: var(--surface-2);
    min-width: 0;
  }
  .fh-totals dt {
    font-size: 0.75rem;
    color: var(--muted);
  }
  .fh-totals dd {
    margin: 0 0 2px;
    font-family: var(--display);
    font-size: 1.125rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }
  .fh-log {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .fh-day {
    margin: 6px 0 0;
    font-size: 0.8125rem;
    color: var(--muted);
  }
  .fh-rows {
    list-style: none;
    margin: 0;
    padding: 0;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--surface);
  }
  .fh-rows li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-bottom: 1px solid var(--line);
  }
  .fh-rows li:last-child {
    border-bottom: 0;
  }
  .fh-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }
  .fh-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .fh-info small {
    font-size: 0.75rem;
    color: var(--muted);
  }
  .fh-rows b {
    flex: none;
    font-size: 0.875rem;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .fh-plus {
    color: var(--good);
  }
</style>
