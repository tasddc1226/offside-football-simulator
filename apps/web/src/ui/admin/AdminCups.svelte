<script lang="ts">
  // T-11-145 오프사이드 컵 열기: 접수 시작일만 고르면 표준 일정(접수 4일 → 추첨 12시 → 8일간 매일 21시 경기)으로
  // 다음 회차를 연다. 시즌·회차·id는 서버가 정하고, 다른 대회와 기간이 겹치면 막는다. 접수 전 대회만 지울 수 있다.
  import { onMount } from 'svelte';
  import { CUP_PLAN_DEFAULTS as D, planCup } from '@offside/contracts/cup';
  import * as api from '@offside/app-core/api/admin';
  import type { AdminCup } from '@offside/app-core/api/admin';
  import { kstDateTime as kst } from '@offside/app-core/boardText';
  import { toast } from '../helpers.js';
  import LoadState, { type LoadStatus } from '../LoadState.svelte';

  const STATUS = { scheduled: '접수 전', entry: '접수 중', running: '진행 중', done: '끝남' } as const;

  let items = $state<AdminCup[]>([]);
  let status = $state<LoadStatus>('loading');
  let busy = $state(false);
  let opensOn = $state('');
  let entryDays = $state<number>(D.entryDays);
  let matchHour = $state<number>(D.matchHour);
  let capacity = $state<number>(D.capacity);
  let minFilled = $state<number>(D.minFilled);

  const input = $derived({ opensOn, entryDays, matchHour, capacity, minFilled });
  const preview = $derived(
    /^\d{4}-\d{2}-\d{2}$/.test(opensOn) ? planCup({ ...input, id: '', season: 0, edition: 0 }) : null,
  );

  onMount(() => void load());

  async function load() {
    status = 'loading';
    const r = await api.fetchAdminCups();
    if (!r.ok) return (status = 'error');
    items = r.data.items;
    status = 'ready';
  }
  async function create() {
    if (!preview || !confirm(`${kst(preview.opensAt)}에 접수를 여는 대회를 만들까요?`)) return;
    busy = true;
    const r = await api.createCup(input);
    busy = false;
    if (!r.ok) return toast(r.error.message);
    toast(`제${r.data.cup.edition}회 대회를 열었어요`);
    opensOn = '';
    await load();
  }
  async function remove(it: AdminCup) {
    if (!confirm(`제${it.cup.edition}회 대회를 지울까요?`)) return;
    busy = true;
    const r = await api.deleteCup(it.cup.id);
    busy = false;
    if (!r.ok) return toast(r.error.message);
    toast('대회를 지웠어요');
    await load();
  }
</script>

<div class="stack" style="gap:12px" data-admin="cups">
  <h2 style="margin:0">새 대회 열기</h2>
  <div class="cup-form">
    <label>접수 시작일(KST)<input type="date" bind:value={opensOn} data-cup-field="opensOn" /></label>
    <label>접수 기간(일)<input type="number" min="1" max="14" bind:value={entryDays} /></label>
    <label>경기 시각(시)<input type="number" min="14" max="23" bind:value={matchHour} /></label>
    <label>정원<input type="number" min="4" max="64" bind:value={capacity} /></label>
    <label>자격(선발 실제 선수)<input type="number" min="1" max="11" bind:value={minFilled} /></label>
  </div>
  {#if preview}
    <dl class="cup-plan" data-cup-preview>
      <div><dt>접수</dt><dd>{kst(preview.opensAt)} ~ {kst(preview.closesAt)}</dd></div>
      <div><dt>추첨</dt><dd>{kst(preview.drawAt)}</dd></div>
      <div><dt>경기</dt><dd>{kst(preview.rounds[0]!)} ~ {kst(preview.rounds.at(-1)!)} (매일 1경기)</dd></div>
    </dl>
  {/if}
  <button class="btn" data-act="cup-create" disabled={busy || !preview} onclick={create}>대회 열기</button>

  <div class="row" style="justify-content:space-between">
    <h2 style="margin:0">대회 목록</h2>
    <button class="icon-btn" onclick={() => load()}>새로고침</button>
  </div>
  <LoadState {status} failText="대회 목록을 불러오지 못했어요." retry={load}>
    <ul class="admin-cups">
      {#each items as it (it.cup.id)}
        <li data-cup={it.cup.id}>
          <div class="row" style="gap:6px">
            <b>시즌 {it.cup.season} 제{it.cup.edition}회</b>
            <span class="pill">{STATUS[it.status]}</span>
            <span class="muted fs-xs">신청 {it.entries}/{it.cup.capacity}</span>
          </div>
          <span class="muted fs-xs">
            접수 {kst(it.cup.opensAt)} · 결승 {kst(it.cup.rounds.at(-1)!.at)}
          </span>
          {#if it.status === 'scheduled'}
            <div class="row"><button class="icon-btn" data-act="cup-delete" disabled={busy} onclick={() => remove(it)}>지우기</button></div>
          {/if}
        </li>
      {:else}
        <li class="muted">대회가 없어요.</li>
      {/each}
    </ul>
  </LoadState>
</div>

<style>
  .cup-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; }
  .cup-form label { display: flex; flex-direction: column; gap: 4px; font-size: var(--fs-sm, 13px); }
  .cup-plan { margin: 0; display: flex; flex-direction: column; gap: 4px; }
  .cup-plan div { display: flex; gap: 8px; }
  .cup-plan dt { min-width: 36px; color: var(--muted); }
  .cup-plan dd { margin: 0; }
  .admin-cups { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
  .admin-cups li { display: flex; flex-direction: column; gap: 4px; padding: 10px 0; border-bottom: 1px solid var(--line); }
</style>
