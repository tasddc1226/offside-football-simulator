<script lang="ts">
  // T-11-177 친구 초대 현황(T-11-171). 초대 수 · 첫 커리어를 마친 수 · 지급된 리롤권, 초대를 많이 한 구단주와 최근 초대.
  // 근거는 api `db/repos/referrals.ts`의 inviteReport.
  import { onMount } from 'svelte';
  import LoadState, { type LoadStatus } from '../LoadState.svelte';
  import * as api from '@offside/app-core/api/admin';
  import type { AdminInviteReport } from '@offside/app-core/api/admin';
  import { kstDateTime as kst } from '@offside/app-core/boardText';

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
  <p class="muted fs-xs" style="margin:0">
    친구 코드로 신청한 새 구단주가 초대예요. 첫 커리어를 마치면 초대받은 사람은 늘, 초대한 사람은 10명까지 리롤권을 받아요.
  </p>
  <LoadState {status} failText="친구 초대 현황을 불러오지 못했어요." retry={load}>
    {@const r = report!}
    <p class="fs-sm" style="margin:0">{kst(r.generatedAt)} 기준</p>
    <dl class="sums" data-invites-summary>
      <dt>초대</dt><dd data-invites-total>{r.invites.toLocaleString()}건</dd>
      <dt>초대한 구단주</dt><dd>{r.inviters.toLocaleString()}명</dd>
      <dt>첫 커리어를 마침</dt><dd data-invites-done>{r.done.toLocaleString()}건</dd>
      <dt>초대한 쪽 보상</dt><dd>{r.inviterRewarded.toLocaleString()}건</dd>
      <dt>지급된 리롤권</dt><dd data-invites-rerolls>{r.rerolls.toLocaleString()}장</dd>
    </dl>

    <h3 class="fs-sm" style="margin:0">초대를 많이 한 구단주</h3>
    <ul class="list">
      {#each r.top as t (t.profileId)}
        <li data-inviter={t.profileId}>
          <span>{t.nickname ?? '닉네임 없음'} <small class="muted">{t.profileId}</small></span>
          <b>{t.invited}명 · 마침 {t.done} · 보상 {t.rewarded}</b>
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
            {v.inviterNickname ?? '닉네임 없음'} → {v.inviteeNickname ?? '닉네임 없음'}
            <small class="muted">{kst(v.claimedAt)}</small>
          </span>
          <b class:good={v.doneAt}>{v.doneAt ? `마침 ${kst(v.doneAt)}` : '진행 중'}</b>
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
