<script lang="ts">
  // T-10-016 운영 도구(관리자 전용). 게임과 무관해 메인 번들과 떼어 처음 열 때 불러온다.
  // 관리자 여부는 서버가 요청마다 다시 확인한다 — 여기서는 화면만 가린다.
  import { onMount } from 'svelte';
  import { fetchBoardViewer } from '../api/boards.js';
  import { appState } from './state.svelte.js';
  import Topbar from './Topbar.svelte';
  import AdminBalance from './admin/AdminBalance.svelte';
  import AdminComments from './admin/AdminComments.svelte';
  import AdminDashboard from './admin/AdminDashboard.svelte';

  const TABS = [
    { id: 'dashboard', label: '대시보드' },
    { id: 'comments', label: '댓글' },
    { id: 'balance', label: '밸런스' },
  ] as const;
  let tab = $state<(typeof TABS)[number]['id']>('dashboard');
  let admin = $state<boolean | null>(null);

  onMount(() => {
    void fetchBoardViewer().then((r) => (admin = r.ok && r.data.admin));
  });
</script>

<div class="wrap">
  <Topbar>
    {#snippet right()}
      <button class="icon-btn" data-act="settings" onclick={() => (appState.screen = 'settings')}>← 설정</button>
    {/snippet}
  </Topbar>
  <section class="card stack" style="gap:14px">
    <div>
      <div class="eyebrow">Admin</div>
      <h1>운영 도구</h1>
    </div>
    {#if admin === null}
      <p class="muted" aria-live="polite">확인하는 중…</p>
    {:else if !admin}
      <p class="muted">운영자 계정으로 로그인해야 볼 수 있어요.</p>
    {:else}
      <div class="seg three admin-tabs" role="group" aria-label="운영 도구">
        {#each TABS as t (t.id)}
          <button class="opt" aria-pressed={tab === t.id} data-admin-tab={t.id} onclick={() => (tab = t.id)}>{t.label}</button>
        {/each}
      </div>
      {#if tab === 'dashboard'}<AdminDashboard />
      {:else if tab === 'comments'}<AdminComments />
      {:else}<AdminBalance />{/if}
    {/if}
  </section>
</div>

