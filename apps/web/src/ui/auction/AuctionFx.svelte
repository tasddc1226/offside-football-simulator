<script lang="ts">
  // T-11-735 명품 경매 상자 열기 연출. 결과는 이미 정해져 저장된 뒤에 연다 — 연출은 보여 주기만 한다(닫거나 새로고침해도 결과는 같다).
  // 1) 상자가 흔들리며 빛이 차오른다. 2) 상자가 열리고 등급색 빛과 함께 소장품이 나온다. 전설은 화면 전체가 금빛으로 번쩍인다.
  // 결과 화면은 눌러서 닫는다. 감속 모션이면 흔들림 없이 짧게 결과로 넘어간다.
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import type { AuctionOutcome } from '@offside/app-core/auction-view';
  import { gameAuctionText as L } from '@offside/app-core/i18n/ko/gameAuction';
  import { buzz, dur, motionOK } from '../motion.js';
  import AuctionIcon from './AuctionIcon.svelte';

  let { out, onDone }: { out: AuctionOutcome; onDone: () => void } = $props();

  const OPEN = motionOK ? 1300 : 250;
  let done = $state(false);
  let closeBtn = $state<HTMLButtonElement>();

  onMount(() => {
    const t = setTimeout(() => {
      done = true;
      buzz(out.g >= 4 ? 80 : out.g >= 3 ? 50 : 20);
      queueMicrotask(() => closeBtn?.focus());
    }, OPEN);
    return () => clearTimeout(t);
  });

  function onkeydown(e: KeyboardEvent) {
    if (done && e.key === 'Escape') onDone();
  }
</script>

<svelte:window {onkeydown} />

<div class="auction-fx g{out.g}" class:done class:legend={done && out.g === 4} data-auction-fx={done ? `g${out.g}` : 'opening'} role="dialog" aria-modal="true" aria-label={L.title} transition:fade={{ duration: dur(180) }}>
  <div class="af-card" aria-live="polite">
    <div class="eyebrow">Auction</div>
    <div class="af-stage" aria-hidden="true">
      {#if !done}
        <div class="af-box"><span class="af-lid"></span><span class="af-body"></span></div>
      {:else}
        <div class="af-item"><AuctionIcon d={out.icon} size={64} /></div>
      {/if}
    </div>
    {#if !done}
      <h2>{L.rolling}</h2>
    {:else}
      <h2 class="af-title">{out.title}</h2>
      <p class="fs-sm">{out.text}</p>
      <button class="btn btn-primary btn-block" data-act="auction-fx-close" bind:this={closeBtn} onclick={onDone}>{L.close}</button>
    {/if}
  </div>
</div>

<style>
  .auction-fx {
    --gc: var(--muted);
    position: fixed;
    inset: 0;
    z-index: 50;
    display: grid;
    place-items: center;
    padding: 16px;
    background: rgb(0 0 0 / 0.62);
  }
  .g2 {
    --gc: var(--r2);
  }
  .g3 {
    --gc: var(--r3);
  }
  .g4 {
    --gc: var(--accent);
  }
  .auction-fx.legend {
    background: radial-gradient(circle at 50% 45%, rgb(240 180 55 / 0.55), rgb(0 0 0 / 0.7) 70%);
  }
  .af-card {
    width: min(360px, 100%);
    padding: 22px 20px 18px;
    border-radius: var(--radius-lg);
    background: var(--surface);
    border: 2px solid transparent;
    text-align: center;
    display: grid;
    gap: 10px;
  }
  .done .af-card {
    border-color: var(--gc);
  }
  .af-stage {
    height: 104px;
    display: grid;
    place-items: center;
  }
  .af-box {
    width: 72px;
    height: 72px;
    display: grid;
    grid-template-rows: 18px 1fr;
    gap: 3px;
    animation: af-shake 0.42s ease-in-out 3;
  }
  .af-lid,
  .af-body {
    border-radius: 6px;
    background: var(--surface-2);
    border: 2px solid var(--ink);
  }
  .af-lid {
    margin: 0 -5px;
  }
  .af-item {
    width: 96px;
    height: 96px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    color: var(--gc);
    background: color-mix(in srgb, var(--gc) 14%, transparent);
    box-shadow: 0 0 0 2px var(--gc), 0 0 28px color-mix(in srgb, var(--gc) 55%, transparent);
    animation: af-pop 0.5s ease-out;
  }
  .af-title {
    color: var(--gc);
  }
  .g1 .af-title {
    color: var(--ink);
  }
  @keyframes af-shake {
    25% {
      transform: rotate(-7deg);
    }
    50% {
      transform: rotate(6deg);
    }
    75% {
      transform: rotate(-3deg);
    }
  }
  @keyframes af-pop {
    0% {
      transform: scale(0.3);
      opacity: 0;
    }
    60% {
      transform: scale(1.15);
      opacity: 1;
    }
    100% {
      transform: scale(1);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .af-box,
    .af-item {
      animation: none;
    }
  }
</style>
