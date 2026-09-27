<script lang="ts">
  // 환경설정 화면(T-10-009, T-10-021) — 다크 모드·효과음·선수 이름 공개(T-10-065) 켜기/끄기, 도움말·서비스 정책 링크.
  // 이 설정들은 이 기기에만 저장된다. 계정·구단 꾸미기·운영 도구는 구단주 화면으로 옮겼다(T-10-058).
  import Topbar from './Topbar.svelte';
  import { setSfxEnabled, sfxEnabled } from './sfx.js';
  import { isDark, setDark } from './theme.js';
  import SiteFooter from './SiteFooter.svelte';
  import { showInstallGuide } from './install.js';
  import { namePublicEnabled, setNamePublic } from './namePublic.js';

  let sfx = $state(sfxEnabled());
  let dark = $state(isDark());
  let namePublic = $state(namePublicEnabled());
</script>

<div class="wrap">
  <Topbar />
  <header class="settings-head">
    <div class="eyebrow">Settings</div>
    <h1>환경설정</h1>
  </header>

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

  <section class="card settings-card">
    <div class="settings-row">
      <div class="settings-label">
        <small class="eyebrow">Privacy</small>
        <strong id="name-public-label">선수 이름 공개</strong>
        <span class="muted">홈 라이브 현황·명예의 전당·서버 최초 업적에 선수 이름이 보여요. 끄면 '익명의 공격수'처럼 표시되고, 다음 시즌 기록부터 반영돼요. 실명은 쓰지 않는 것을 권장합니다.</span>
      </div>
      <button class="switch" role="switch" aria-checked={namePublic} aria-labelledby="name-public-label" data-setting="name-public" onclick={() => setNamePublic((namePublic = !namePublic))}></button>
    </div>
  </section>

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

  <SiteFooter />
</div>
