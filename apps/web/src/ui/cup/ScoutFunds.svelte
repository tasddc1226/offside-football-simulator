<script lang="ts">
  // T-11-244 프리미엄 스카우트권을 구단 자금으로 사기(한 주 상한, 앱 owner/ScoutFunds.tsx). 누를 때만 상점 값을 묻고(리롤권
  // 상점과 같은 30초 메모), 사면 서버가 돌려준 값으로 바꾼다. onbought로 가진 장수와 구단주 화면의 자금 줄을 고친다.
  import { buyScoutWithFunds, fetchRerollShop, type RerollShopResponse } from '@offside/app-core/api/cup';
  import { cupText as CL } from '@offside/app-core/i18n/ko/cup';
  import { scoutText as L } from '@offside/app-core/i18n/ko/scout';
  import { fundsText } from '@offside/app-core/market';
  import { scoutShopState } from '@offside/app-core/rerollShop';
  import { toast } from '../helpers.js';

  let { onbought }: { onbought?: (have: number, balance: number, spent: number) => void } = $props();

  let open = $state(false);
  let shop = $state<RerollShopResponse | null>(null);
  let failed = $state(false);
  let busy = $state(false);
  let buyKey: string | null = null;
  const view = $derived(shop ? scoutShopState(shop) : null);

  async function load() {
    const r = await fetchRerollShop();
    failed = !r.ok;
    if (r.ok) shop = r.data;
  }
  function toggle() {
    open = !open;
    if (open && !shop) void load();
  }
  async function buy() {
    const price = shop?.scout?.price;
    if (busy || !shop || !price) return;
    if (!confirm(L.fundsConfirm({ price: fundsText(price), balance: fundsText(shop.balance - price) }))) return;
    busy = true;
    buyKey ??= crypto.randomUUID();
    const r = await buyScoutWithFunds(price, buyKey);
    busy = false;
    if (r.ok || !r.error.retryable) buyKey = null;
    if (!r.ok) {
      if (!r.error.retryable) void load();
      return toast(r.error.message || L.fundsFail);
    }
    shop = r.data;
    const have = r.data.scout?.have ?? 0;
    toast(L.fundsDone({ n: have }));
    onbought?.(have, r.data.balance, price);
  }
</script>

<button class="btn btn-sm self-start" data-act="scout-funds" aria-expanded={open} onclick={toggle}>{L.funds}</button>
{#if open}
  {#if shop && view && shop.scout}
    <ul class="sf-facts">
      <li>{CL.shopFunds({ funds: fundsText(shop.balance) })}</li>
      <li data-scout-week>{L.fundsWeek({ bought: shop.scout.bought, cap: shop.scout.cap })}</li>
    </ul>
    {#if view === 'closed'}
      <p class="muted fs-sm">{L.fundsClosed}</p>
    {:else if view === 'soldOut'}
      <p class="muted fs-sm" data-scout-soldout>{L.fundsSoldOut}</p>
    {:else}
      {#if view === 'short'}<p class="muted fs-sm">{CL.shopShort}</p>{/if}
      <button class="btn btn-primary btn-block" data-act="scout-funds-buy" disabled={busy || view === 'short'} onclick={buy}>
        {busy ? CL.shopBusy : CL.shopBuy({ price: fundsText(shop.scout.price!) })}
      </button>
    {/if}
    <p class="muted fs-sm">{L.fundsNote}</p>
  {:else}
    <p class="muted fs-sm">{failed ? CL.shopLoadFail : '…'}</p>
  {/if}
{/if}

<style>
  .sf-facts {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 8px 0 0;
    padding: 0;
    list-style: none;
  }
  .sf-facts li {
    padding: 6px 10px;
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    font-size: var(--fs-label);
    font-variant-numeric: tabular-nums;
  }
</style>
