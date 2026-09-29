<script lang="ts">
  // 구단주 화면(T-10-058) — 게임 속 사용자 프로필. 환경설정에 있던 계정(구글 로그인·닉네임) 카드와
  // 구단 이름·엠블럼 변경, 운영 도구(관리자) 입구, 명예의 전당에 있던 '내 선수'를 이리로 옮겼다.
  import Topbar from './Topbar.svelte';
  import ClubCustomSettings from './ClubCustomSettings.svelte';
  import { fetchBoardViewer } from '../api/boards.js';
  import { appState } from './state.svelte.js';
  import { accountCache } from './account-state.svelte.js';
  import Account from './Account.svelte';
  import MyPlayers from './MyPlayers.svelte';
  import { startGoogleLogin } from './login.js';
  import { go } from './nav.js';

  // T-10-016: 운영자에게만 운영 도구 입구를 보인다. 관리자는 구글 연결 계정이라, 연결된 계정일 때만
  // 서버에 묻는다(10분 메모 — 익명 사용자는 요청이 나가지 않는다). 계정 패널이 로그인 상태를 불러오거나
  // 바꾸면 다시 판단한다.
  let admin = $state(false);
  const linked = $derived.by(() => {
    const acct = accountCache.value;
    return !!acct && acct !== 'error' && acct.linked.google;
  });
  // T-10-092 내 팀: 계정 상태를 아직 모르면(확인 중·연결 실패) 입구를 그리지 않는다.
  const known = $derived(accountCache.value !== undefined && accountCache.value !== 'error');
  $effect(() => {
    if (linked) void fetchBoardViewer().then((r) => (admin = linked && r.ok && r.data.admin));
    else admin = false;
  });
</script>

<div class="wrap">
  <Topbar />
  <header class="settings-head">
    <div class="eyebrow">Owner</div>
    <h1>구단주</h1>
  </header>

  <section class="card settings-card" id="account-slot" aria-label="계정">
    <Account {admin} />
  </section>

  {#if known}
    <section class="card settings-card" aria-label="내 팀" data-owner-team>
      {#if linked}
        <button class="settings-row settings-trigger" data-act="team" onclick={() => go('team')}>
          <span class="settings-label">
            <small class="eyebrow">My team</small>
            <strong>내 팀 · 시즌 업적</strong>
            <span class="muted">은퇴한 선수로 팀을 꾸려 겨루고, 시즌마다 구단 업적을 채워요</span>
          </span>
          <i class="settings-chev" aria-hidden="true">›</i>
        </button>
      {:else}
        <div class="account-card">
          <div class="who"><b>내 팀</b><span class="muted">구글로 로그인한 구단주만 은퇴한 선수로 팀을 꾸릴 수 있어요.</span></div>
          <button class="btn btn-primary btn-sm" data-act="team-login" onclick={() => void startGoogleLogin(null)}>구글로 로그인</button>
        </div>
      {/if}
    </section>
  {/if}

  <MyPlayers />

  <ClubCustomSettings />

  {#if admin}
    <section class="card settings-card">
      <button class="settings-row settings-trigger" data-act="admin" onclick={() => (appState.screen = 'admin')}>
        <span class="settings-label">
          <small class="eyebrow">Admin</small>
          <strong>운영 도구</strong>
        </span>
        <i class="settings-chev" aria-hidden="true">›</i>
      </button>
    </section>
  {/if}
</div>
