<script lang="ts">
  // T-11-454 웹에서 사기(엑솔라). 서버가 웹 결제를 연 구단주에게만 보인다(GET /v1/web-pay/config, 10분 메모). 상품을 누르면
  // 서버가 주문과 엑솔라 결제창 주소를 만들고 같은 탭에서 결제창으로 간다. 나라별 통화 · 세금 · 결제 수단은 결제창이 정한다.
  import { webPayText as L } from '@offside/app-core/i18n/ko/webPay';
  import { loadWebPay, startWebPay, webPay } from './webPay.svelte.js';

  const config = $derived(webPay.config?.enabled ? webPay.config : null);
  const won = (n: number) => n.toLocaleString('ko-KR');

  $effect(() => void loadWebPay());
</script>

{#if config}
  <section class="card wp" aria-label={L.title} data-web-pay-shop>
    <small class="eyebrow">Web shop</small>
    <h2>{L.title}</h2>
    <span class="muted fs-sm">{L.sub}</span>
    <ul class="wp-list">
      {#each config.products ?? [] as p (p.productId)}
        <li>
          <button
            class="wp-item"
            disabled={webPay.busy}
            onclick={() => startWebPay(p.productId)}
            data-web-pay-product={p.productId}
          >
            <span>{L.pack({ item: p.item, n: p.qty })}</span>
            <b>{L.price({ won: won(p.amount) })}</b>
          </button>
        </li>
      {/each}
    </ul>
    <p class="muted fs-sm">{L.priceNote}</p>
    <p class="muted fs-sm">{L.refund}</p>
  </section>
{/if}

<style>
  .wp {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .wp h2,
  .wp p {
    margin: 0;
  }
  .wp p {
    margin-top: 8px;
  }
  .wp-list {
    list-style: none;
    margin: 10px 0 0;
    padding: 0;
    display: grid;
    gap: 6px;
  }
  .wp-item {
    width: 100%;
    display: flex;
    justify-content: space-between;
    gap: 8px;
    padding: 10px 12px;
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
</style>
