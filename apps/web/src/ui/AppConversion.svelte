<script lang="ts">
  import { onMount } from 'svelte';
  import { shellInstallText as L } from '@offside/app-core/i18n/ko/shellInstall';
  import { IOS_APP_STORE_URL, ANDROID_TESTER_FORM_URL } from '@offside/app-core/links';
  import { trackAppConversion, trackAppStoreClick, type AppConversionPlace } from '../analytics/index.js';
  import { appTarget } from './appStore.js';
  import { playedEnough } from './adLanding.js';
  import { conversionNotice, restoreConversionNotice, dismissConversionNotice, homePromptDue, recordHomePrompt } from './appConversion.svelte.js';

  const { context }: { context: AppConversionPlace } = $props();
  let ready = $state(false);
  let target = $state<'ios' | 'android' | 'both'>('both');
  let viewed = false;
  let eligible = $state(false);
  let element: HTMLElement | undefined = $state();
  const visible = $derived(ready && (context === 'shop' || (conversionNotice.until <= Date.now() && eligible)));
  const milestone = $derived(context === 'home' && playedEnough());
  onMount(() => {
    restoreConversionNotice();
    eligible = homePromptDue();
    target = appTarget();
    ready = true;
  });
  $effect(() => {
    if (!visible || !element || viewed) return;
    const observer = new IntersectionObserver((entries) => {
      if (!viewed && entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5)) {
        viewed = true;
        trackAppConversion('view', context, target);
        if (context === 'home') recordHomePrompt();
        observer.disconnect();
      }
    }, { threshold: 0.5 });
    observer.observe(element);
    return () => observer.disconnect();
  });
  function click(to: 'ios' | 'android') {
    trackAppConversion('click', context, to);
    if (to === 'ios') trackAppStoreClick(context);
  }
  function dismiss() {
    trackAppConversion('dismiss', context, target);
    dismissConversionNotice();
  }
</script>

{#if visible}
  <aside bind:this={element} class="card app-conversion" data-app-conversion={context} aria-label={L.conversionTitle}>
    <div class="heading"><strong>{milestone ? L.conversionMilestone : L.conversionTitle}</strong>{#if context === 'home'}<button class="icon-btn" aria-label={L.conversionDismiss} onclick={dismiss}>×</button>{/if}</div>
    {#if target !== 'android'}<p class="muted fs-sm">{L.conversionIos}</p>{/if}
    {#if target !== 'ios'}<p class="muted fs-sm">{L.conversionAndroid}</p>{/if}
    <div class="actions">
      {#if target !== 'android'}<a class="btn btn-accent" data-act="app-store" href={IOS_APP_STORE_URL} target="_blank" rel="noopener noreferrer" onclick={() => click('ios')}>{L.conversionStore}</a>{/if}
      {#if target !== 'ios'}<a class="btn" data-act="android-tester" href={ANDROID_TESTER_FORM_URL} target="_blank" rel="noopener noreferrer" onclick={() => click('android')}>{L.conversionTest}</a>{/if}
    </div>
    <p class="muted fs-sm transfer">{L.conversionTransfer}</p>
  </aside>
{/if}

<style>
  .app-conversion { border-left: 3px solid var(--accent); margin-block: 12px; padding: 14px; }
  .heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .heading strong { min-width: 0; line-height: 1.4; }
  .heading button { flex-shrink: 0; min-width: 44px; min-height: 44px; font-size: 24px; }
  p { margin: 6px 0 12px; line-height: 1.5; overflow-wrap: anywhere; }
  .actions { display: flex; flex-wrap: wrap; gap: 8px; }
  .actions a { min-height: 48px; white-space: normal; text-align: center; flex: 1 1 180px; }
  .transfer { margin-bottom: 0; }
</style>
