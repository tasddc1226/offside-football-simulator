<script lang="ts">
  // T-11-377 선수 이름 변경권(앱 owner/RenameShop.tsx) — 강화권 상점 아래. 웹은 스토어 결제를 하지 않아, 가진 변경권이 있을 때만
  // 장수와 쓰는 곳 · '앱에서 살 수 있어요'를 보인다(다른 상점과 같은 30초 메모라 따로 묻지 않는 셈이다).
  import { fetchItems } from '@offside/app-core/api/cup';
  import { renameText as L } from '@offside/app-core/i18n/ko/rename';

  let have = $state(0);
  $effect(() => void fetchItems().then((r) => r.ok && (have = r.data.rename ?? 0)));
</script>

{#if have > 0}
  <section class="card rs" aria-label={L.shopTitle} data-rename-shop>
    <small class="eyebrow">Rename</small>
    <h2>{L.shopTitle}</h2>
    <span class="muted fs-sm" data-rename-shop-sub>{L.shopHave({ n: have })}</span>
    <p class="muted fs-sm">{L.shopNote} {L.shopWeb}</p>
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
