<script lang="ts">
  // T-11-512 클럽 멤버십(내 구단 화면 '클럽 멤버십' 칸으로 연다). 열 때 한 번 상태(1분 메모)를 받는다. 혜택과 지금 상태를
  // 보이고, 받은 혜택 끝은 이 브라우저에 남겨 그때까지 웹 광고를 끈다. T-11-591부터 웹 결제가 열린 구단주는 자동 갱신 없는
  // 기간권을 웹에서 산다(엑솔라). 앱 구독 중이면 사지 않게 버튼을 숨긴다.
  import PopSheet from '../PopSheet.svelte';
  import Skeleton from '../Skeleton.svelte';
  import type { MembershipResponse } from '@offside/contracts';
  import { fetchMembership } from '@offside/app-core/api/membership';
  import { needsOwnerLogin } from '@offside/app-core/market';
  import { memberPerks, memberStatusText } from '@offside/app-core/membership-view';
  import { membershipText as L } from '@offside/app-core/i18n/ko/membership';
  import { rememberMember } from '../../ads/ads';
  import { hasSessionHint } from '@offside/app-core/api/client';
  import { loadWebPay, startWebPay, webPay } from '../cup/webPay.svelte.js';

  const { onclose }: { onclose: () => void } = $props();

  let m = $state<MembershipResponse | null>(null);
  let failed = $state<'login' | 'error' | null>(null);

  async function load() {
    failed = null;
    const r = await fetchMembership();
    if (!r.ok) {
      failed = needsOwnerLogin(r.error) ? 'login' : 'error';
      return;
    }
    m = r.data;
    rememberMember(r.data.active ? r.data.until : null);
  }
  void load();
  if (hasSessionHint()) void loadWebPay();
  let seenPaid = webPay.paid;
  $effect(() => {
    if (webPay.paid !== seenPaid) {
      seenPaid = webPay.paid;
      void load();
    }
  });
  const webMember = $derived(webPay.config?.enabled ? webPay.config.membership : undefined);
  // 앱 스토어 구독 중이면 웹 기간권을 팔지 않는다(두 번 내지 않게). 웹 기간권 중이면 이어서 산다.
  const canWebBuy = $derived(!!webMember && !!m && (!m.active || m.store === null));

  const line = $derived(m ? memberStatusText(m) : null);
</script>

<PopSheet label={L.title} step={m ? 'member' : 'load'} {onclose}>
  <div class="stack mb" data-membership>
    <div class="mb-head">
      <h2>{L.title}</h2>
      <button class="btn btn-sm" data-act="member-close" onclick={onclose}>{L.back}</button>
    </div>
    {#if failed === 'login'}
      <p>{L.login}</p>
    {:else if failed}
      <p role="alert">{L.loadFail}</p>
      <button class="btn" onclick={() => void load()}>{L.retry}</button>
    {:else if !m}
      <Skeleton rows={5} />
    {:else}
      <section class="mb-band stack" data-member-state={m.active ? 'active' : 'none'}>
        <div class="mb-band-top">
          <b>{m.active ? L.active : L.lead}</b>
          {#if m.active}<span class="mb-pill">{L.badge}</span>{/if}
        </div>
        {#if line}<span class="fs-sm mb-soft">{line}</span>{/if}
      </section>
      <ul class="mb-perks">
        {#each memberPerks() as p (p.key)}
          <li><b>{p.title}</b><span class="muted fs-sm">{p.sub}</span></li>
        {/each}
      </ul>
      {#if canWebBuy && webMember}
        <button class="btn btn-primary btn-block" data-act="member-web-buy" disabled={webPay.busy} onclick={() => void startWebPay(webMember.productId, 'member')}>{L.webBuy({ price: webMember.amount.toLocaleString('ko-KR'), days: webMember.days })}</button>
        <p class="fs-xs muted">{L.webOnce}</p>
      {:else if m.active}
        <p class="fs-sm muted">{L.manageHint}</p>
      {:else}
        <p class="fs-sm muted" data-member-web-join>{m.stores.length ? L.webJoin : L.notOnSale}</p>
        <p class="fs-xs muted">{L.renewNote}</p>
      {/if}
      <p class="fs-xs muted">{L.adOwned}</p>
    {/if}
  </div>
</PopSheet>

<style>
  .mb {gap:12px;padding:4px 16px 20px;}
  .mb-head {display:flex;align-items:center;gap:8px;}
  .mb-head h2 {flex:1;margin:0;font-size:1.1rem;}
  .mb-band {gap:6px;padding:16px;border-radius:var(--radius-md);background:var(--pitch);color:var(--on-pitch);}
  .mb-band-top {display:flex;justify-content:space-between;align-items:center;gap:12px;}
  .mb-soft {opacity:.85;}
  .mb-pill {font-size:12px;font-weight:700;padding:2px 8px;border-radius:6px;background:var(--pitch-accent);color:var(--pitch);}
  .mb-perks {list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px;}
  .mb-perks li {display:flex;flex-direction:column;gap:2px;padding:12px;border-radius:var(--radius-md);border:1px solid var(--line);background:var(--surface);}
</style>
