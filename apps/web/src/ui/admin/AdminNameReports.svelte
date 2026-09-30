<script lang="ts">
  // 이름 신고 처리(앱스토어 UGC 정책): 신고받은 명예의 전당 선수 이름·구단 이름을 대상마다 모아 본다. 가리면 선수는
  // 익명이 되고(다시 올려도 돌아오지 않는다), 구단은 가린 이름으로 바뀐다. 처리하면 감사 로그가 남는다.
  import { onMount } from 'svelte';
  import * as api from '@offside/app-core/api/admin';
  import type { AdminNameReport } from '@offside/app-core/api/admin';
  import { kstDateTime as kst } from '@offside/app-core/boardText';
  import { toast } from '../helpers.js';
  import LoadState, { type LoadStatus } from '../LoadState.svelte';

  const KIND = { career: '선수', team: '구단' } as const;
  let items = $state<AdminNameReport[]>([]);
  let status = $state<LoadStatus>('loading');
  let busy = $state(false);

  onMount(() => void load());

  async function load() {
    status = 'loading';
    const r = await api.fetchNameReports();
    if (!r.ok) return (status = 'error');
    items = r.data.items;
    status = 'ready';
  }
  async function resolve(it: AdminNameReport, action: 'hide' | 'dismiss') {
    const label = it.name ?? '(지워진 대상)';
    if (action === 'hide' && !confirm(`'${label}' 이름을 가릴까요?`)) return;
    busy = true;
    const r = await api.resolveNameReport({ kind: it.kind, id: it.targetId, action });
    busy = false;
    if (!r.ok) return toast(r.error.message);
    toast(action === 'hide' ? '이름을 가렸어요' : '신고를 기각했어요');
    items = items.filter((x) => !(x.kind === it.kind && x.targetId === it.targetId));
  }
</script>

<div class="stack" style="gap:12px" data-admin="name-reports">
  <div class="row" style="justify-content:space-between">
    <h2 style="margin:0">이름 신고</h2>
    <button class="icon-btn" onclick={() => load()}>새로고침</button>
  </div>
  <LoadState {status} failText="이름 신고를 불러오지 못했어요." retry={load}>
    <ul class="admin-names">
      {#each items as it (`${it.kind}:${it.targetId}`)}
        <li data-name-report={it.targetId}>
          <div class="row" style="gap:6px">
            <span class="pill">{KIND[it.kind]}</span>
            <b>{it.name ?? '(지워진 대상)'}</b>
            <span class="pill warn">신고 {it.reports}</span>
          </div>
          <span class="muted fs-xs">마지막 신고 {kst(it.lastReportedAt)}</span>
          <div class="row" style="gap:6px">
            <button class="icon-btn" data-act="name-hide" disabled={busy} onclick={() => resolve(it, 'hide')}>가리기</button>
            <button class="icon-btn" data-act="name-dismiss" disabled={busy} onclick={() => resolve(it, 'dismiss')}>기각</button>
          </div>
        </li>
      {:else}
        <li class="muted">처리할 이름 신고가 없어요.</li>
      {/each}
    </ul>
  </LoadState>
</div>

<style>
  .admin-names { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
  .admin-names li { display: flex; flex-direction: column; gap: 4px; padding: 10px 0; border-bottom: 1px solid var(--line); }
</style>
