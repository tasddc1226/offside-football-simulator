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
  import { goFairness } from './nav.js';
  import { namePublicEnabled, setNamePublic } from '@offside/app-core/namePublic';
  import ClubCustomSettings from './ClubCustomSettings.svelte';
  import BackupSettings from './BackupSettings.svelte';
  import AppMoveCard from './AppMoveCard.svelte';
  import { settingsText as L } from '@offside/app-core/i18n/ko/settings';
  import { getLocale, LOCALE_NAMES, LOCALES, type Locale } from '@offside/app-core/i18n/core';
  import { changeLocale } from './locale.js';
  let sfx = $state(sfxEnabled());
  let dark = $state(isDark());
  let namePublic = $state(namePublicEnabled());

</script>

<div class="wrap">
  <Topbar />
  <header class="settings-head">
    <div class="eyebrow">Settings</div>
    <h1>{L.title}</h1>
  </header>

  <section class="card settings-card">
    <div class="settings-row">
      <div class="settings-label">
        <small class="eyebrow">Display</small>
        <strong id="dark-label">{L.darkTitle}</strong>
        <span class="muted">{L.darkBodyWeb}</span>
      </div>
      <button class="switch" role="switch" aria-checked={dark} aria-labelledby="dark-label" data-setting="dark" onclick={() => setDark((dark = !dark))}></button>
    </div>
    <div class="settings-row">
      <div class="settings-label">
        <strong id="lang-label">{L.langTitle}</strong>
        <span class="muted">{L.langBody}</span>
      </div>
      <select class="settings-lang" aria-labelledby="lang-label" data-setting="lang" value={getLocale()} onchange={(e) => changeLocale(e.currentTarget.value as Locale)}>
        {#each LOCALES as l (l)}
          <option value={l} lang={l}>{LOCALE_NAMES[l]}</option>
        {/each}
      </select>
    </div>
    {#if skin.desktop}
    <div class="settings-row">
      <div class="settings-label">
        <strong id="sheet-label">{L.sheetTitle}</strong>
        <span class="muted">{L.sheetBodyBefore}<kbd>`</kbd>{L.sheetBodyAfter}</span>
      </div>
      <button class="switch" role="switch" aria-checked={skin.pref} aria-labelledby="sheet-label" data-setting="sheet-skin" onclick={() => setSheetSkin(!skin.pref)}></button>
    </div>
    {/if}
  </section>

  <section class="card settings-card">
    <div class="settings-row">
      <div class="settings-label">
        <small class="eyebrow">Sound</small>
        <strong id="sfx-label">{L.sfxTitle}</strong>
        <span class="muted">{L.sfxBody}</span>
      </div>
      <button class="switch" role="switch" aria-checked={sfx} aria-labelledby="sfx-label" data-setting="sfx" onclick={() => setSfxEnabled((sfx = !sfx))}></button>
    </div>
    <div class="settings-row">
      <div class="settings-label">
        <strong id="bgm-label">{L.bgmTitle}</strong>
        <span class="muted">{L.bgmBody}</span>
      </div>
      <button class="switch" role="switch" aria-checked={bgm.on} aria-labelledby="bgm-label" data-setting="bgm" onclick={() => setBgm(!bgm.on)}></button>
    </div>
    {#if volumeAdjustable()}
    <div class="settings-volume" class:off={!bgm.on}>
      <label for="bgm-volume">{L.bgmVolume}</label>
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
    <p class="muted fs-xs settings-volume-note" data-setting="bgm-volume-note">{L.bgmVolumeNote}</p>
    {/if}
    <p class="muted fs-xs settings-credit">
      {L.musicCredit} Happy Wheels — <a href="https://ludoloonstudio.itch.io/happy-wheels-free-music" target="_blank" rel="noopener">LudoLoon Studio</a> · Deep House Lounge — <a href="https://pixabay.com/users/tunetank-50201703/" target="_blank" rel="noopener">Tunetank</a>
    </p>
  </section>

  <section class="card settings-card">
    <div class="settings-row">
      <div class="settings-label">
        <small class="eyebrow">Privacy</small>
        <strong id="name-public-label">{L.namePublicTitle}</strong>
        <span class="muted">{L.namePublicBody}</span>
      </div>
      <button class="switch" role="switch" aria-checked={namePublic} aria-labelledby="name-public-label" data-setting="name-public" onclick={() => setNamePublic((namePublic = !namePublic))}></button>
    </div>
  </section>

  <!-- T-11-092 iPhone 앱으로 옮기기(바로 아래 백업 코드와 이어진다) -->
  <AppMoveCard />
  <!-- T-10-116 진행 중 커리어 백업·불러오기 -->
  <BackupSettings />
  <ClubCustomSettings />
  <AnalyticsConsent settings />

  <section class="settings-group" aria-labelledby="settings-help">
    <div class="eyebrow">Help</div>
    <h2 id="settings-help">{L.help}</h2>
    <nav class="card settings-links" aria-label={L.help}>
      <button data-act="install-guide" onclick={() => showInstallGuide()}>{L.installGuide} <span aria-hidden="true">›</span></button>
      <a href="/guide/">{L.guide} <span aria-hidden="true">›</span></a>
      <a href="/faq/">{L.faq} <span aria-hidden="true">›</span></a>
      <button data-act="fairness" onclick={goFairness}>{L.fairness} <span aria-hidden="true">›</span></button>
    </nav>
  </section>

  <section class="settings-group" aria-labelledby="settings-legal">
    <div class="eyebrow">Legal</div>
    <h2 id="settings-legal">{L.legal}</h2>
    <nav class="card settings-links" aria-label={L.legal}>
      <a href="/legal/terms/">{L.terms} <span aria-hidden="true">›</span></a>
      <a href="/legal/privacy/">{L.privacy} <span aria-hidden="true">›</span></a>
    </nav>
  </section>

  <SiteFooter />
</div>
