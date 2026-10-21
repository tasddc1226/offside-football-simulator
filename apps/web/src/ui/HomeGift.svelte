<script lang="ts">
  // T-11-275 홈의 구단주 선물 — 오프사이드 컵 배너 바로 아래. 로그인한 구단주가 한 번 받으면 사라진다. 묻는 조건 · 메모는
  // app-core api/gift.ts. 첫 화면 번들 밖 지연 청크(Home.svelte가 import()로 부른다).
  import { claimHomeGift, fetchHomeGift, giftCopy, type HomeGift } from '@offside/app-core/api/gift';
  import { giftText as L } from '@offside/app-core/i18n/ko/gift';
  import { toast } from './helpers.js';

  let gift = $state<HomeGift | null>(null);
  let busy = $state(false);
  const copy = $derived(gift ? giftCopy(gift) : null);
  // 응답을 못 받아 다시 누르면 같은 키로 보내 서버가 두 번 주지 않는다(서버는 성공 · 409만 기억한다). 받은 뒤 다음
  // 선물(T-11-386)은 새 키로 받는다.
  let key = crypto.randomUUID();

  $effect(() => {
    void fetchHomeGift().then((g) => (gift = g));
  });

  async function claim() {
    if (!gift || busy) return;
    busy = true;
    const r = await claimHomeGift(gift.id, key);
    busy = false;
    if (r.ok) {
      toast(giftCopy(gift).done);
      key = crypto.randomUUID();
      gift = null;
    } else if (r.error.reason === 'GIFT_CLAIMED' || r.error.reason === 'GOOGLE_LOGIN_REQUIRED') {
      gift = null;
    } else {
      toast(L.fail);
    }
  }
</script>

{#if gift && copy}
  <section class="card home-gift" data-home-gift={gift.id}>
    <div class="hg-text">
      <small class="eyebrow">Gift</small>
      <b>{copy.title}</b>
      <span class="muted fs-sm">{copy.sub}</span>
    </div>
    <button class="btn btn-accent" onclick={claim} disabled={busy} data-act="home-gift-claim">{busy ? L.busy : L.btn}</button>
  </section>
{/if}

<style>
  .home-gift {
    display: flex;
    align-items: center;
    gap: 12px;
    border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
  }
  .hg-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .home-gift .btn {
    flex: none;
  }
</style>
