<script lang="ts">
  import { onMount } from 'svelte';
  import type { LegendView } from '@offside/app-core/state';
  import { pickRetiredLook, retiredLookRows, saveRetiredLook } from '@offside/app-core/retiredLook';
  import { retiredAvatarSpec, primeAvatarSpec } from '@offside/game/avatar';
  import { retiredLookText as L } from '@offside/app-core/i18n/ko/retiredLook';
  import { avatarLookText as A } from '@offside/app-core/i18n/ko/avatarLook';
  import PixelAvatar from './PixelAvatar.svelte';
  import { appState } from './state.svelte';
  import { toast } from './helpers';

  const { v, onclose }: { v: LegendView; onclose: () => void } = $props();
  let draft = $state(v.avatarLook ?? null);
  let busy = $state(false);
  let error = $state('');
  let dialog: HTMLDivElement;
  let cancel: HTMLButtonElement;
  const rows = $derived(retiredLookRows(v, draft));
  const dirty = $derived(draft !== (v.avatarLook ?? null));
  onMount(() => {
    // Retirement credits have transform/overflow; keep the modal in the viewport, like PlayerPeek.
    const root = dialog.closest<HTMLElement>('[data-retired-look]')!;
    document.body.append(root);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cancel?.focus({ preventScroll: true });
    return () => { document.body.style.overflow = overflow; root.remove(); };
  });
  function close() { if (!busy) onclose(); }
  function key(e: KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    if (e.key !== 'Tab') return;
    if (busy) { e.preventDefault(); return; }
    const buttons = [...dialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
    const first = buttons[0], last = buttons.at(-1);
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
  }
  async function save() {
    if (busy || !dirty) return;
    busy = true; error = '';
    try {
      const r = await saveRetiredLook(appState, v, draft);
      if (r.ok) { toast(r.message); onclose(); }
      else error = r.message;
    } catch { error = L.failed; }
    finally { busy = false; }
  }
</script>

<svelte:window onkeydown={key} />
<div class="retired-look" data-retired-look>
  <button class="backdrop" tabindex="-1" aria-hidden="true" onclick={close}></button>
  <div bind:this={dialog} class="body" role="dialog" aria-modal="true" aria-label={L.title} aria-busy={busy}>
    <header><h2>{L.title}</h2><p>{L.intro}</p></header>
    <div class="scroll">
      <div class="previews">
        <div><PixelAvatar spec={retiredAvatarSpec(v.avatarId!, v.age, draft)} /><small>{L.retiredPreview}</small></div>
        <div><PixelAvatar spec={primeAvatarSpec({ id: v.avatarId!, lastClub: v.lastClub, lastClubId: v.lastClubId, look: draft })} /><small>{L.kitPreview}</small></div>
      </div>
      <p class="muted fs-sm">{L.recordNote}</p>
      {#each rows as r (r.item)}
        <section data-look-item={r.item}><b>{r.name}</b>
          <div class="options" role="group" aria-label={r.name}>
            {#each r.options as o (o.value)}
              <button class="option" class:swatch={!!o.swatch} data-look-opt={o.value} disabled={busy} aria-pressed={r.current === o.value}
                aria-label={o.label ?? A.pickAria({ item: r.name, n: o.value + 1 })}
                onclick={() => draft = pickRetiredLook(draft, r.item, o.value)}>
                {#if o.swatch}<span style:background={o.swatch}></span>{:else}{o.label}{/if}
              </button>
            {/each}
          </div>
        </section>
      {/each}
      <button class="btn" disabled={busy || draft === null} data-act="retired-look-reset" onclick={() => draft = null}>{L.reset}</button>
    </div>
    <footer>
      {#if error}<p role="alert">{error}</p>{/if}
      <div><button bind:this={cancel} class="btn" disabled={busy} onclick={close}>{L.cancel}</button>
      <button class="btn btn-primary" disabled={busy || !dirty} data-act="retired-look-save" onclick={save}>{busy ? L.saving : L.save}</button></div>
    </footer>
  </div>
</div>

<style>
  .retired-look { position: fixed; inset: 0; z-index: 80; display: flex; align-items: flex-end; justify-content: center; text-align: left; }
  .backdrop { position: absolute; inset: 0; background: rgb(0 0 0 / .65); border: 0; }
  .body { position: relative; width: min(100%, 520px); max-height: 92dvh; display: flex; flex-direction: column; background: var(--surface); color: var(--ink); border: 1px solid var(--line); border-radius: 20px 20px 0 0; overflow: hidden; }
  header { flex-shrink: 0; padding: 18px 18px 10px; }
  header h2 { color: var(--ink); font-size: 1.125rem; }
  header p { margin-top: 6px; font-size: .8125rem; color: var(--muted); }
  .scroll { min-height: 0; padding: 0 18px 18px; overflow-y: auto; overscroll-behavior: contain; }
  .previews { color: var(--on-pitch); display: flex; justify-content: center; gap: 40px; padding: 12px; background: var(--pitch); border-radius: 14px; margin-bottom: 12px; }
  .previews > div { display: flex; flex-direction: column; align-items: center; gap: 6px; }
  section { padding: 14px 0; border-bottom: 1px solid var(--line); }
  .options { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
  .option { min-height: 44px; min-width: 44px; max-width: 100%; border: 1px solid var(--line); border-radius: 999px; padding: 6px 12px; background: var(--surface); color: var(--ink); }
  .option[aria-pressed='true'] { border-color: var(--accent); box-shadow: inset 0 0 0 2px var(--accent); }
  .swatch { padding: 6px; }
  .swatch span { display: block; width: 28px; height: 28px; border-radius: 50%; border: 1px solid var(--line); }
  .scroll > .btn { margin-top: 16px; }
  footer { flex-shrink: 0; padding: 12px 18px max(16px, env(safe-area-inset-bottom)); border-top: 1px solid var(--line); background: var(--surface); }
  footer > div { display: flex; gap: 8px; }
  footer .btn { flex: 1; min-height: 44px; }
  footer p { color: var(--bad); font-size: .8125rem; margin-bottom: 8px; }
</style>
