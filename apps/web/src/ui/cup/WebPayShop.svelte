<script lang="ts">
  // T-11-454 웹에서 사기(토스페이먼츠). 서버가 웹 결제를 연 구단주에게만 보인다(GET /v1/web-pay/config, 10분 메모). 상품을
  // 고르면 결제 수단 · 약관 위젯을 카드 안에 그리고, '결제하기'를 누를 때 주문을 만들어(금액은 서버가 정한다) 토스 결제창으로 간다.
  import { createWebPayOrder } from '@offside/app-core/api/webPay';
  import { webPayText as L } from '@offside/app-core/i18n/ko/webPay';
  import { toast } from '../helpers.js';
  import { loadWebPay, mountWidgets, returnUrls, webPay } from './webPay.svelte.js';

  type Widgets = Awaited<ReturnType<typeof mountWidgets>>;

  const config = $derived(webPay.config?.enabled ? webPay.config : null);
  let picked = $state<string | null>(null);
  let opening = $state(false);
  let busy = $state(false);
  let widgets: Widgets | null = null;
  const product = $derived(config?.products?.find((p) => p.productId === picked) ?? null);
  const won = (n: number) => n.toLocaleString('ko-KR');

  $effect(() => void loadWebPay());

  async function pick(productId: string) {
    if (!config || opening || busy) return;
    const p = config.products?.find((x) => x.productId === productId);
    if (!p) return;
    picked = productId;
    opening = true;
    try {
      if (widgets) await widgets.setAmount({ currency: 'KRW', value: p.amount });
      else widgets = await mountWidgets(config, p.amount, '#wp-methods', '#wp-agreement');
    } catch {
      picked = null;
      widgets = null;
      toast(L.startFail);
    } finally {
      opening = false;
    }
  }

  async function pay() {
    if (!product || !widgets || busy) return;
    busy = true;
    const r = await createWebPayOrder(product.productId);
    if (!r.ok) {
      busy = false;
      return toast(r.error.message || L.startFail);
    }
    try {
      // 결제창이 같은 탭에서 토스로 넘어간다. 돌아오면 main.ts가 승인한다.
      await widgets.requestPayment({ ...r.data, ...returnUrls() });
    } catch (e) {
      const code = (e as { code?: string }).code;
      toast(code === 'USER_CANCEL' || code === 'PAY_PROCESS_CANCELED' ? L.canceled : L.startFail);
    } finally {
      busy = false;
    }
  }
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
            class:on={picked === p.productId}
            disabled={opening || busy || webPay.confirming}
            aria-pressed={picked === p.productId}
            onclick={() => pick(p.productId)}
            data-web-pay-product={p.productId}
          >
            <span>{L.pack({ item: p.item, n: p.qty })}</span>
            <b>{L.price({ won: won(p.amount) })}</b>
          </button>
        </li>
      {/each}
    </ul>
    <div class:wp-hidden={!picked}>
      <div id="wp-methods"></div>
      <div id="wp-agreement"></div>
      {#if opening}<p class="muted fs-sm">{L.opening}</p>{/if}
      {#if product && !opening}
        <div class="wp-actions">
          <button class="btn btn-primary" disabled={busy} onclick={pay} data-web-pay-submit>
            {L.pay({ won: won(product.amount) })}
          </button>
          <button class="btn" disabled={busy} onclick={() => (picked = null)}>{L.cancel}</button>
        </div>
      {/if}
    </div>
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
  .wp-item.on {
    border-color: var(--accent);
  }
  .wp-hidden {
    display: none;
  }
  .wp-actions {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }
</style>
