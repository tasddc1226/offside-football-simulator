<script lang="ts">
  import { onMount } from 'svelte';
  import { enabled, getConsent, onConsent, setConsent } from '../analytics/browser.js';
  import { getAdConsent, metaEnabled } from '../analytics/meta.js';
  import type { Consent } from '@offside/app-core/analytics-model';
  import { settingsText as L } from '@offside/app-core/i18n/ko/settings';
  const { settings = false }: { settings?: boolean } = $props();
  let available = $state(false);
  let choice = $state<Consent>('unknown');
  // T-11-195 메타 픽셀이 켜진 빌드면 광고 측정도 같은 카드에서 묻는다. GA4만 골랐던 이용자에게는 카드를 한 번 더 보인다.
  let meta = $state(false);
  let adChoice = $state<Consent>('unknown');
  const read = () => {
    choice = getConsent();
    adChoice = getAdConsent();
  };
  onMount(() => {
    available = enabled();
    meta = metaEnabled();
    read();
    return onConsent(read);
  });
</script>

{#if available && (settings || choice === 'unknown' || (meta && adChoice === 'unknown'))}
  <section class="card analytics-consent" aria-label={L.consentAria} data-analytics="consent">
    <strong>{L.consentTitle} <span class="muted">{L.consentOptional}</span></strong>
    <p class="muted">{L.consentBody1}</p>
    {#if meta}<p class="muted">{L.consentMeta}</p>{/if}
    <p class="muted">{L.consentBody2} <a href="/legal/privacy/#analytics">{L.consentMore}</a></p>
    {#if settings}<p>{L.consentNow} {choice === 'granted' ? L.consentGranted : choice === 'denied' ? L.consentDenied : L.consentUnset}</p>{/if}
    <div class="analytics-choices">
      <button class="btn" data-analytics="deny" onclick={() => setConsent('denied')}>{choice === 'granted' ? L.consentRevoke : L.consentDenied}</button>
      <button class="btn" data-analytics="accept" onclick={() => setConsent('granted')} disabled={choice === 'granted' && (!meta || adChoice === 'granted')}>{L.consentAgree}</button>
    </div>
    {#if settings}<p class="muted">{L.consentRevokeNote}</p>{/if}
  </section>
{/if}

<style>
  .analytics-consent { padding: 16px; margin: 12px auto; max-width: 640px; }
  p { font-size: 12px; line-height: 1.6; margin: 8px 0; }
  .analytics-choices { display: flex; flex-wrap: wrap; gap: 8px; }
  .analytics-choices .btn { flex: 1; }
</style>
