<script lang="ts">
  // T-11-567 상점 — 구단주 화면의 '상점' 칸으로 연다. 예전에는 구단주 화면에 상점 넷이 줄줄이 펼쳐져 있었다.
  // 맨 위 자금 줄은 구단주 · 이적시장과 같은 응답(1분 메모)이라 다시 묻지 않고, 사면 상점이 돌려준 잔액으로 고친다.
  import Topbar from './Topbar.svelte';
  import AppConversion from './AppConversion.svelte';
  import LoginButtons from './LoginButtons.svelte';
  import BoostShop from './cup/BoostShop.svelte';
  import RenameShop from './cup/RenameShop.svelte';
  import ScoutShop from './cup/ScoutShop.svelte';
  import RerollShop from './cup/RerollShop.svelte';
  import { shellInstallText as Install } from '@offside/app-core/i18n/ko/shellInstall';
  import { fetchMarketFunds, type MarketFundsResponse } from '@offside/app-core/api/market';
  import { fundsText } from '@offside/app-core/market';
  import { ownerText as L } from '@offside/app-core/i18n/ko/owner';
  import { fundsHistoryText as F } from '@offside/app-core/i18n/ko/fundsHistory';
  import { isMember } from '@offside/app-core/account';
  import { onMount } from 'svelte';
  import { accountCache, ensureAccount } from './account-state.svelte.js';
  import { go, takeFocus } from './nav.js';

  // T-11-152 후보 화면 '리롤권 상점 가기'로 들어왔으면 리롤권 상점을 펼친 채로 연다(한 번만 읽힌다).
  const shopFocus = takeFocus('rerollShop');
  const linked = $derived.by(() => {
    const acct = accountCache.value;
    return !!acct && acct !== 'error' && isMember(acct);
  });
  const guest = $derived.by(() => {
    const acct = accountCache.value;
    return acct === null || (!!acct && acct !== 'error' && !isMember(acct));
  });
  let market = $state<MarketFundsResponse | null>(null);
  $effect(() => {
    if (!linked) return;
    void fetchMarketFunds().then((r) => {
      if (r.ok) market = r.data;
    });
  });
  const bought = (balance: number, spent: number) => market && (market = { balance, clubValue: market.clubValue - spent });
  // T-11-567 계정 카드가 설정으로 옮겨 가서, 로그인 여부는 이 화면이 직접 확인한다(5분 메모).
  onMount(ensureAccount);
</script>

<div class="wrap" data-shop>
  <Topbar />
  <header class="settings-head">
    <div class="eyebrow">Shop</div>
    <h1>{L.shopTitle}</h1>
  </header>

  {#if linked}
    <button class="card shop-funds" data-act="shop-funds" aria-label={F.openAria} onclick={() => go('funds')}>
      <span class="muted fs-sm">{L.statFunds}</span>
      <b data-shop-funds>{market ? fundsText(market.balance) : '–'}</b>
      <i aria-hidden="true">›</i>
    </button>
    <RerollShop focus={shopFocus} onbought={bought} />
    <BoostShop />
    <RenameShop />
    <ScoutShop onbought={bought} />
    <details class="card" data-app-shop-guide>
      <summary class="disc-row">{Install.conversionShopTitle}<span class="disc-chev" aria-hidden="true"></span></summary>
      <p class="muted fs-sm">{Install.conversionShopBody}</p>
      <AppConversion context="shop" />
    </details>
  {:else if guest}
    <section class="card" data-shop-guest>
      <p class="muted">{L.shopLoginNeeded}</p>
      <LoginButtons back={null} />
    </section>
  {/if}
</div>

<style>
  .shop-funds {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    border: 0;
    color: var(--ink);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .shop-funds b {
    flex: 1;
    font-family: var(--display);
    font-size: var(--fs-title3);
    font-variant-numeric: tabular-nums;
  }
  .shop-funds i {
    color: var(--muted);
    font-style: normal;
  }
</style>
