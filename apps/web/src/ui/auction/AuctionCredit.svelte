<script lang="ts">
  // T-11-735 은퇴 리포트 · 명예의 전당의 '대표 소장품' 장면 — 높은 등급 순 3개. LateCredits와 함께 지연 로드된다.
  import { auctionCredit } from '@offside/app-core/auction-view';
  import { gameAuctionText as L } from '@offside/app-core/i18n/ko/gameAuction';
  import type { AuctionKind } from '@offside/game/types';
  import AuctionIcon from './AuctionIcon.svelte';

  const {
    items,
    reveal,
  }: {
    items: { k: AuctionKind; g: number }[];
    reveal: (el: HTMLElement) => { destroy: () => void } | undefined;
  } = $props();
  const list = $derived(auctionCredit(items));
</script>

<section class="film-style" data-credit="auction" use:reveal>
  <div class="eyebrow film-kicker">Collection</div>
  <h2>{L.creditTitle}</h2>
  <ul class="ac-credit">
    {#each list as x (x.k + x.g)}
      <li class="g{x.g}" data-item={`${x.k}-${x.g}`}>
        <span class="ac-ring"><AuctionIcon d={x.icon} size={30} /></span>
        <b>{x.name}</b>
        <span class="pill">{x.grade}</span>
      </li>
    {/each}
  </ul>
</section>

<style>
  .ac-credit {
    list-style: none;
    margin: 8px 0 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }
  .ac-credit li {
    --gc: currentColor;
    display: grid;
    justify-items: center;
    gap: 6px;
    text-align: center;
    min-width: 0;
  }
  .ac-credit li.g3,
  .ac-credit li.g4 {
    --gc: var(--film-gold);
  }
  .ac-ring {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    color: var(--gc);
    border: 1.5px solid var(--gc);
  }
  .ac-credit b {
    font-size: 0.85rem;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }
  .ac-credit li.g4 .pill {
    color: var(--film-gold);
    border-color: currentColor;
    font-weight: 800;
  }
</style>
