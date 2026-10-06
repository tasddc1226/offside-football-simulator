<script lang="ts">
  import { onMount } from 'svelte';
  import { enabled, getConsent, onConsent, setConsent } from '../analytics/browser.js';
  import type { Consent } from '@offside/app-core/analytics-model';
  import { settingsText as L } from '@offside/app-core/i18n/ko/settings';
  const { settings = false }: { settings?: boolean } = $props();
  let available = $state(false);
  let choice = $state<Consent>('unknown');
  onMount(() => {
    available = enabled();
    choice = getConsent();
    return onConsent(() => { choice = getConsent(); });
  });
</script>

{#if available && (settings || choice === 'unknown')}
  <section class="card analytics-consent" aria-label={L.consentAria} data-analytics="consent">
    <strong>{L.consentTitle} <span class="muted">{L.consentOptional}</span></strong>
    <p class="muted">{L.consentBody1}</p>
    <p class="muted">{L.consentBody2} <a href="/legal/privacy/#analytics">{L.consentMore}</a></p>
    {#if settings}<p>{L.consentNow} {choice === 'granted' ? L.consentGranted : choice === 'denied' ? L.consentDenied : L.consentUnset}</p>{/if}
    <div class="analytics-choices">
      <button class="btn" data-analytics="deny" onclick={() => setConsent('denied')}>{choice === 'granted' ? L.consentRevoke : L.consentDenied}</button>
      <button class="btn" data-analytics="accept" onclick={() => setConsent('granted')} disabled={choice === 'granted'}>{L.consentAgree}</button>
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
