<script lang="ts">
  // T-11-152 리롤권 상점(구단주 화면). 구단 자금으로 선수 후보 리롤권을 산다. 접힌 카드에는 가진 장수만 보이고(후보 화면과
  // 같은 30초 메모), 상점 값은 펼칠 때만 묻는다. 사면 서버가 돌려준 상점 값으로 바꾸고 onbought로 구단주 화면의 자금 줄을
  // 새 잔액으로 고친다(다시 묻지 않는다). focus면(후보 화면 '리롤권 상점 가기') 펼친 채로 열고 카드로 내려간다.
  import { buyReroll, fetchItems, fetchRerollShop, type RerollShopResponse } from '@offside/app-core/api/cup';
  import { cupText as L } from '@offside/app-core/i18n/ko/cup';
  import { fundsText } from '@offside/app-core/market';
  import { rerollShopState } from '@offside/app-core/rerollShop';
  import { toast } from '../helpers.js';

  let { onbought, focus = false }: { onbought?: (balance: number, spent: number) => void; focus?: boolean } = $props();

  let open = $state(false);
  let have = $state<number | null>(null);
  let card: HTMLElement;
  let shop = $state<RerollShopResponse | null>(null);
  let failed = $state(false);
  let busy = $state(false);
  // 한 번의 '사기' 시도에 멱등 키 하나 — 응답을 못 받아(네트워크) 다시 누르면 같은 키로 보내 두 장을 사지 않는다.
  let buyKey: string | null = null;
  const view = $derived(shop ? rerollShopState(shop) : null);

  async function load() {
    const r = await fetchRerollShop();
    failed = !r.ok;
    if (r.ok) {
      shop = r.data;
      have = r.data.reroll;
    }
  }
  $effect(() => {
    if (!focus) return void fetchItems().then((r) => r.ok && have === null && (have = r.data.reroll));
    // 펼친 채로 열면 상점 응답에 가진 장수가 있어 따로 묻지 않는다.
    open = true;
    void load();
    card.scrollIntoView({ block: 'center' });
  });
  function toggle() {
    open = !open;
    if (open && !shop) void load();
  }
  async function buy() {
    if (busy || !shop || shop.price === null) return;
    const price = shop.price;
    if (!confirm(L.shopConfirm({ price: fundsText(price), balance: fundsText(shop.balance - price) }))) return;
    busy = true;
    buyKey ??= crypto.randomUUID();
    const r = await buyReroll(price, buyKey);
    busy = false;
    if (r.ok || !r.error.retryable) buyKey = null;
    if (!r.ok) {
      // 다시 해도 안 되는 거절(가격이 바뀜 · 상한 · 자금 부족)이면 상점 값을 다시 받는다.
      if (!r.error.retryable) void load();
      return toast(r.error.message || L.shopFail);
    }
    shop = r.data;
    have = r.data.reroll;
    toast(L.shopDone({ n: r.data.reroll }));
    onbought?.(r.data.balance, price);
  }
</script>

<section class="card rs" aria-label={L.shopTitle} data-reroll-shop bind:this={card}>
  <div class="rs-head">
    <div class="rs-who">
      <small class="eyebrow">Reroll shop</small>
      <h2>{L.shopTitle}</h2>
      <span class="muted fs-sm" data-reroll-sub>{have === null ? L.shopSub : L.shopSubHave({ n: have })}</span>
    </div>
    <button class="btn" data-act="reroll-shop" aria-expanded={open} onclick={toggle}>{open ? L.shopClose : L.shopOpen}</button>
  </div>
  {#if open}
    {#if shop && view}
      <ul class="rs-facts">
        <li data-reroll-have>{L.shopHave({ n: shop.reroll })}</li>
        <li>{L.shopFunds({ funds: fundsText(shop.balance) })}</li>
        <li data-reroll-today>{L.shopToday({ bought: shop.bought, cap: shop.cap })}</li>
      </ul>
      {#if view === 'closed'}
        <p class="muted fs-sm">{L.shopClosed}</p>
      {:else if view === 'soldOut'}
        <p class="muted fs-sm" data-reroll-soldout>{L.shopSoldOut}</p>
      {:else}
        <p class="rs-price" data-reroll-price>{L.shopPrice({ price: fundsText(shop.price!) })}</p>
        {#if view === 'short'}<p class="muted fs-sm">{L.shopShort}</p>{/if}
        <button class="btn btn-primary btn-block" data-act="reroll-buy" disabled={busy || view === 'short'} onclick={buy}>
          {busy ? L.shopBusy : L.shopBuy({ price: fundsText(shop.price!) })}
        </button>
      {/if}
      <p class="muted fs-sm">{L.shopNote}</p>
    {:else}
      <p class="muted fs-sm">{failed ? L.shopLoadFail : '…'}</p>
    {/if}
  {/if}
</section>

<style>
  .rs {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .rs-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .rs-head .btn {
    flex: none;
  }
  .rs-who {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .rs-who h2 {
    margin: 0;
  }
  .rs-facts {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .rs-facts li {
    padding: 6px 10px;
    border-radius: 10px;
    background: var(--surface-2);
    font-size: 0.8125rem;
    font-variant-numeric: tabular-nums;
  }
  .rs-price {
    margin: 0;
    font-family: var(--display);
    font-size: 1.125rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .rs p {
    margin: 0;
  }
</style>
