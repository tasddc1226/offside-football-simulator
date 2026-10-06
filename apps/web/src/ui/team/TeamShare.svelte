<script lang="ts">
  import { onMount } from 'svelte';
  import { lockScroll } from '../scrollLock.js';
  import type { TeamShareData } from './teamShareCard.js';
  import { teamMatchText as L } from '@offside/app-core/i18n/ko/teamMatch';

  let { data, onclose }: { data: TeamShareData; onclose: () => void } = $props();
  let dialog: HTMLDialogElement;
  let shot = $state<{ file: File; url: string; canShare: boolean } | null>(null);
  let busy = $state(false);
  let error = $state('');
  let disposed = false;

  onMount(() => {
    dialog.showModal();
    dialog.querySelector<HTMLButtonElement>('.close')?.focus();
    const unlock = lockScroll();
    void make();
    return () => {
      disposed = true;
      if (shot) URL.revokeObjectURL(shot.url);
      dialog.close();
      unlock();
    };
  });

  async function make() {
    if (busy) return;
    busy = true;
    error = '';
    try {
      const { makeTeamShareFile } = await import('./teamShareCard.js');
      if (disposed) return;
      const file = await makeTeamShareFile(data);
      if (disposed) return;
      if (shot) URL.revokeObjectURL(shot.url);
      shot = { file, url: URL.createObjectURL(file), canShare: typeof navigator.share === 'function' && !!navigator.canShare?.({ files: [file] }) };
    } catch {
      if (!disposed) error = L.shareMakeFail;
    } finally {
      if (!disposed) busy = false;
    }
  }
  function save() {
    if (shot) Object.assign(document.createElement('a'), { href: shot.url, download: shot.file.name }).click();
  }
  function trapTab(event: KeyboardEvent) {
    if (event.key !== 'Tab') return;
    const buttons = [...dialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  async function share() {
    if (!shot) return;
    try {
      await navigator.share({ files: [shot.file], title: L.shareTitleWeb({ name: data.name }), text: L.shareTextWeb({ name: data.name }) });
    } catch (e) {
      if ((e as DOMException)?.name !== 'AbortError') error = L.shareOpenFailWeb;
    }
  }
</script>

<dialog bind:this={dialog} aria-labelledby="team-share-title" onclose={onclose} onkeydown={trapTab} data-team-share>
  <header><div><h2 id="team-share-title">{L.shareTitle}</h2><p>{L.shareLeadWeb}</p></div><button class="close" aria-label={L.shareCloseAria} onclick={() => dialog.close()}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" /></svg></button></header>
  <div class="preview-body">
    {#if shot}<img src={shot.url} alt={L.shareAltWeb({ name: data.name })} width="1080" height="1350" data-team-share-preview />
    {:else if busy}<div class="making" role="status">{L.shareMaking}</div>{/if}
    {#if data.draft}<p class="draft-note">{L.shareDraftNote}</p>{/if}
    {#if error}<p class="error" role="alert">{error}</p>{/if}
  </div>
  <footer>
    {#if shot}<button class="btn" data-act="team-share-save" onclick={save}>{L.saveImage}</button>{#if shot.canShare}<button class="btn btn-primary" data-act="team-share-send" onclick={share}>{L.shareNow}</button>{/if}
    {:else}<button class="btn btn-primary" onclick={make} disabled={busy}>{busy ? L.makingBtn : L.remake}</button>{/if}
  </footer>
</dialog>

<style>
  dialog {width:100%;max-width:480px;max-height:92dvh;margin:auto auto 0;padding:0;border:1px solid var(--line);border-radius:18px 18px 0 0;background:var(--surface);color:var(--ink);box-shadow:var(--shadow);overflow:hidden;}
  dialog[open] {display:flex;flex-direction:column;}
  dialog::backdrop {background:#0009;}
  header {display:flex;align-items:center;justify-content:space-between;gap:8px;padding:16px;flex:none;}
  h2 {margin:0;font-size:18px;}
  header p,.draft-note,.error {margin:5px 0 0;font-size:12px;line-height:1.6;color:var(--muted);}
  .close {width:44px;height:44px;flex:none;border:0;border-radius:8px;background:none;color:var(--ink);}
  .close svg {width:20px;height:20px;stroke:currentColor;stroke-width:1.5;fill:none;}
  .preview-body {padding:0 16px 16px;overflow:auto;overscroll-behavior:contain;min-height:0;}
  img {display:block;width:100%;height:auto;border-radius:10px;}
  .making {display:grid;place-items:center;aspect-ratio:4/5;background:var(--surface-2);border-radius:10px;font-size:13px;}
  .error {color:var(--bad);}
  footer {display:flex;gap:8px;padding:12px 16px calc(12px + var(--safe-b));border-top:1px solid var(--line);flex:none;}
  footer .btn {flex:1;min-height:44px;font-size:14px;}
  @media(min-width:600px) {dialog {margin:auto;border-radius:18px;}}
</style>
