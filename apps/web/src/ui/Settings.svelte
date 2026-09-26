<script lang="ts">
  // 환경설정 화면(T-10-009, T-10-021). 계정(구글 로그인) 카드 아래로 항목마다 카드를 둔다 — 다크 모드·효과음 켜기/끄기,
  // 접히는 "구단 이름·엠블럼 변경"(ClubCustomSettings), 운영 도구(관리자),
  // 도움말·서비스 정책 링크. 다크 모드·효과음 설정은 이 기기에만 저장된다.
  import { goHome } from './nav.js';
  import Topbar from './Topbar.svelte';
  import ClubCustomSettings from './ClubCustomSettings.svelte';
  import { setSfxEnabled, sfxEnabled } from './sfx.js';
  import { isDark, setDark } from './theme.js';
  import { showInstallGuide } from './install.js';
  import { fetchBoardViewer } from '../api/boards.js';
  import { appState } from './state.svelte.js';
  import { accountCache } from './account-state.svelte.js';
  import Account from './Account.svelte';

  let sfx = $state(sfxEnabled());
  let dark = $state(isDark());
  // T-10-016: 운영자에게만 운영 도구 입구를 보인다. 관리자는 구글 연결 계정이라, 연결된 계정일 때만
  // 서버에 묻는다(10분 메모 — 익명 사용자는 요청이 나가지 않는다). 계정 패널이 로그인 상태를 불러오거나
  // 바꾸면 다시 판단한다.
  let admin = $state(false);
  const linked = $derived.by(() => {
    const acct = accountCache.value;
    return !!acct && acct !== 'error' && acct.linked.google;
  });
  $effect(() => {
    if (linked) void fetchBoardViewer().then((r) => (admin = linked && r.ok && r.data.admin));
    else admin = false;
  });
</script>

<div class="wrap">
  <Topbar>
    {#snippet right()}
      <button class="icon-btn" data-act="home" onclick={goHome}>← 홈</button>
    {/snippet}
  </Topbar>
  <header class="settings-head">
    <div class="eyebrow">Settings</div>
    <h1>환경설정</h1>
  </header>

  <section class="card settings-card" id="account-slot" aria-label="계정">
    <Account {admin} />
  </section>

  <section class="card settings-card">
    <div class="settings-row">
      <div class="settings-label">
        <small class="eyebrow">Display</small>
        <strong id="dark-label">다크 모드</strong>
        <span class="muted">어두운 화면으로 봐요. 이 기기에 저장됩니다.</span>
      </div>
      <button class="switch" role="switch" aria-checked={dark} aria-labelledby="dark-label" data-setting="dark" onclick={() => setDark((dark = !dark))}></button>
    </div>
  </section>

  <section class="card settings-card">
    <div class="settings-row">
      <div class="settings-label">
        <small class="eyebrow">Sound</small>
        <strong id="sfx-label">효과음</strong>
        <span class="muted">버튼을 누를 때 클릭 소리를 내요.</span>
      </div>
      <button class="switch" role="switch" aria-checked={sfx} aria-labelledby="sfx-label" data-setting="sfx" onclick={() => setSfxEnabled((sfx = !sfx))}></button>
    </div>
  </section>

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

  <section class="settings-group" aria-labelledby="settings-help">
    <div class="eyebrow">Help</div>
    <h2 id="settings-help">도움말</h2>
    <nav class="card settings-links" aria-label="도움말">
      <button data-act="install-guide" onclick={() => showInstallGuide()}>홈 화면에 추가하기 <span aria-hidden="true">›</span></button>
      <a href="/guide/">게임 가이드 <span aria-hidden="true">›</span></a>
      <a href="/faq/">자주 묻는 질문 <span aria-hidden="true">›</span></a>
    </nav>
  </section>

  <section class="settings-group" aria-labelledby="settings-legal">
    <div class="eyebrow">Legal</div>
    <h2 id="settings-legal">서비스 정책</h2>
    <nav class="card settings-links" aria-label="서비스 정책">
      <a href="/legal/terms/">이용약관 <span aria-hidden="true">›</span></a>
      <a href="/legal/privacy/">개인정보 처리방침 <span aria-hidden="true">›</span></a>
    </nav>
  </section>

  <footer class="settings-foot">
    <p>문의 <a href="mailto:contact@offside-lab.com">contact@offside-lab.com</a></p>
    <p>Instagram <a href="https://www.instagram.com/offside.lab.kr/" target="_blank" rel="noopener noreferrer">@offside.lab.kr</a></p>
  </footer>
</div>
