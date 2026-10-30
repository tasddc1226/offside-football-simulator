<script lang="ts" module>
  // 보임은 페이지 방문당 한 번만 센다(홈에 다시 와도 다시 세지 않는다).
  let viewed = false;
</script>

<script lang="ts">
  // T-11-506 휴대폰 웹 홈 맨 위 한 줄 앱 안내. 기기 안 정보(기기 종류 · 닫은 날)만으로 첫 화면에서 바로 띄울지 정해 나중에 끼어들며
  // 화면을 밀지 않는다. 자세한 안내(혜택 · 커리어 옮기기)는 아래 AppConversion 카드에 그대로 둔다. 닫으면 카드와 함께 7일 숨긴다.
  // 광고로 들어온 방문은 먼저 플레이하게 두고, 인앱 브라우저 안내가 떠 있으면 그 안내만 보인다. 스토어 주소는 지연 청크에서 채운다.
  import { onMount } from 'svelte';
  import { loadKey } from '@offside/game/storage';
  import { shellInstallText as L } from '@offside/app-core/i18n/ko/shellInstall';
  import { trackAppConversion, trackAppStoreClick } from '../analytics/index.js';
  import { osOf } from './inapp.js';
  import { INAPP_HINT_KEY, currentInApp } from './inapp-open.js';
  import { adLanded, playedEnough } from './adLanding.js';
  import { conversionNotice, dismissConversionNotice, restoreConversionNotice } from './appConversion.svelte.js';

  const os = osOf(navigator.userAgent);
  restoreConversionNotice();
  const eligible =
    os !== 'other' &&
    !(currentInApp() && loadKey<boolean>(INAPP_HINT_KEY) !== true) &&
    !(adLanded() && !playedEnough());
  const visible = $derived(eligible && conversionNotice.until <= Date.now());
  let href = $state<string | undefined>();
  let inPlace = $state(false);

  onMount(() => {
    if (!visible || os === 'other') return;
    if (!viewed) {
      viewed = true;
      trackAppConversion('view', 'home_top', os);
    }
    void import('./appStore.js').then(({ storeUrl, opensInPlace }) => {
      href = storeUrl(os);
      inPlace = opensInPlace(href);
    });
  });

  function click() {
    if (os === 'other') return;
    trackAppConversion('click', 'home_top', os);
    trackAppStoreClick('home_top', os);
  }
  function dismiss() {
    if (os !== 'other') trackAppConversion('dismiss', 'home_top', os);
    dismissConversionNotice();
  }
</script>

{#if visible}
  <aside class="app-strip" data-app-strip={os} aria-label={L.conversionTitle}>
    <span class="app-strip-text">{L.conversionTitle}</span>
    <a class="btn btn-accent btn-sm" data-act="app-strip-store" {href} target={inPlace ? undefined : '_blank'} rel="noopener noreferrer" onclick={click}>{L.stripGet}</a>
    <button class="icon-btn app-strip-close" data-act="app-strip-close" aria-label={L.conversionDismiss} onclick={dismiss}>✕</button>
  </aside>
{/if}

<style>
  .app-strip {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 48px;
    margin-block: 8px;
    padding: 4px 0 4px 14px;
    border: 1px solid var(--line);
    border-left: 3px solid var(--accent);
    border-radius: 12px;
    background: var(--surface);
  }
  .app-strip-text {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    font-size: var(--fs-body2);
    font-weight: 600;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .app-strip a {
    flex: none;
  }
  .app-strip-close {
    flex: none;
    min-width: 44px;
    min-height: 44px;
    display: grid;
    place-items: center;
    padding: 0;
    border: 0;
    background: none;
    color: var(--muted);
  }
</style>
