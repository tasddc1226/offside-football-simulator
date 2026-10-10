<script lang="ts">
  // T-11-191 도트 선수 꾸미기. 커리어 화면의 도트 선수를 누르면 열린다. 항목을 선수 자금으로 한 번 사면 이 커리어 동안
  // 언제든 바꿀 수 있고(무료), 은퇴하면 굳는다. 사기 전에는 고른 모양을 미리보기로만 보여 준다.
  import { onMount } from 'svelte';
  import { avatarSpec } from '@offside/game/avatar';
  import { buyLook, lookEditable, setLook } from '@offside/game/look';
  import { fmtMoney } from '@offside/game/player';
  import type { GameState, LookItem } from '@offside/game/types';
  import { lookPreview, lookRows } from '@offside/app-core/avatarLook';
  import { appFormatText as W } from '@offside/app-core/i18n/ko/appFormat';
  import { avatarLookText as L } from '@offside/app-core/i18n/ko/avatarLook';
  import PixelAvatar from './PixelAvatar.svelte';
  import { save, toast } from './helpers.js';

  const { s, onclose }: { s: GameState; onclose: () => void } = $props();
  let closeButton = $state<HTMLButtonElement>();
  // 사기 전에 고른 값(미리보기). 산 항목은 바로 바꾼다.
  let pending = $state<{ item: LookItem; value: number } | null>(null);
  let version = $state(0);
  const editable = $derived(lookEditable(s));
  // 세이브 상태(appState.G)를 바로 고치므로 version으로 다시 그리게 한다.
  const rows = $derived.by(() => (void version, lookRows(s)));
  const shown = $derived.by(() => (void version, pending ? lookPreview(s, pending.item, pending.value) : s));
  const spec = $derived(avatarSpec(shown));
  const pendingRow = $derived(pending ? rows.find((r) => r.item === pending!.item) : undefined);

  onMount(() => closeButton?.focus({ preventScroll: true }));

  function pick(item: LookItem, value: number, owned: boolean) {
    if (!editable) return;
    if (!owned) {
      pending = { item, value };
      return;
    }
    pending = null;
    if (setLook(s, item, value)) {
      save();
      version++;
    }
  }
  function buy() {
    if (!pending || !pendingRow) return;
    if (!buyLook(s, pending.item, pending.value)) return;
    save();
    toast(L.bought({ item: pendingRow.name }));
    pending = null;
    version++;
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />
<div class="look" data-avatar-look>
  <button class="look-backdrop" tabindex="-1" aria-hidden="true" onclick={onclose}></button>
  <div class="look-body" role="dialog" aria-modal="true" aria-label={L.title}>
    <header class="look-head">
      <div class="look-preview"><PixelAvatar {spec} /></div>
      <div>
        <h2>{L.title}</h2>
        <p class="look-money" data-look-money>{L.money({ money: W.won({ v: fmtMoney(s.money) }) })}</p>
        <p class="muted fs-sm">{editable ? L.intro : L.locked}</p>
      </div>
    </header>
    <div class="look-rows">
      {#each rows as r (r.item)}
        <section class="look-row" data-look-item={r.item}>
          <div class="look-row-head">
            <b>{r.name}</b>
            <span class:look-owned={r.owned}>{r.owned ? L.owned : r.costText}</span>
          </div>
          <div class="look-opts" role="group" aria-label={r.name}>
            {#each r.options as o (o.value)}
              {@const on = pending?.item === r.item ? pending.value === o.value : r.current === o.value}
              <button class="look-opt" class:swatch={!!o.swatch} aria-pressed={on} disabled={!editable} data-look-opt={o.value}
                aria-label={o.label ?? L.pickAria({ item: r.name, n: o.value + 1 })} onclick={() => pick(r.item, o.value, r.owned)}>
                {#if o.swatch}<span style:background={o.swatch}></span>{:else}{o.label}{/if}
              </button>
            {/each}
          </div>
          {#if pending?.item === r.item && !r.owned}
            {#if s.money >= r.cost}
              <button class="btn btn-primary btn-block" data-act="look-buy" onclick={buy}>{L.buy({ item: r.name, cost: r.costText })}</button>
            {:else}
              <p class="look-short" role="alert">{L.short({ cost: r.costText })}</p>
            {/if}
          {/if}
        </section>
      {/each}
    </div>
    <button class="btn btn-block" bind:this={closeButton} onclick={onclose}>{L.close}</button>
  </div>
</div>

<style>
  .look {position:fixed;inset:0;z-index:80;display:flex;align-items:flex-end;justify-content:center;}
  .look-backdrop {position:absolute;inset:0;border:0;padding:0;background:color-mix(in srgb,#000,transparent 45%);}
  .look-body {position:relative;width:100%;max-width:480px;max-height:88vh;overflow:auto;background:var(--surface);color:var(--ink);border-radius:20px 20px 0 0;padding:18px 16px calc(16px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:14px;}
  .look-head {display:flex;gap:14px;align-items:center;}
  .look-head h2 {margin:0 0 2px;font-size:1.1rem;}
  .look-head p {margin:2px 0 0;}
  .look-preview {flex:none;padding:8px;border-radius:14px;background:var(--pitch);}
  .look-money {font-weight:700;}
  .look-rows {display:flex;flex-direction:column;gap:12px;}
  .look-row {display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid var(--line);border-radius:14px;}
  .look-row-head {display:flex;justify-content:space-between;align-items:center;font-size:.9rem;}
  .look-row-head span {color:var(--muted);font-size:.8rem;font-weight:600;}
  .look-row-head .look-owned {color:var(--good);}
  .look-opts {display:flex;flex-wrap:wrap;gap:8px;}
  .look-opt {min-height:36px;min-width:36px;padding:0 10px;border:1px solid var(--line);border-radius:999px;background:var(--surface);color:var(--ink);font:inherit;font-size:.8rem;cursor:pointer;}
  .look-opt.swatch {padding:4px;display:grid;place-items:center;}
  .look-opt.swatch span {display:block;width:24px;height:24px;border-radius:50%;box-shadow:inset 0 0 0 1px #0003;}
  .look-opt[aria-pressed='true'] {border-color:var(--accent);box-shadow:0 0 0 2px var(--accent);font-weight:700;}
  .look-opt:disabled {cursor:default;opacity:.6;}
  .look-short {margin:0;color:var(--bad);font-size:.8rem;font-weight:600;}
</style>
