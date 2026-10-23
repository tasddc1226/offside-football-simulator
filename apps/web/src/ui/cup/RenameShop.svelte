<script lang="ts">
  // T-11-377 선수 이름 변경권(앱 owner/RenameShop.tsx) — 강화권 상점 아래. 장수는 다른 상점과 같은 30초 메모라 따로 묻지 않는
  // 셈이다. T-11-471 웹 결제가 열려 있으면 쓰는 곳 아래에 웹 결제 묶음을 보이고(가진 장수가 없어도 카드를 보인다), 닫혀 있으면
  // 가진 변경권이 있을 때만 장수와 쓰는 곳 · '앱에서 살 수 있어요'를 보인다.
  import { fetchItems } from '@offside/app-core/api/cup';
  import { hasSessionHint } from '@offside/app-core/api/client';
  import { renameText as L } from '@offside/app-core/i18n/ko/rename';
  import WebPayPacks from './WebPayPacks.svelte';
  import { loadWebPay, webPay } from './webPay.svelte.js';

  let have = $state(0);
  const sells = $derived(!!webPay.config?.enabled);
  $effect(() => void fetchItems().then((r) => r.ok && (have = r.data.rename ?? 0)));
  $effect(() => {
    if (hasSessionHint()) void loadWebPay();
  });
</script>

{#if have > 0 || sells}
  <section class="card rs" aria-label={L.shopTitle} data-rename-shop>
    <small class="eyebrow">Rename</small>
    <h2>{L.shopTitle}</h2>
    <span class="muted fs-sm" data-rename-shop-sub>{L.shopHave({ n: have })}</span>
    {#if sells}
      <p class="muted fs-sm">{L.shopNote}</p>
      <WebPayPacks item="rename" />
    {:else}
      <p class="muted fs-sm">{L.shopNote} {L.shopWeb}</p>
    {/if}
  </section>
{/if}

<style>
  .rs {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .rs h2,
  .rs p {
    margin: 0;
  }
  .rs p {
    margin-top: 8px;
  }
</style>
