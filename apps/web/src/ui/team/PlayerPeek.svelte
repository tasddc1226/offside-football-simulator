<script lang="ts">
  import { tn } from '@offside/game/i18n/names';
  import { onMount } from 'svelte';
  import { DETAIL_LABEL } from '@offside/contracts/owner-team';
  import type { DetailPos } from '@offside/contracts/positions';
  import type { TeamPlayer } from '@offside/app-core/api/team';
  import PlayerCard from './PlayerCard.svelte';
  import { dur } from '../motion.js';
  import { teamHomeText as L } from '@offside/app-core/i18n/ko/teamHome';

  /** 그라운드 카드를 누르면 그 자리에서 커져 라커룸 카드처럼 능력치까지 보여 준다. 닫으면 제자리로 돌아간다. */
  let { player, name, rating, slot, nation, season, fit, origin, onclose }:
    { player: TeamPlayer; name: string; rating: number; slot: DetailPos; nation?: string | null | undefined; season?: number | undefined;
      fit: number; origin: HTMLElement; onclose: () => void } = $props();
  let card = $state<HTMLElement>();
  let closeButton = $state<HTMLButtonElement>();
  let closing = false;

  /** 카드를 그라운드 카드 자리·크기에서 출발시킨다(FLIP). */
  function fromOrigin(): { transform: string; opacity: number } {
    const a = origin.getBoundingClientRect();
    const b = card!.getBoundingClientRect();
    const scale = a.width / b.width;
    return { transform: `translate(${a.left + a.width / 2 - (b.left + b.width / 2)}px,${a.top + a.height / 2 - (b.top + b.height / 2)}px) scale(${scale})`, opacity: 0.6 };
  }

  onMount(() => {
    // body로 옮겨 그라운드의 overflow·쌓임 맥락 밖에서 띄운다.
    const root = card!.closest<HTMLElement>('[data-peek-root]')!;
    document.body.append(root);
    closeButton?.focus({ preventScroll: true });
    if (dur(1)) card!.animate([fromOrigin(), { transform: 'none', opacity: 1 }], { duration: dur(280), easing: 'cubic-bezier(.2,.9,.3,1.15)' });
    return () => root.remove();
  });

  async function close() {
    if (closing) return;
    closing = true;
    if (dur(1) && card) {
      card.parentElement?.parentElement?.classList.add('leaving');
      await card.animate([{ transform: 'none', opacity: 1 }, fromOrigin()], { duration: dur(200), easing: 'cubic-bezier(.4,0,.6,1)', fill: 'forwards' }).finished.catch(() => {});
    }
    origin.focus({ preventScroll: true });
    onclose();
  }
</script>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); void close(); } }} />

<div class="peek" data-peek-root>
  <button class="peek-backdrop" tabindex="-1" aria-hidden="true" onclick={close}></button>
  <div class="peek-body" role="dialog" aria-modal="true" aria-label={L.peekAria({ name })} data-player-peek>
    <div class="peek-card" bind:this={card}>
      <PlayerCard {player} {name} {nation} {season} rating={player.peak} deploymentRating={rating} role={slot} />
      <p class="peek-slot"><b>{tn(DETAIL_LABEL[slot])}</b>{L.pitchRatingFull({ peak: player.peak, rating, fit })}</p>
    </div>
    <button class="peek-close" bind:this={closeButton} onclick={close}>{L.close}</button>
  </div>
</div>

<style>
  .peek {position:fixed;inset:0;z-index:80;display:grid;place-items:center;padding:16px;}
  .peek-backdrop {position:absolute;inset:0;border:0;padding:0;background:color-mix(in srgb,#000,transparent 40%);backdrop-filter:blur(2px);animation:peek-fade .2s ease-out;cursor:zoom-out;}
  :global(.peek.leaving) .peek-backdrop {opacity:0;transition:opacity .2s;}
  :global(.peek.leaving) .peek-close {opacity:0;}
  .peek-body {position:relative;display:flex;flex-direction:column;align-items:center;gap:14px;width:min(240px,100%);}
  .peek-card {width:100%;transform-origin:center;will-change:transform;}
  .peek-card :global(.player-card) {filter:drop-shadow(0 18px 24px #0008);}
  .peek-slot {margin:12px 0 0;display:flex;flex-direction:column;align-items:center;gap:2px;text-align:center;color:#fff;font-size:12px;line-height:1.5;opacity:.9;}
  .peek-slot b {font-size:14px;}
  .peek-close {min-width:120px;min-height:44px;padding:0 18px;border:1px solid #ffffff55;border-radius:999px;background:#0006;color:#fff;font:inherit;font-weight:600;cursor:pointer;animation:peek-fade .25s ease-out;}
  .peek-close:focus-visible {outline:3px solid var(--accent);outline-offset:3px;}
  @keyframes peek-fade {from {opacity:0;}}
  @media(prefers-reduced-motion:reduce) { .peek-backdrop,.peek-close {animation:none;} }
</style>
