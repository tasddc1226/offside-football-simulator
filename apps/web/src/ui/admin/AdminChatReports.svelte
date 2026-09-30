<script lang="ts">
  // T-11-015 채팅 신고 처리(앱스토어 UGC 정책): 처리하지 않은 신고를 메시지마다 모아 본다. 본문은 신고할 때 남긴
  // 사본이라 메시지가 방에서 지워진 뒤(7일)에도 보이고, 작성자를 정지할 수 있다. 여럿이 신고한 메시지는 이미 가려져 있다.
  import { onMount } from 'svelte';
  import { CHAT_MUTE_DAYS } from '@offside/contracts/chat';
  import * as api from '@offside/app-core/api/chat';
  import type { AdminChatReport } from '@offside/app-core/api/chat';
  import { REPORT_REASON_LABEL, kstDateTime as kst } from '@offside/app-core/boardText';
  import { toast } from '../helpers.js';
  import LoadState, { type LoadStatus } from '../LoadState.svelte';

  let items = $state<AdminChatReport[]>([]);
  let status = $state<LoadStatus>('loading');
  let busy = $state(false);

  onMount(() => void load());

  async function load() {
    status = 'loading';
    const r = await api.fetchChatReports();
    if (!r.ok) return (status = 'error');
    items = r.data.items;
    status = 'ready';
  }
  async function resolve(it: AdminChatReport, action: 'hide' | 'dismiss' | (typeof CHAT_MUTE_DAYS)[number]) {
    const mute = typeof action === 'number';
    if (mute && !confirm(`${it.nickname}님의 채팅을 ${action}일 정지할까요? 이 메시지도 가려져요.`)) return;
    busy = true;
    const r = await api.resolveChatReport(
      mute ? { messageId: it.messageId, action: 'mute', days: action } : { messageId: it.messageId, action },
    );
    busy = false;
    if (!r.ok) return toast(r.error.message);
    toast(mute ? `${it.nickname}님을 ${action}일 정지했어요` : action === 'hide' ? '메시지를 가렸어요' : '신고를 기각했어요');
    items = items.filter((x) => x.messageId !== it.messageId);
  }
</script>

<div class="stack" style="gap:12px" data-admin="chat-reports">
  <div class="row" style="justify-content:space-between">
    <h2 style="margin:0">채팅 신고</h2>
    <button class="icon-btn" onclick={() => load()}>새로고침</button>
  </div>
  <LoadState {status} failText="채팅 신고를 불러오지 못했어요." retry={load}>
    <ul class="admin-chat">
      {#each items as it (it.messageId)}
        <li data-chat-report={it.messageId}>
          <div class="row" style="gap:6px;flex-wrap:wrap">
            <b>{it.nickname}</b>
            <span class="pill warn">신고 {it.reports}</span>
            {#each it.reasons as r (r)}<span class="pill">{REPORT_REASON_LABEL[r]}</span>{/each}
          </div>
          <p>{it.body}</p>
          <span class="muted fs-xs">마지막 신고 {kst(it.lastReportedAt)}</span>
          <div class="row" style="gap:6px;flex-wrap:wrap">
            <button class="icon-btn" data-act="chat-report-hide" disabled={busy} onclick={() => resolve(it, 'hide')}>가리기</button>
            <button class="icon-btn" data-act="chat-report-dismiss" disabled={busy} onclick={() => resolve(it, 'dismiss')}>기각</button>
            {#each CHAT_MUTE_DAYS as d (d)}
              <button class="icon-btn" data-act="chat-report-mute" disabled={busy} onclick={() => resolve(it, d)}>{d}일 정지</button>
            {/each}
          </div>
        </li>
      {:else}
        <li class="muted">처리할 채팅 신고가 없어요.</li>
      {/each}
    </ul>
  </LoadState>
</div>

<style>
  .admin-chat { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
  .admin-chat li { display: flex; flex-direction: column; gap: 4px; padding: 10px 0; border-bottom: 1px solid var(--line); }
  .admin-chat p { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
