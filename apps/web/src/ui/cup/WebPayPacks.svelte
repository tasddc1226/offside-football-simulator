<script lang="ts">
  // T-11-471 웹 결제 묶음(앱 owner/IapPacks.tsx) — 앱이 스토어 묶음을 보이는 자리(상점 카드 · 선수 탭 잠재력 강화 · 이름 변경 창)에
  // 그 아이템의 엑솔라 상품만 같은 가격으로 보인다. 서버가 웹 결제를 연 구단주에게만 보이고(GET /v1/web-pay/config, 10분 메모라
  // 여러 묶음이 같이 불러도 한 번 묻는다), 로그인 전이면 묻지 않는다. 상품을 누르면 같은 탭에서 결제창으로 가고, 끝나면 back 화면으로 돌아온다.
  // T-11-736 상품을 누르면 바로 결제창으로 가지 않고 이 자리에서 무엇을 얼마에 사는지 한 번 더 보여 준다. 결제창을 연 주문의 9%만
  // 결제됐다(10-30 ~ 11-16, 가장 싼 강화권 3장은 156번 중 2번). 한국어 화면은 여기서 카카오페이 · 다른 수단을 골라 엑솔라의
  // 수단 고르기 단계를 건너뛴다(카카오페이는 서버가 한국 요청에만 싣는다).
  import type { OwnerItem } from '@offside/contracts/cup';
  import type { WebPayMethod } from '@offside/app-core/api/webPay';
  import { getLocale } from '@offside/contracts/i18n';
  import { hasSessionHint } from '@offside/app-core/api/client';
  import { webPayText as L } from '@offside/app-core/i18n/ko/webPay';
  import { loadWebPay, startWebPay, webPay, commerceEntry, type WebPayBack } from './webPay.svelte.js';
  import { trackCommerce } from '../../analytics/index.js';
  import { observeOfferView } from '@offside/app-core/offerVisibility';
  import { packUnits } from '@offside/app-core/packCompare';
  import { scoutText as SL } from '@offside/app-core/i18n/ko/scout';

  let { item, note, back = 'owner' }: { item: OwnerItem; note?: string; back?: WebPayBack } = $props();

  const packs = $derived(
    webPay.config?.enabled ? (webPay.config.products ?? []).filter((p) => p.item === item) : [],
  );
  const won = (n: number) => n.toLocaleString('ko-KR');
  // T-11-770a 스카우트권 묶음의 장당 가격(웹 가격은 원화 한 가지라 그대로 나눈다). 묶음이 하나면 적지 않는다.
  const units = $derived(
    item === 'scout' ? packUnits(packs.map((p) => ({ qty: p.qty, amount: p.amount, currency: 'KRW' })), 'ko-KR') : [],
  );
  /** 확인 단계를 연 상품. 누른 묶음 바로 아래에서 무엇을 얼마에 사는지 다시 보여 준다. */
  let chosen = $state<string | null>(null);
  const pick = $derived(packs.find((p) => p.productId === chosen) ?? null);
  // 카카오페이는 한국 결제 수단이라 한국어 화면에서만 따로 고르게 한다.
  const kakao = getLocale() === 'ko';

  function choose(productId: string) {
    chosen = chosen === productId ? null : productId;
    if (chosen && (item === 'boost' || item === 'scout'))
      trackCommerce({ stage: 'offer_select', item, entry: commerceEntry(back), store: 'xsolla' });
  }
  function pay(method?: WebPayMethod) {
    if (pick) void startWebPay(pick.productId, back, method);
  }

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
    {#each packs as p, i (p.productId)}
      {@const u = units[i]}
      <button
        class="btn btn-block"
        disabled={webPay.busy}
        aria-expanded={chosen === p.productId}
        onclick={() => choose(p.productId)}
        data-web-pay-product={p.productId}
      >
        {L.pack({ item: p.item, n: p.qty })} · {L.price({ won: won(p.amount) })}
      </button>
      {#if u?.value != null}
        <p class="muted fs-xs wpp-unit" data-web-pay-unit={p.productId}>
          {SL.unit({ price: L.price({ won: won(u.value) }) })}{#if u.lowest} · {SL.unitLowest}{/if}
        </p>
      {/if}
      {#if pick?.productId === p.productId}
        <div class="wpp-confirm" data-web-pay-confirm={p.productId}>
          <p class="wpp-sum">{L.confirmSum({ pack: L.pack({ item: p.item, n: p.qty }), price: L.price({ won: won(p.amount) }) })}</p>
          <p class="muted fs-sm">{L.confirmLead}</p>
          {#if kakao}
            <button class="btn btn-primary btn-block" disabled={webPay.busy} onclick={() => pay('kakaopay')} data-act="web-pay-kakao">{L.payKakao}</button>
            <button class="btn btn-block" disabled={webPay.busy} onclick={() => pay()} data-act="web-pay-other">{L.payOther}</button>
          {:else}
            <button class="btn btn-primary btn-block" disabled={webPay.busy} onclick={() => pay()} data-act="web-pay-go">{L.payGo}</button>
          {/if}
          <button class="btn btn-sm wpp-cancel" disabled={webPay.busy} onclick={() => (chosen = null)} data-act="web-pay-cancel">{L.payCancel}</button>
        </div>
      {/if}
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
  .wpp-confirm {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    border-radius: var(--radius-sm);
    background: var(--surface-2);
  }
  .wpp-cancel {
    align-self: center;
  }
  .wpp-sum {
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
</style>
