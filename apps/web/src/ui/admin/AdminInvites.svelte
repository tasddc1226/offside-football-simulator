<script lang="ts">
  // T-11-177 친구 초대 현황(T-11-171). 초대 수 · 첫 커리어를 마친 수 · 지급된 리롤권, 초대를 많이 한 구단주와 최근 초대.
  // 근거는 api `db/repos/referrals.ts`의 inviteReport.
  import { onMount } from 'svelte';
  import LoadState, { type LoadStatus } from '../LoadState.svelte';
  import * as api from '@offside/app-core/api/admin';
  import type { AdminInviteReport } from '@offside/app-core/api/admin';
  import { kstDateTime as kst } from '@offside/app-core/boardText';
  import { INVITE_NOTE, invitePair, inviteState, inviteSummary, inviterLine, nick } from '@offside/app-core/admin/invites';

  let report = $state<AdminInviteReport | null>(null);
  let status = $state<LoadStatus>('loading');

  onMount(() => void load());

  async function load() {
    status = 'loading';
    const r = await api.fetchInviteReport();
    if (!r.ok) {
      status = 'error';
      return;
    }
    report = r.data;
    status = 'ready';
  }
</script>

<div class="stack" style="gap:14px" data-admin="invites">
  <div class="row" style="justify-content:space-between">
    <h2 style="margin:0">친구 초대 현황</h2>
    <button class="icon-btn" data-act="refresh-invites" onclick={load}>새로고침</button>
  </div>
  <p class="muted fs-xs" style="margin:0">{INVITE_NOTE}</p>
  <LoadState {status} failText="친구 초대 현황을 불러오지 못했어요." retry={load}>
    {@const r = report!}
    <p class="fs-sm" style="margin:0">{kst(r.generatedAt)} 기준</p>
    <dl class="sums" data-invites-summary>
      {#each inviteSummary(r) as [label, v] (label)}<dt>{label}</dt><dd>{v}</dd>{/each}
    </dl>

    <h3 class="fs-sm" style="margin:0">초대를 많이 한 구단주</h3>
    <ul class="list">
      {#each r.top as t (t.profileId)}
        <li data-inviter={t.profileId}>
          <span>{nick(t.nickname)} <small class="muted">{t.profileId}</small></span>
          <b>{inviterLine(t)}</b>
        </li>
      {:else}
        <li class="muted">아직 초대가 없어요.</li>
      {/each}
    </ul>

    <h3 class="fs-sm" style="margin:0">최근 초대</h3>
    <ul class="list">
      {#each r.recent as v (v.inviteeId)}
        <li data-invite={v.inviteeId}>
          <span>
            {invitePair(v)}
            <small class="muted">{kst(v.claimedAt)}</small>
          </span>
          <b class:good={v.doneAt}>{inviteState(v)}</b>
        </li>
      {:else}
        <li class="muted">아직 초대가 없어요.</li>
      {/each}
    </ul>
  </LoadState>
</div>

<style>
  .sums { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; margin: 0; font-size: 0.8125rem; }
  .sums dd { margin: 0; text-align: right; font-variant-numeric: tabular-nums; }
  .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
  .list li { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 6px 0; border-top: 1px solid var(--line); font-size: 0.8125rem; }
  .list small { display: block; }
  .list b { text-align: right; font-variant-numeric: tabular-nums; }
  .good { color: var(--good); }
</style>
