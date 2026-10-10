<script lang="ts">
  // T-11-178 잠재력 강화권 상점(앱 owner/BoostShop.tsx) — 리롤권 상점 아래. 웹은 스토어 결제를 하지 않아, 가진 강화권이 있을 때만
  // 장수와 '앱에서 살 수 있어요'를 보인다(리롤권 상점과 같은 30초 메모라 따로 묻지 않는 셈이다).
  import { fetchItems } from '@offside/app-core/api/cup';
  import { iapText as L } from '@offside/app-core/i18n/ko/iap';

  let have = $state(0);
  $effect(() => void fetchItems().then((r) => r.ok && (have = r.data.boost)));
</script>

{#if have > 0}
  <section class="card bs" aria-label={L.shopTitle} data-boost-shop>
    <small class="eyebrow">Boost shop</small>
    <h2>{L.shopTitle}</h2>
    <span class="muted fs-sm" data-boost-sub>{L.shopSubHave({ n: have })}</span>
    <p class="muted fs-sm">{L.shopWeb}</p>
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
