<script lang="ts">
  // T-11-471 웹 결제 묶음(앱 owner/IapPacks.tsx) — 앱이 스토어 묶음을 보이는 자리(상점 카드 · 선수 탭 잠재력 강화 · 이름 변경 창)에
  // 그 아이템의 엑솔라 상품만 같은 가격으로 보인다. 서버가 웹 결제를 연 구단주에게만 보이고(GET /v1/web-pay/config, 10분 메모라
  // 여러 묶음이 같이 불러도 한 번 묻는다), 로그인 전이면 묻지 않는다. 상품을 누르면 같은 탭에서 결제창으로 가고, 끝나면 back 화면으로 돌아온다.
  import type { OwnerItem } from '@offside/contracts/cup';
  import { hasSessionHint } from '@offside/app-core/api/client';
  import { webPayText as L } from '@offside/app-core/i18n/ko/webPay';
  import { loadWebPay, startWebPay, webPay, commerceEntry, type WebPayBack } from './webPay.svelte.js';
  import { trackCommerce } from '../../analytics/index.js';
  import { observeOfferView } from '@offside/app-core/offerVisibility';

  let { item, note, back = 'owner' }: { item: OwnerItem; note?: string; back?: WebPayBack } = $props();

  const packs = $derived(
    webPay.config?.enabled ? (webPay.config.products ?? []).filter((p) => p.item === item) : [],
  );
  const won = (n: number) => n.toLocaleString('ko-KR');

  $effect(() => {
    if (hasSessionHint()) void loadWebPay();
  });

  // 구매 퍼널 노출(commerceStage): 강화권 · 스카우트권 묶음이 화면에 절반 이상(intersectionRatio ≥ 0.5) 들어오고 버튼이 활성일
  // 때 이 자리에서 한 번. 마운트만으로는 남기지 않고, IntersectionObserver가 없으면 남기지 않는다. 그 순간 동의 · 태그가 준비되지
  // 않았으면 이 자리의 노출은 버린다(나중에 다시 보내지 않는다).
  let seen = false;
  function offerView(node: HTMLElement) {
    if (seen || (item !== 'boost' && item !== 'scout')) return;
    const commerceItem = item;
    const destroy = observeOfferView(node, {
      IO: typeof IntersectionObserver === 'undefined' ? undefined : IntersectionObserver,
      ready: () => !webPay.busy,
      onShown: () => {
        seen = true;
        trackCommerce({ stage: 'offer_view', item: commerceItem, entry: commerceEntry(back), store: 'xsolla' });
      },
    });
    return { destroy };
  }
</script>

{#if packs.length}
  <div class="wpp" data-web-pay-packs={item} use:offerView>
    <small class="eyebrow">{L.title}</small>
    {#each packs as p (p.productId)}
      <button
        class="btn btn-block"
        disabled={webPay.busy}
        onclick={() => startWebPay(p.productId, back)}
        data-web-pay-product={p.productId}
      >
        {L.pack({ item: p.item, n: p.qty })} · {L.price({ won: won(p.amount) })}
      </button>
    {/each}
    {#if note}<p class="muted fs-sm">{note}</p>{/if}
    <p class="muted fs-xs">{L.sub} {L.priceNote}</p>
    <p class="muted fs-xs">{L.refund}</p>
  </div>
{/if}

<style>
  .wpp {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .wpp p {
    margin: 0;
  }
</style>
