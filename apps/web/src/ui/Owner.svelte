<script lang="ts">
  // 구단주 화면(T-10-058) — 게임 속 사용자 프로필. 환경설정에 있던 계정(구글 로그인·닉네임) 카드와
  // 운영 도구(관리자) 입구, 명예의 전당에 있던 '내 선수'를 이리로 옮겼다.
  // T-10-102 비로그인이면 계정 카드는 안내만, 구글 로그인 버튼은 카드 밖에 하나만 두고 로그인해야 쓰는 '내 팀'은 숨긴다.
  // 구단 이름·엠블럼 변경은 환경설정으로 옮겼다.
  import Topbar from './Topbar.svelte';
  import { fetchBoardViewer } from '../api/boards.js';
  import { appState } from './state.svelte.js';
  import { accountCache } from './account-state.svelte.js';
  import Account from './Account.svelte';
  import MyPlayers from './MyPlayers.svelte';
  import { loadHOF } from '@offside/game/season';
  import { startGoogleLogin } from './login.js';
  import { go } from './nav.js';
  import { googleStartUrl } from '../api/client.js';

  // T-10-016: 운영자에게만 운영 도구 입구를 보인다. 관리자는 구글 연결 계정이라, 연결된 계정일 때만
  // 서버에 묻는다(10분 메모 — 익명 사용자는 요청이 나가지 않는다). 계정 패널이 로그인 상태를 불러오거나
  // 바꾸면 다시 판단한다.
  let admin = $state(false);
  const linked = $derived.by(() => {
    const acct = accountCache.value;
    return !!acct && acct !== 'error' && acct.linked.google;
  });
  // T-10-103 비로그인으로 확인됐고 이 기기에 은퇴한 선수도 없으면 빈 '내 선수'를 숨긴다(확인 중·연결 실패면 그대로 둔다).
  const hasLocal = loadHOF().length > 0;
  // 로그인 안 함(익명 프로필이거나 세션 없음). 확인 중·연결 실패는 아니다.
  const guest = $derived.by(() => {
    const acct = accountCache.value;
    return acct === null || (!!acct && acct !== 'error' && !acct.linked.google);
  });
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

  {#if guest}
    <!-- 로그아웃·탈퇴 직후엔 세션 쿠키가 없으므로 링크로 바로 가지 않고 startGoogleLogin이 새 익명 세션부터 받는다. -->
    <a class="btn btn-primary btn-block owner-login" data-act="google-login" href={googleStartUrl()} onclick={(e) => { e.preventDefault(); void startGoogleLogin(null); }}>구글로 로그인</a>
  {/if}

  <!-- T-10-092 내 팀: 구글로 로그인한 구단주만 — 확인 중·비로그인·연결 실패면 그리지 않는다. -->
  {#if linked}
    <section class="card settings-card" aria-label="내 팀" data-owner-team>
      <button class="settings-row settings-trigger" data-act="team" onclick={() => ((appState.teamView = 'team'), go('team'))}>
        <span class="settings-label">
          <small class="eyebrow">My team</small>
          <strong>내 팀 · 시즌 업적</strong>
          <span class="muted">시즌마다 은퇴한 선수로 팀을 꾸려 겨루고, 라이브 랭킹과 구단 업적을 채워요</span>
        </span>
        <i class="settings-chev" aria-hidden="true">›</i>
      </button>
    </section>
  {/if}

  {#if !guest || hasLocal}<MyPlayers />{/if}

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
