<script lang="ts">
  // T-11-735 선수 탭 '명품 경매' 카드. 경매품을 고르고 한 번 더 눌러 사면 상자 열기 연출(AuctionFx)로 등급을 보여 준다.
  // 아래 진열장은 종류 6 × 등급 4칸이다. 웹은 광고 자리(경매품 새로 받기)가 없다.
  import type { GameState } from '@offside/game/types';
  import { auctionView, doAuction, type AuctionOutcome } from '@offside/app-core/auction-view';
  import { gameAuctionText as L } from '@offside/app-core/i18n/ko/gameAuction';
  import { save } from '../helpers.js';
  import AuctionFx from './AuctionFx.svelte';
  import AuctionIcon from './AuctionIcon.svelte';

  const { s }: { s: GameState } = $props();
  const v = $derived(auctionView(s));
  let arm = $state<number | null>(null);
  let fx = $state<AuctionOutcome | null>(null);
  const armed = $derived(v && arm != null ? v.lots[arm] : undefined);

  function onLot(i: number) {
    if (arm !== i) {
      arm = i;
      return;
    }
    arm = null;
    const out = doAuction(s, i);
    if (!out) return;
    save();
    fx = out;
  }
</script>

{#if fx}<AuctionFx out={fx} onDone={() => (fx = null)} />{/if}

{#if v}
  <section class="card" data-auction>
    <div class="eyebrow">Auction</div>
    <div class="ac-head">
      <h2>{L.title}</h2>
      <span class="muted fs-xs" data-auction-count>{v.shelf.count}</span>
    </div>
    <p class="fs-sm" data-auction-line>{v.line}</p>
    <div class="ac-lots">
      {#each v.lots as lot (lot.i)}
        <button class="ac-lot" class:on={arm === lot.i} data-act="auction-{lot.i}" data-lot={lot.status} disabled={lot.status !== 'ready'} aria-pressed={arm === lot.i} onclick={() => onLot(lot.i)}>
          <AuctionIcon d={lot.icon} size={30} />
          <span class="ac-name">{lot.name}</span>
          <span class="btn-badge">{lot.status === 'got' ? L.got : lot.status === 'short' ? L.short : arm === lot.i ? L.confirmBtn : L.buy}</span>
        </button>
      {/each}
    </div>
    {#if armed}
      <div class="ac-confirm">
        <p class="fs-sm" data-auction-confirm>{armed.confirm}</p>
        <button class="btn" data-act="auction-cancel" onclick={() => (arm = null)}>{L.cancel}</button>
      </div>
    {/if}
    <p class="muted fs-xs" data-auction-odds>{v.odds}</p>
    <div class="ac-shelf" role="group" aria-label={v.shelf.title}>
      <div class="ac-shelf-title fs-xs muted">{v.shelf.title}</div>
      {#each v.shelf.rows as row (row.k)}
        <div class="ac-row">
          <span class="ac-row-icon"><AuctionIcon d={row.icon} size={18} /></span>
          <span class="ac-row-name fs-xs">{row.name}</span>
          <span class="ac-cells">
            {#each row.cells as c (c.g)}<i class="g{c.g}" class:on={c.on} title={c.label} aria-label={c.label}></i>{/each}
          </span>
        </div>
      {/each}
    </div>
    <p class="muted fs-xs">{v.note}</p>
  </section>
{/if}

<style>
  .ac-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 6px;
  }
  .ac-head h2 {
    margin: 0;
  }
  .ac-lots {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    margin: 8px 0;
  }
  .ac-lot {
    display: grid;
    justify-items: center;
    gap: 6px;
    min-width: 0;
    padding: 12px 6px 10px;
    border-radius: var(--radius-md, 12px);
    border: 1px solid var(--line);
    background: var(--surface-2);
    color: var(--ink);
    font: inherit;
    cursor: pointer;
  }
  .ac-lot.on {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent);
  }
  .ac-lot:disabled {
    cursor: default;
    opacity: 0.55;
  }
  .ac-lot[data-lot='got'] {
    opacity: 0.45;
  }
  .ac-name {
    font-size: 0.8rem;
    line-height: 1.25;
    text-align: center;
    overflow-wrap: anywhere;
  }
  .ac-confirm {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }
  .ac-confirm p {
    flex: 1;
    margin: 0;
    color: var(--bad);
  }
  .ac-confirm .btn {
    flex: none;
    white-space: nowrap;
  }
  .ac-shelf {
    display: grid;
    gap: 4px;
    margin: 10px 0 8px;
    padding: 10px 12px;
    border-radius: var(--radius-md, 12px);
    background: var(--surface-2);
  }
  .ac-row {
    display: grid;
    grid-template-columns: 18px 1fr auto;
    align-items: center;
    gap: 8px;
  }
  .ac-row-icon {
    color: var(--muted);
  }
  .ac-cells {
    display: flex;
    gap: 6px;
  }
  .ac-cells i {
    --gc: var(--muted);
    width: 14px;
    height: 14px;
    border-radius: 4px;
    border: 1.5px solid color-mix(in srgb, var(--gc) 60%, transparent);
  }
  .ac-cells i.g2 {
    --gc: var(--r2);
  }
  .ac-cells i.g3 {
    --gc: var(--r3);
  }
  .ac-cells i.g4 {
    --gc: var(--accent);
  }
  .ac-cells i.on {
    background: var(--gc);
    border-color: var(--gc);
  }
</style>
