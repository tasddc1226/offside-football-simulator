<script lang="ts">
  // T-11-427 오프사이드 리그 운영 도구(T-11-418b API): 지금 시즌 리그 일정 · 신청 · 배치 · 진행 상태를 보고, 배치 전이면
  // 접수 마감 · 배치 · 모든 라운드를 하루 ~ 이레 뒤로 미룬다(라운드 수는 줄이지 않는다, 여러 번 미루면 쌓인다).
  import { onMount } from 'svelte';
  import * as api from '@offside/app-core/api/admin';
  import type { AdminLeague } from '@offside/app-core/api/admin';
  import { kstDateTime as kst } from '@offside/app-core/boardText';
  import { toast } from '../helpers.js';
  import LoadState, { type LoadStatus } from '../LoadState.svelte';

  const PHASE = { soon: '접수 전', open: '접수 중', closed: '배치 기다림', running: '진행 중', done: '끝남' } as const;

  let view = $state<AdminLeague | null>(null);
  let status = $state<LoadStatus>('loading');
  let missing = $state(false);
  let busy = $state(false);
  let days = $state(1);

  const canDelay = $derived(!!view && !view.drawnAt && (view.phase === 'soon' || view.phase === 'open' || view.phase === 'closed'));

  onMount(() => void load());

  async function load() {
    status = 'loading';
    const r = await api.fetchAdminLeague();
    missing = !r.ok && r.error.reason === 'LEAGUE_NOT_FOUND';
    if (!r.ok && !missing) return (status = 'error');
    view = r.ok ? r.data : null;
    status = 'ready';
  }
  async function delay() {
    if (!view || !confirm(`접수 마감 · 배치 · 모든 라운드를 ${days}일 뒤로 미룰까요?`)) return;
    busy = true;
    const r = await api.delayLeague(days);
    busy = false;
    if (!r.ok) return toast(r.error.message);
    view = r.data;
    toast(`리그 일정을 ${days}일 미뤘어요`);
  }
</script>

<div class="stack" style="gap:12px" data-admin="league">
  <div class="row" style="justify-content:space-between">
    <h2 style="margin:0">오프사이드 리그</h2>
    <button class="icon-btn" onclick={() => load()}>새로고침</button>
  </div>
  <LoadState {status} failText="리그 상태를 불러오지 못했어요." retry={load}>
    {#if view}
      {@const l = view.league}
      <div class="row" style="gap:6px">
        <b>시즌 {l.season}</b>
        <span class="pill" data-league-phase={view.phase}>{PHASE[view.phase]}</span>
        {#if view.delayed}<span class="muted fs-xs" data-league-delayed>일정 미룸</span>{/if}
      </div>
      <dl class="league-plan">
        <div><dt>접수</dt><dd>{kst(l.opensAt)} ~ {kst(l.closesAt)}</dd></div>
        <div><dt>배치</dt><dd>{kst(l.drawAt)}{view.drawnAt ? ` (끝남 ${kst(view.drawnAt)})` : ''}</dd></div>
        <div><dt>경기</dt><dd>{kst(l.rounds[0]!)} ~ {kst(l.rounds.at(-1)!)} ({l.rounds.length}라운드)</dd></div>
        <div><dt>신청</dt><dd data-league-count="entries">{view.counts.entries}</dd></div>
        <div><dt>배치</dt><dd data-league-count="placed">{view.counts.placed}</dd></div>
        <div><dt>자격 모자라 빠짐</dt><dd>{view.counts.dropped}</dd></div>
        <div><dt>기권 퇴출</dt><dd>{view.counts.forfeited}</dd></div>
        <div><dt>끝난 라운드</dt><dd data-league-played>{view.playedRounds}/{l.rounds.length}</dd></div>
        <div><dt>밀린 경기</dt><dd class:bad={view.overdue > 0} data-league-overdue>{view.overdue}</dd></div>
        {#if view.doneAt}<div><dt>마무리</dt><dd>{kst(view.doneAt)}</dd></div>{/if}
      </dl>
      {#if canDelay}
        <div class="row" style="gap:6px">
          <label class="row" style="gap:6px">미룰 날<input type="number" min="1" max="7" style="width:64px" bind:value={days} /></label>
          <button class="btn" data-act="league-delay" disabled={busy || !(days >= 1 && days <= 7)} onclick={delay}>일정 미루기</button>
        </div>
        <p class="muted fs-xs" style="margin:0">배치 전에만 미룰 수 있어요. 접수 마감 · 배치 · 모든 라운드가 같이 밀리고, 개막 · 접수 시작은 그대로예요.</p>
      {/if}
    {:else if missing}
      <p class="muted" style="margin:0">지금 보여 줄 리그가 없어요.</p>
    {/if}
  </LoadState>
</div>

<style>
  .league-plan { display: grid; gap: 8px; margin: 0; }
  .league-plan div { display: flex; gap: 12px; justify-content: space-between; align-items: baseline; }
  dt { color: var(--muted); }
  dd { margin: 0; font-variant-numeric: tabular-nums; text-align: right; }
  .bad { color: var(--bad); font-weight: 700; }
</style>
