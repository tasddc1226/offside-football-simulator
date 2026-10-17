<script lang="ts">
  import { onMount } from 'svelte';
  import { acquisitionStatus, setAcquisitionConsent } from '../analytics/acquisition.js';
  import { getConsent, onConsent } from '../analytics/browser.js';
  import { settingsText as L } from '@offside/app-core/i18n/ko/settings';
  const { settings=false }:{settings?:boolean}=$props();
  let choice=$state<'granted'|'denied'|'unknown'>('unknown');
  let analytics=$state(false);
  let busy=$state(false);
  let failed=$state(false);
  onMount(()=>{
    const refresh=()=>{analytics=getConsent()==='granted';void acquisitionStatus().then(v=>choice=v);};
    refresh();return onConsent(refresh);
  });
  async function choose(value:'granted'|'denied') {
    busy=true;failed=!(await setAcquisitionConsent(value));if(!failed) choice=value;busy=false;
  }
</script>
{#if analytics&&(settings||choice==='unknown'||failed)}
  <section class="card acquisition-consent" aria-label={L.acquisitionTitle}>
    <strong>{L.acquisitionTitle} <span class="muted">{L.consentOptional}</span></strong>
    <p>{L.acquisitionBody}</p><p><a href="/legal/privacy/#acquisition">{L.consentMore}</a></p>
    {#if failed}<p role="alert">{L.acquisitionRetry}</p>{/if}
    <div class="choices">
      <button class="btn" disabled={busy} onclick={()=>choose('denied')}>{choice==='granted'?L.consentRevoke:L.consentDenied}</button>
      <button class="btn" disabled={busy||choice==='granted'} onclick={()=>choose('granted')}>{L.acquisitionAgree}</button>
    </div>
  </section>
{/if}
<style>
  .acquisition-consent {padding:16px;margin:12px auto;max-width:640px;}
  p {font-size:12px;line-height:1.6;margin:8px 0;}
  .choices {display:flex;flex-wrap:wrap;gap:8px;}
  button {flex:1;min-height:44px;}
</style>
