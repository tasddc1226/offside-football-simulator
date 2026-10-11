<script lang="ts">
  // T-11-196 프리미엄 스카우트권 상점(앱 owner/ScoutShop.tsx) — 잠재력 강화권 상점 아래. 웹은 스토어 결제를 하지 않아, 가진 장수와
  // '앱에서 살 수 있어요', 확률 공개표만 보인다. 장수는 강화권 상점과 같은 30초 메모를 쓴다.
  import { fetchItems } from '@offside/app-core/api/cup';
  import { scoutText as L } from '@offside/app-core/i18n/ko/scout';
  import ScoutOdds from './ScoutOdds.svelte';

  let have = $state(0);
  $effect(() => void fetchItems().then((r) => r.ok && (have = r.data.scout ?? 0)));
</script>

<section class="card ss" aria-label={L.title} data-scout-shop>
  <small class="eyebrow">Premium scout</small>
  <h2>{L.title}</h2>
  <span class="muted fs-sm" data-scout-sub>{have ? L.shopSubHave({ n: have }) : L.shopSub}</span>
  <p class="muted fs-sm">{L.what}</p>
  <p class="muted fs-sm">{L.shopWeb}</p>
  <ScoutOdds />
</section>

<style>
  .ss {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .ss h2,
  .ss p {
    margin: 0;
  }
  .ss p {
    margin-top: 8px;
  }
</style>
