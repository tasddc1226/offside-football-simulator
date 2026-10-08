<script lang="ts">
  // T-11-153 구단 자금 대조. 잔액 = 방출 + 판매(수수료 뺀) − 영입 − 구단 자금으로 산 것. 기록 밖에서 바뀐 잔액(차이)이 있는
  // 구단주를 보여 주고, 프로필 id나 닉네임으로 한 명의 출처별 합과 최근 움직임을 본다. 근거는 api `db/repos/fundsAudit.ts`.
  import { onMount } from 'svelte';
  import LoadState, { type LoadStatus } from '../LoadState.svelte';
  import * as api from '@offside/app-core/api/admin';
  import type { AdminFundsOwner, AdminFundsReport } from '@offside/app-core/api/admin';
  import { kstDateTime as kst } from '@offside/app-core/boardText';
  import { fundsText } from '@offside/app-core/funds';
  import { FUNDS_MOVE, fundsItemName, signedFunds } from '@offside/app-core/admin/funds';

  let report = $state<AdminFundsReport | null>(null);
  let status = $state<LoadStatus>('loading');
  let q = $state('');
  let owner = $state<AdminFundsOwner | null>(null);
  let ownerMsg = $state('');

  onMount(() => void load());

  async function load() {
    status = 'loading';
    const r = await api.fetchFundsReport();
    if (!r.ok) {
      status = 'error';
      return;
    }
    report = r.data;
    status = 'ready';
  }
  async function find(query = q) {
    const v = query.trim();
    if (!v) return;
    q = v;
    ownerMsg = '';
    const r = await api.fetchFundsOwner(v);
    owner = r.ok ? r.data : null;
    if (!r.ok) ownerMsg = r.error.message || '구단주를 찾지 못했어요.';
  }
</script>

<div class="stack" style="gap:14px" data-admin="funds">
  <div class="row" style="justify-content:space-between">
    <h2 style="margin:0">구단 자금 대조</h2>
    <button class="icon-btn" data-act="refresh-funds" onclick={load}>새로고침</button>
  </div>
  <p class="muted fs-xs" style="margin:0">
    잔액 = 방출 + 판매(수수료 뺀) − 영입 − 구단 자금으로 산 것(리롤권 · 광고 대신 보상). 차이가 0이 아니면 기록 밖에서 잔액이
    바뀐 구단주예요.
  </p>
  <LoadState {status} failText="구단 자금 대조를 불러오지 못했어요." retry={load}>
    {@const r = report!}
    <p class="fs-sm" style="margin:0" data-funds-summary>
      {kst(r.generatedAt)} 기준 · 구단주 <b>{r.owners.toLocaleString()}</b>명 · 어긋남 <b data-funds-mismatched>{r.mismatched}</b>명
    </p>
    <dl class="sums">
      <dt>잔액 합</dt><dd>{fundsText(r.balance)}</dd>
      <dt>방출로 들어옴</dt><dd>{fundsText(r.released)}</dd>
      <dt>판매(수수료 뺀)</dt><dd>{fundsText(r.sold)}</dd>
      <dt>영입</dt><dd>{fundsText(r.bought)}</dd>
      <dt>수수료로 없어짐</dt><dd>{fundsText(r.fees)}</dd>
      {#each Object.entries(r.items) as [item, v] (item)}
        <dt>{fundsItemName(item)}</dt><dd>{fundsText(v)}</dd>
      {/each}
    </dl>
    {#if r.mismatches.length}
      <ul class="bad-list">
        {#each r.mismatches as m (m.profileId)}
          <li data-funds-mismatch={m.profileId}>
            <span>{m.nickname ?? '닉네임 없음'} <small class="muted">{m.profileId}</small></span>
            <button class="icon-btn" onclick={() => find(m.profileId)}>차이 {signedFunds(m.diff)}</button>
          </li>
        {/each}
      </ul>
    {/if}
  </LoadState>

  <form class="row" style="gap:8px" onsubmit={(e) => (e.preventDefault(), void find())}>
    <input class="input" style="flex:1" placeholder="프로필 id(prf_…) 또는 닉네임" bind:value={q} data-funds-query />
    <button class="btn btn-sm" type="submit" data-act="find-funds-owner">찾기</button>
  </form>
  {#if ownerMsg}<p class="muted fs-sm" style="margin:0">{ownerMsg}</p>{/if}
  {#if owner}
    <div class="owner" data-funds-owner={owner.profileId}>
      <b>{owner.nickname ?? '닉네임 없음'} <small class="muted">{owner.profileId}</small></b>
      <p class="fs-sm" style="margin:0">
        잔액 {fundsText(owner.balance)} = 방출 {fundsText(owner.released)} + 판매 {fundsText(owner.sold)} − 영입
        {fundsText(owner.bought)} − 사용 {fundsText(owner.items)}
        <b class:bad={owner.diff !== 0}>{owner.diff === 0 ? '· 일치' : `· 차이 ${signedFunds(owner.diff)}`}</b>
      </p>
      <ul class="moves">
        {#each owner.moves as m, i (i)}
          <li>
            <span>{m.kind === 'item' ? fundsItemName(m.item ?? '') : FUNDS_MOVE[m.kind]} <small class="muted">{kst(m.at)}</small></span>
            <b>{signedFunds(m.amount)}</b>
          </li>
        {:else}
          <li class="muted">움직임이 없어요.</li>
        {/each}
      </ul>
    </div>
  {/if}
</div>

<style>
  .sums { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; margin: 0; font-size: 0.8125rem; }
  .sums dd { margin: 0; text-align: right; font-variant-numeric: tabular-nums; }
  .bad-list,
  .moves { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
  .bad-list li,
  .moves li { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 6px 0; border-top: 1px solid var(--line); font-size: 0.8125rem; }
  .bad-list small,
  .moves small { display: block; }
  .owner { border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; }
  .bad { color: var(--bad); }
</style>
