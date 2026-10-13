<script lang="ts">
  import { onMount } from 'svelte';
  import type { SheetView } from '@offside/app-core/sheets';
  import { sheetCoreText } from '@offside/app-core/i18n/ko/sheetCore';
  import { sheetState } from './sheetState.svelte';
  import AvatarStage from './sheets/AvatarStage.svelte';
  const { v }: { v: Extract<SheetView, { kind: 'steps' | 'block' }> } = $props();
  let dismissed = $state(false);
  let host: HTMLDivElement;
  let reveal = $state<HTMLButtonElement | null>(null);
  const shown = $derived(!dismissed && sheetState.open && sheetState.busy && sheetState.buttons.length === 0);
  onMount(() => {
    // Keep the cover outside #modal and its transitions; the original sheet stays mounted underneath.
    const root = host.closest<HTMLElement>('[data-progress-cover-root]')!;
    document.body.append(root);
    return () => root.remove();
  });
  $effect(() => {
    if (!shown) return;
    const app = document.getElementById('app');
    const modal = document.getElementById('modal');
    const appInert = app?.inert ?? false, modalInert = modal?.inert ?? false;
    if (app) app.inert = true;
    if (modal) modal.inert = true;
    reveal?.focus({ preventScroll: true });
    return () => {
      if (app) app.inert = appInert;
      if (modal) {
        modal.inert = modalInert;
        if (sheetState.open) modal.querySelector<HTMLElement>('.sheet')?.focus({ preventScroll: true });
      }
    };
  });
  function key(e: KeyboardEvent) {
    if (!shown) return;
    if (e.key === 'Escape') { e.preventDefault(); dismissed = true; }
    if (e.key === 'Tab') { e.preventDefault(); reveal?.focus(); }
  }
</script>

<svelte:window onkeydown={key} />
<div bind:this={host} class="cover-root" data-progress-cover-root>
  {#if shown}
    <div class="progress-cover" data-progress-cover role="dialog" aria-modal="true" aria-label={v.title}>
      <button bind:this={reveal} class="cover-reveal" aria-label={sheetCoreText.revealProgress} onclick={() => dismissed = true}>
        <span class="cover-avatar">{#if v.avatar}<AvatarStage spec={v.avatar} />{/if}</span>
      </button>
    </div>
  {/if}
</div>

<style>
  .cover-root { display: contents; }
  .progress-cover { position: fixed; inset: 0; width: 100vw; height: 100dvh; z-index: 100; background: var(--surface); }
  .cover-reveal { width: 100%; height: 100%; padding: 0; border: 0; background: transparent; display: grid; place-items: center; cursor: pointer; }
  .cover-avatar { display: block; width: clamp(96px, 26vw, 160px); aspect-ratio: 8 / 9; }
  .cover-reveal:focus-visible .cover-avatar { outline: 2px solid var(--accent-text); outline-offset: 8px; border-radius: 8px; }
  @media (max-height: 540px) { .cover-avatar { width: 80px; } }
</style>
