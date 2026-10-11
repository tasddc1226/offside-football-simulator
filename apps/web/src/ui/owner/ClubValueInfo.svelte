<script lang="ts">
  import { ownerText as L } from '@offside/app-core/i18n/ko/owner';
  import { teamHomeText as T } from '@offside/app-core/i18n/ko/teamHome';
  import { lockScroll } from '../scrollLock.js';
  let { linked }: { linked: boolean } = $props();
  let dialog: HTMLDialogElement;
  let open = $state(false);
  $effect(() => { if (open) return lockScroll(); });
  function show() { open = true; dialog.showModal(); }
</script>
<button class="info" aria-label={L.valueInfoTitle} aria-haspopup="dialog" data-club-value-info onclick={show}><span aria-hidden="true">i</span></button>
<dialog bind:this={dialog} aria-labelledby="club-value-info-title" onclose={() => open = false} data-club-value-dialog>
  <header><h2 id="club-value-info-title">{L.valueInfoTitle}</h2><button class="close" aria-label={T.close} onclick={() => dialog.close()}>×</button></header>
  <p class="formula">{linked ? L.valueInfoFormula : L.valueInfoGuest}</p>
  <ul>{#if linked}<li>{L.valueInfoOwned}</li>{/if}<li>{L.valueInfoPrice}</li><li>{L.valueInfoFallback}</li><li>{L.valueInfoExcluded}</li></ul>
</dialog>
<style>
  .info{position:absolute;top:0;right:0;display:grid;place-items:center;width:44px;height:44px;border:0;background:transparent;color:var(--muted);cursor:pointer;border-radius:10px;}
  .info span{display:grid;place-items:center;width:15px;height:15px;border:1px solid currentColor;border-radius:50%;font:700 11px Georgia,serif;}
  .info:hover{color:var(--ink);}
  button:focus-visible{outline:2px solid var(--accent);outline-offset:-3px;}
  dialog{box-sizing:border-box;width:min(440px,calc(100% - 24px));max-width:100%;max-height:85dvh;overflow:auto;overscroll-behavior:contain;border:1px solid var(--line);border-radius:18px;padding:20px;background:var(--surface);color:var(--ink);}
  dialog::backdrop{background:#0009;}
  header{display:flex;align-items:center;justify-content:space-between;gap:8px;}
  h2{font-size:18px;margin:0;}
  .close{flex:none;width:44px;height:44px;border:0;background:transparent;color:inherit;font-size:28px;cursor:pointer;}
  p,li{font-size:13px;line-height:1.7;}
  .formula{padding:12px;border-radius:10px;background:var(--surface-2);font-weight:700;}
  ul{padding-left:18px;margin:12px 0 0;}li+li{margin-top:10px;}
</style>
