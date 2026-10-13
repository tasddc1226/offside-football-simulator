<script lang="ts">
  import { onMount } from 'svelte';
  import type { LegendView } from '@offside/app-core/state';
  import { loadRetiredLook, pickRetiredLook, retiredLookRows, saveRetiredLook } from '@offside/app-core/retiredLook';
  import { retiredAvatarSpec, primeAvatarSpec } from '@offside/game/avatar';
  import { retiredLookText as L } from '@offside/app-core/i18n/ko/retiredLook';
  import { avatarLookText as A } from '@offside/app-core/i18n/ko/avatarLook';
  import PixelAvatar from './PixelAvatar.svelte';
  import { appState } from './state.svelte';
  import { toast } from './helpers';

  const { v, onclose }: { v: LegendView; onclose: () => void } = $props();
  let draft = $state(v.avatarLook ?? null);
  let busy = $state(false);
  let checking = $state(true);
  let allowed = $state(false);
  let locked = $state('');
  let confirming = $state(false);
  let original = $state(v.avatarLook ?? null);
  const editingView = $derived({ ...v, avatarLook: original });
  let error = $state('');
  let dialog: HTMLDivElement;
  let cancel: HTMLButtonElement;
  const rows = $derived(retiredLookRows(editingView, draft));
  const dirty = $derived(draft !== original);
  onMount(() => {
    // Retirement credits have transform/overflow; keep the modal in the viewport, like PlayerPeek.
    const root = dialog.closest<HTMLElement>('[data-retired-look]')!;
    document.body.append(root);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    void loadRetiredLook(appState, v).then((r) => {
      if (r.ok) {
        original = draft = r.policy.look;
        allowed = r.policy.remaining === 1;
        locked = r.policy.lockedReason ? L[r.policy.lockedReason] : '';
      } else error = r.message;
    }).catch(() => error = L.checkFailed).finally(() => checking = false);
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
    if (busy || checking || !allowed || !dirty) return;
    if (!confirming) { confirming = true; return; }
    busy = true; error = '';
    try {
      const r = await saveRetiredLook(appState, editingView, draft);
      if (r.ok) { toast(r.message); onclose(); }
      else error = r.message;
    } catch { error = L.failed; }
    finally { busy = false; }
  }
</script>

<svelte:window onkeydown={key} />
<div class="retired-look" data-retired-look>
  <button class="backdrop" tabindex="-1" aria-hidden="true" onclick={close}></button>
  <div bind:this={dialog} class="body" role="dialog" aria-modal="true" aria-label={L.title} aria-busy={busy || checking}>
    <header><h2>{L.title}</h2><p>{L.intro}</p><p>{L.policy}</p></header>
    <div class="scroll">
      <div class="previews">
        <div><PixelAvatar spec={retiredAvatarSpec(v.avatarId!, v.age, draft)} /><small>{L.retiredPreview}</small></div>
        <div><PixelAvatar spec={primeAvatarSpec({ id: v.avatarId!, lastClub: v.lastClub, lastClubId: v.lastClubId, look: draft })} /><small>{L.kitPreview}</small></div>
      </div>
      {#if checking}<p role="status">{L.checking}</p>{/if}
      {#if locked}<p role="status">{locked}</p>{/if}
      {#if allowed && !confirming}
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
      {/if}
    </div>
    <footer>
      {#if confirming}<p class="confirmation" role="status">{L.confirmNote}</p>{/if}
      {#if error}<p role="alert">{error}</p>{/if}
      {#if confirming}<button class="btn back" disabled={busy} onclick={() => confirming = false}>{L.back}</button>{/if}
      <div><button bind:this={cancel} class="btn" disabled={busy} onclick={close}>{L.cancel}</button>
      <button class="btn btn-primary" disabled={busy || checking || !allowed || !dirty} data-act="retired-look-save" onclick={save}>{busy ? L.saving : confirming ? L.confirm : L.save}</button></div>
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
  footer .back { width: 100%; margin-bottom: 8px; }
  footer p.confirmation { color: var(--ink); }
  footer > div { display: flex; gap: 8px; }
  footer .btn { flex: 1; min-height: 44px; min-width: 0; white-space: normal; }
  footer p { color: var(--bad); font-size: .8125rem; margin-bottom: 8px; }
</style>
