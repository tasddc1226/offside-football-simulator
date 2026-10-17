<script lang="ts">
  // T-11-355 상품 위치 안내 — 설정과 선수 만들기 후보 단계에서 "스카우트권·강화권은 여기서"를 한 번 알려 준다.
  // 한쪽에서 닫으면 두 곳 모두 그 기기에서 다시 뜨지 않는다(app-core firstGuide 'items').
  import { closeGuide, guideOpen } from '@offside/app-core/firstGuide';
  import { firstGuideText as L } from '@offside/app-core/i18n/ko/firstGuide';
  import { goRerollShop } from './nav.js';

  let open = $state(guideOpen('items'));
  function close() {
    closeGuide('items');
    open = false;
  }
</script>

{#if open}
  <section class="card items-hint" data-items-hint>
    <div class="ih-text">
      <b>{L.itemsTitle}</b>
      <p class="muted fs-sm">{L.itemsBody}</p>
      <button class="btn btn-sm" data-act="items-hint-shop" onclick={goRerollShop}>{L.shopGo}</button>
    </div>
    <button class="icon-btn" data-act="items-hint-close" aria-label={L.itemsCloseAria} onclick={close}>{L.close}</button>
  </section>
{/if}

<style>
  .items-hint { display: flex; align-items: flex-start; gap: 12px; border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent); }
  .ih-text { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
  .ih-text p { margin: 0; overflow-wrap: anywhere; }
  .icon-btn { flex: none; }
</style>
