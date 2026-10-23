<script lang="ts">
  // T-11-178 잠재력 강화권 상점(앱 owner/BoostShop.tsx) — 리롤권 상점 아래. 장수는 리롤권 상점과 같은 30초 메모라 따로 묻지 않는
  // 셈이다. T-11-471 웹 결제가 열려 있으면 앱 스토어 묶음 자리에 웹 결제 묶음을 보이고(가진 장수가 없어도 카드를 보인다),
  // 닫혀 있으면 가진 강화권이 있을 때만 장수와 '앱에서 살 수 있어요'를 보인다.
  import { fetchItems } from '@offside/app-core/api/cup';
  import { hasSessionHint } from '@offside/app-core/api/client';
  import { iapText as L } from '@offside/app-core/i18n/ko/iap';
  import WebPayPacks from './WebPayPacks.svelte';
  import { loadWebPay, webPay } from './webPay.svelte.js';

  let have = $state(0);
  const sells = $derived(!!webPay.config?.enabled);
  $effect(() => void fetchItems().then((r) => r.ok && (have = r.data.boost)));
  $effect(() => {
    if (hasSessionHint()) void loadWebPay();
  });
</script>

{#if have > 0 || sells}
  <section class="card bs" aria-label={L.shopTitle} data-boost-shop>
    <small class="eyebrow">Boost shop</small>
    <h2>{L.shopTitle}</h2>
    <span class="muted fs-sm" data-boost-sub>{have ? L.shopSubHave({ n: have }) : L.shopSub}</span>
    {#if sells}<WebPayPacks item="boost" />{:else}<p class="muted fs-sm">{L.shopWeb}</p>{/if}
  </section>
{/if}

<style>
  .bs {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .bs h2,
  .bs p {
    margin: 0;
  }
  .bs p {
    margin-top: 8px;
  }
</style>
