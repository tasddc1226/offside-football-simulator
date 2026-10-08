<script lang="ts">
  import { tn } from '@offside/game/i18n/names';
  import { onMount, tick } from 'svelte';
  import { DETAIL_LABEL } from '@offside/contracts/owner-team';
  import { detailPosOf, type DetailPos } from '@offside/contracts/positions';
  import type { TeamPlayer } from '@offside/app-core/api/team';
  import PlayerCard from './PlayerCard.svelte';
  import { dur } from '../motion.js';
  import { teamHomeText as L } from '@offside/app-core/i18n/ko/teamHome';

  /** 그라운드 카드를 누르면 그 자리에서 커져 라커룸 카드를 그대로 확대해 보여 준다. 닫으면 제자리로 돌아간다. */
  let { player, name, rating, slot, nation, season, fit, origin, onclose }:
    { player: TeamPlayer; name: string; rating: number; slot: DetailPos; nation?: string | null | undefined; season?: number | undefined;
      fit: number; origin: HTMLElement; onclose: () => void } = $props();
  let card = $state<HTMLElement>();
  let closeButton = $state<HTMLButtonElement>();
  let closing = false;
  // 라커룸 카드와 같은 폭(CARD_W)으로 그려 글자·여백 비율을 같게 두고, 화면에 맞춰 통째로 키운다.
  const CARD_W = 155;
  let zoom = $state(1);
  let cardH = $state(0);
  const rest = $derived(`scale(${zoom})`);

  /** 그라운드 카드 자리·크기(FLIP). 카드는 가운데를 기준으로 커지므로 가운데끼리 잇는다. */
  function fromOrigin(): { transform: string; opacity: number } {
    const a = origin.getBoundingClientRect();
    const b = card!.getBoundingClientRect();
    return { transform: `translate(${a.left + a.width / 2 - (b.left + b.width / 2)}px,${a.top + a.height / 2 - (b.top + b.height / 2)}px) scale(${a.width / card!.offsetWidth})`, opacity: 0.6 };
  }

  onMount(() => {
    // body로 옮겨 그라운드의 overflow·쌓임 맥락 밖에서 띄운다.
    const root = card!.closest<HTMLElement>('[data-peek-root]')!;
    document.body.append(root);
    cardH = card!.offsetHeight;
    zoom = Math.max(1, Math.min(1.5, (innerWidth - 40) / CARD_W, (innerHeight - 170) / cardH));
    closeButton?.focus({ preventScroll: true });
    // 확대·여백이 그려진 뒤의 자리에서 출발점을 잰다(그리기 전이라 깜빡이지 않는다).
    void tick().then(() => {
      if (dur(1) && card) card.animate([fromOrigin(), { transform: rest, opacity: 1 }], { duration: dur(280), easing: 'cubic-bezier(.2,.9,.3,1.15)' });
    });
    return () => root.remove();
  });

  async function close() {
    if (closing) return;
    closing = true;
    if (dur(1) && card) {
      card.parentElement?.parentElement?.classList.add('leaving');
      await card.animate([{ transform: rest, opacity: 1 }, fromOrigin()], { duration: dur(200), easing: 'cubic-bezier(.4,0,.6,1)', fill: 'forwards' }).finished.catch(() => {});
    }
    origin.focus({ preventScroll: true });
    onclose();
  }
</script>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); void close(); } }} />

<div class="peek" data-peek-root>
  <button class="peek-backdrop" tabindex="-1" aria-hidden="true" onclick={close}></button>
  <div class="peek-body" role="dialog" aria-modal="true" aria-label={L.peekAria({ name })} data-player-peek>
    <!-- 라커룸 카드와 같은 내용(최고 OVR·본래 포지션). 이 자리에서의 값은 카드 아래 줄에. -->
    <div class="peek-card" bind:this={card} style:transform={rest} style:--grow="{(cardH * (zoom - 1)) / 2}px" style:--grow-x="{(CARD_W * (zoom - 1)) / 2}px">
      <PlayerCard {player} {name} {nation} {season} rating={player.peak} role={detailPosOf(player)} />
    </div>
    <p class="peek-slot"><b>{tn(DETAIL_LABEL[slot])}</b>{L.pitchRatingFull({ peak: player.peak, rating, fit })}</p>
    <button class="peek-close" bind:this={closeButton} onclick={close}>{L.close}</button>
  </div>
</div>

<style>
  .peek {position:fixed;inset:0;z-index:80;display:grid;place-items:center;padding:16px;}
  .peek-backdrop {position:absolute;inset:0;border:0;padding:0;background:color-mix(in srgb,#000,transparent 40%);backdrop-filter:blur(2px);animation:peek-fade .2s ease-out;cursor:zoom-out;}
  :global(.peek.leaving) .peek-backdrop {opacity:0;transition:opacity .2s;}
  :global(.peek.leaving) .peek-close {opacity:0;}
  .peek-body {position:relative;display:flex;flex-direction:column;align-items:center;gap:14px;}
  /* 확대는 transform이라 자리를 차지하지 않는다 — 늘어난 만큼 위아래·좌우 여백으로 밀어 준다. */
  .peek-card {width:155px;margin:var(--grow,0) var(--grow-x,0);transform-origin:center;will-change:transform;}
  
  .peek-slot {margin:0;display:flex;flex-direction:column;align-items:center;gap:2px;text-align:center;color:#fff;font-size:12px;line-height:1.5;opacity:.9;}
  .peek-slot b {font-size:14px;}
  .peek-close {min-width:120px;min-height:44px;padding:0 18px;border:1px solid #ffffff55;border-radius:999px;background:#0006;color:#fff;font:inherit;font-weight:600;cursor:pointer;animation:peek-fade .25s ease-out;}
  .peek-close:focus-visible {outline:3px solid var(--accent);outline-offset:3px;}
  @keyframes peek-fade {from {opacity:0;}}
  @media(prefers-reduced-motion:reduce) { .peek-backdrop,.peek-close {animation:none;} }
</style>
