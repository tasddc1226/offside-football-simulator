<script lang="ts">
  // T-11-263 매출: 기간(오늘 · 7일 · 30일 · 90일) 합 · 날짜별 · 상품별 · 스토어별 · 최근 결제. 근거는 api `db/repos/revenue.ts`.
  import { onMount } from 'svelte';
  import LoadState, { type LoadStatus } from '../LoadState.svelte';
  import * as api from '@offside/app-core/api/admin';
  import type { AdminRevenue } from '@offside/app-core/api/admin';
  import { kstDateTime as kst } from '@offside/app-core/boardText';
  import {
    ADMIN_REVENUE_DAYS, REVENUE_NOTE, adsSince, dayKrw, dayTitle, nick, periodLabel, productLine, productName, recentLine, revenueSummary, storeName, won,
  } from '@offside/app-core/admin/users';

  let days = $state(7);
  let data = $state<AdminRevenue | null>(null);
  let status = $state<LoadStatus>('loading');

  onMount(() => void load());

  async function load() {
    status = 'loading';
    const r = await api.fetchRevenue(days);
    if (!r.ok) {
      status = 'error';
      return;
    }
    data = r.data;
    status = 'ready';
  }
  const maxKrw = (r: AdminRevenue) => Math.max(1, ...r.daily.map(dayKrw));
</script>

<div class="stack" style="gap:14px" data-admin="revenue">
  <div class="row" style="justify-content:space-between">
    <h2 style="margin:0">매출</h2>
    <button class="icon-btn" data-act="refresh-revenue" onclick={load}>새로고침</button>
  </div>
  <div class="seg" style="grid-template-columns:repeat(4,1fr)" role="group" aria-label="매출 기간">
    {#each ADMIN_REVENUE_DAYS as n (n)}
      <button class="opt" aria-pressed={days === n} data-revenue-days={n} onclick={() => ((days = n), void load())}>{periodLabel(n)}</button>
    {/each}
  </div>
  <p class="muted fs-xs" style="margin:0">{REVENUE_NOTE}</p>
  <LoadState {status} failText="매출을 불러오지 못했어요." retry={load}>
    {@const r = data!}
    <p class="muted fs-xs" style="margin:0">{kst(r.generatedAt)} 기준 · {r.days === 1 ? '오늘' : `최근 ${r.days}일`}</p>
    <dl class="sums" data-revenue-summary>
      {#each revenueSummary(r) as [label, v] (label)}<dt>{label}</dt><dd>{v}</dd>{/each}
    </dl>
    {#if adsSince(r)}<p class="muted fs-xs" style="margin:0">{adsSince(r)}</p>{/if}

    {#if r.daily.length > 1}
      {@const max = maxKrw(r)}
      <figure class="daily">
        <figcaption class="fs-sm">날짜별 매출(광고 제거 포함)</figcaption>
        <div class="bars" role="list">
          {#each r.daily as d (d.day)}
            <div class="bar" role="listitem" aria-label="{d.day} {won(dayKrw(d))}" title={dayTitle(d)}>
              <i style="height:{Math.round((dayKrw(d) / max) * 100)}%"></i>
              {#if r.daily.length <= 14}<small>{d.day.slice(8)}</small>{/if}
            </div>
          {/each}
        </div>
      </figure>
    {/if}

    <section class="stack" style="gap:4px">
      <h3 class="fs-sm" style="margin:0">상품별</h3>
      <ul class="lines">
        {#each r.products as p (p.productId)}
          <li><span>{productName(p.productId)}</span><b>{productLine(p)}</b></li>
        {:else}<li class="muted">이 기간 결제가 없어요.</li>{/each}
      </ul>
    </section>
    <section class="stack" style="gap:4px">
      <h3 class="fs-sm" style="margin:0">스토어별</h3>
      <ul class="lines">
        {#each r.stores as s (s.store)}<li><span>{storeName(s.store)}</span><b>{s.count}건 · {won(s.krw)}</b></li>{:else}<li class="muted">없어요.</li>{/each}
      </ul>
    </section>
    <section class="stack" style="gap:4px">
      <h3 class="fs-sm" style="margin:0">최근 결제</h3>
      <ul class="lines">
        {#each r.recent as x, i (i)}
          <li>
            <span>{productName(x.productId)} <small class="muted">{nick(x.nickname)} · {recentLine(x)}</small></span>
          </li>
        {:else}<li class="muted">없어요.</li>{/each}
      </ul>
    </section>
  </LoadState>
</div>

<style>
  .sums { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; margin: 0; font-size: var(--fs-label); }
  .sums dd { margin: 0; text-align: right; font-variant-numeric: tabular-nums; }
  .lines { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
  .lines li { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 6px 0; border-top: 1px solid var(--line); font-size: var(--fs-label); }
  .lines small { display: block; }
  .daily { margin: 0; display: flex; flex-direction: column; gap: 6px; }
  .bars { display: flex; align-items: flex-end; gap: 2px; height: 80px; }
  .bar { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; height: 100%; min-width: 0; }
  .bar i { display: block; width: 100%; background: var(--accent); border-radius: 2px 2px 0 0; min-height: 1px; }
  .bar small { font-size: var(--fs-caption2); color: var(--muted); }
</style>
