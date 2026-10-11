<script lang="ts">
  // T-10-115 인앱 브라우저(카톡·인스타 등)에서 연 홈에만 한 번 보이는 안내. 기록이 이 앱 안에만 저장되고 구글 로그인도
  // 막히므로 외부 브라우저로 열도록 권한다. 닫으면 다시 띄우지 않는다.
  // T-11-195 광고로 들어온 방문은 먼저 플레이하게 두고, 첫 시즌을 마치거나 은퇴 기록이 생긴 뒤에 보인다.
  import { loadKey, saveKey } from '@offside/game/storage';
  import { currentInApp, openExternal } from './inapp-open.js';
  import { adLanded, playedEnough } from './adLanding.js';
  import { shellInstallText as L } from '@offside/app-core/i18n/ko/shellInstall';

  const HINT_KEY = 'ft_inapp_hint';
  const info = currentInApp();
  let hidden = $state(!info || loadKey<boolean>(HINT_KEY) === true || (adLanded() && !playedEnough()));
  function dismiss() {
    saveKey(HINT_KEY, true);
    hidden = true;
  }
</script>

{#if !hidden}
  <section class="card inapp-hint" data-inapp-hint aria-label={L.inappHintAria}>
    <p>{L.inappHint}</p>
    <button class="btn btn-accent" data-act="inapp-open" onclick={() => void openExternal(info)}>{L.inappOpen}</button>
    <button class="icon-btn inapp-close" data-act="inapp-close" aria-label={L.inappClose} onclick={dismiss}>✕</button>
  </section>
{/if}

<style>
  .inapp-hint {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    padding-right: 52px;
    border-color: var(--accent);
  }
  .inapp-hint p {
    margin: 0;
    font-size: 0.875rem;
    line-height: 1.5;
  }
  .inapp-close {
    position: absolute;
    top: 4px;
    right: 4px;
    min-width: 44px;
    min-height: 44px;
    display: grid;
    place-items: center;
    padding: 0;
    color: var(--muted);
  }
</style>
