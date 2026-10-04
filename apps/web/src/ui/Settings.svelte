<script lang="ts">
  // 환경설정 화면(T-10-009, T-10-021) — 다크 모드·효과음·배경음악·선수 이름 공개(T-10-065) 켜기/끄기, 도움말·서비스 정책 링크.
  // 이 설정들은 이 기기에만 저장된다. 계정·운영 도구는 구단주 화면으로 옮겼다(T-10-058).
  // T-10-102 구단 이름·엠블럼 변경은 구단주 화면에서 다시 이리로 — 게임 표시를 바꾸는 설정이라서.
  import AnalyticsConsent from './AnalyticsConsent.svelte';
  import Topbar from './Topbar.svelte';
  import { setSfxEnabled, sfxEnabled } from './sfx.js';
  import { bgm, setBgm, setBgmVolume } from './bgm.svelte.js';
  import { volumeAdjustable } from './bgmEngine.js';
  import { isDark, setDark } from './theme.js';
  import { setSheetSkin, skin } from './skin.svelte.js';
  import SiteFooter from './SiteFooter.svelte';
  import { showInstallGuide } from './install.js';
  import { namePublicEnabled, setNamePublic } from '@offside/app-core/namePublic';
  import ClubCustomSettings from './ClubCustomSettings.svelte';
  import BackupSettings from './BackupSettings.svelte';
  import { toast } from './helpers.js';
  import { copyText } from './inapp-open.js';

  // T-11-051 개발자 후원 계좌. 앱 스토어는 개발자 후원을 인앱 결제로만 허용해서 웹에만 둔다.
  const DONATE_ACCOUNT = '토스뱅크 1000-1599-4723 양*영';

  let sfx = $state(sfxEnabled());
  let dark = $state(isDark());
  let namePublic = $state(namePublicEnabled());

  async function copyAccount() {
    toast((await copyText(DONATE_ACCOUNT)) ? '계좌번호를 복사했어요. 고마워요' : '복사하지 못했어요. 아래 계좌번호를 직접 적어 주세요');
  }
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
        <span class="muted">어두운 화면으로 봐요. 이 기기에 저장돼요.</span>
      </div>
      <button class="switch" role="switch" aria-checked={dark} aria-labelledby="dark-label" data-setting="dark" onclick={() => setDark((dark = !dark))}></button>
    </div>
    {#if skin.desktop}
    <div class="settings-row">
      <div class="settings-label">
        <strong id="sheet-label">업무 모드</strong>
        <span class="muted">게임 화면을 스프레드시트처럼 보이게 하고 배경음악·효과음을 꺼요. 키보드 <kbd>`</kbd>(숫자 1 왼쪽 키)로 언제든 바로 켜고 끌 수 있어요. PC 브라우저에서만 적용되고 이 기기에 저장돼요.</span>
      </div>
      <button class="switch" role="switch" aria-checked={skin.pref} aria-labelledby="sheet-label" data-setting="sheet-skin" onclick={() => setSheetSkin(!skin.pref)}></button>
    </div>
    {/if}
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
    <div class="settings-row">
      <div class="settings-label">
        <strong id="bgm-label">배경음악</strong>
        <span class="muted">게임을 하는 동안 음악을 틀어요. 기록실과 선수 상세에서는 다른 곡이 흘러요. 화면 위쪽 스피커 버튼으로도 켜고 끌 수 있어요.</span>
      </div>
      <button class="switch" role="switch" aria-checked={bgm.on} aria-labelledby="bgm-label" data-setting="bgm" onclick={() => setBgm(!bgm.on)}></button>
    </div>
    {#if volumeAdjustable()}
    <div class="settings-volume" class:off={!bgm.on}>
      <label for="bgm-volume">배경음악 음량</label>
      <input
        id="bgm-volume"
        type="range"
        min="0"
        max="100"
        step="5"
        value={bgm.volume}
        data-setting="bgm-volume"
        oninput={(e) => setBgmVolume(e.currentTarget.valueAsNumber)}
      />
      <output for="bgm-volume" class="num">{bgm.volume}%</output>
    </div>
    {:else}
    <p class="muted fs-xs settings-volume-note" data-setting="bgm-volume-note">이 기기에서는 배경음악 음량을 기기 음량 버튼으로 조절해요.</p>
    {/if}
    <p class="muted fs-xs settings-credit">
      음악: Happy Wheels — <a href="https://ludoloonstudio.itch.io/happy-wheels-free-music" target="_blank" rel="noopener">LudoLoon Studio</a> · Deep House Lounge — <a href="https://pixabay.com/users/tunetank-50201703/" target="_blank" rel="noopener">Tunetank</a>
    </p>
  </section>

  <section class="card settings-card">
    <div class="settings-row">
      <div class="settings-label">
        <small class="eyebrow">Privacy</small>
        <strong id="name-public-label">선수 이름 공개</strong>
        <span class="muted">홈 라이브 현황·명예의 전당·서버 최초 업적에 선수 이름이 보여요. 끄면 '익명의 공격수'처럼 표시되고, 다음 시즌 기록부터 반영돼요. 실명은 쓰지 않는 게 좋아요.</span>
      </div>
      <button class="switch" role="switch" aria-checked={namePublic} aria-labelledby="name-public-label" data-setting="name-public" onclick={() => setNamePublic((namePublic = !namePublic))}></button>
    </div>
  </section>

  <!-- T-10-116 진행 중 커리어 백업·불러오기 -->
  <BackupSettings />
  <ClubCustomSettings />
  <AnalyticsConsent settings />

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

  <section class="settings-group" aria-labelledby="settings-support">
    <div class="eyebrow">Support</div>
    <h2 id="settings-support">개발자 응원하기</h2>
    <div class="card settings-links">
      <button data-act="coffee" onclick={copyAccount}>☕ 커피 한잔 사주기 <span aria-hidden="true">›</span></button>
    </div>
    <p class="muted fs-xs settings-credit">
      재밌게 즐기셨다면 커피 한잔 사 주세요. 누르면 계좌번호가 복사돼요.<br />{DONATE_ACCOUNT}
    </p>
  </section>

  <SiteFooter />
</div>
