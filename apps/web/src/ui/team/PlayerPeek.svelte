<script lang="ts">
  import { tn } from '@offside/game/i18n/names';
  import { onMount, tick } from 'svelte';
  import { DETAIL_LABEL } from '@offside/contracts/owner-team';
  import { detailPosOf, type DetailPos } from '@offside/contracts/positions';
  import type { TeamPlayer } from '@offside/app-core/api/team';
  import PlayerCard from './PlayerCard.svelte';
  import { dur } from '../motion.js';
  import { teamHomeText as L } from '@offside/app-core/i18n/ko/teamHome';
  import { chatText as LC } from '@offside/app-core/i18n/ko/chat';
  import { cardEnhanceText as CE } from '@offside/app-core/i18n/ko/cardEnhance';

  /** 그라운드 카드를 누르면 그 자리에서 커져 라커룸 카드를 그대로 확대해 보여 준다. 닫으면 제자리로 돌아간다. */
  let { player, name, rating, slot, nation, season, fit, origin, onclose, onshare, onenhance }:
    { player: TeamPlayer; name: string; rating: number;
      /** 그라운드의 자리와 적합도. 라운지처럼 자리가 없는 곳에서는 안 준다. */
      slot?: DetailPos | undefined; fit?: number | undefined;
      nation?: string | null | undefined; season?: number | undefined; origin: HTMLElement; onclose: () => void;
      /** 내 팀 그라운드에서만 준다. 라운지에 이 선수를 올린다. */
      onshare?: ((careerId: string) => void) | undefined;
      /** 내 팀 그라운드에서 강화할 수 있을 때만 준다. 팝업을 닫은 뒤 강화 창을 연다. */
      onenhance?: ((player: TeamPlayer) => void) | undefined } = $props();
  let card = $state<HTMLElement>();
  let closeButton = $state<HTMLButtonElement>();
  let closing = false;
  // 라커룸 카드와 같은 폭(CARD_W)으로 그려 글자·여백 비율을 같게 두고, 화면에 맞춰 통째로 키운다.
  const CARD_W = 155;
  let zoom = $state(1);
  let cardH = $state(0);
  const rest = $derived(`scale(${zoom})`);
  // T-11-753 3D 기울기 — 누르거나 마우스를 올린 자리 쪽으로 카드가 눕고, 그 자리에 빛이 맺힌다. 움직임 줄이기면 끈다.
  let tilt = $state<HTMLElement>();
  let rx = $state(0);
  let ry = $state(0);
  let sx = $state(50);
  let sy = $state(30);
  let so = $state(0);
  let live = $state(false);
  /** 열리는 동작이 끝난 뒤 손을 대지 않는 동안 천천히 흔들린다. */
  let idle = $state(false);
  const MAX_X = 20;
  const MAX_Y = 26;
  /** 카드 둘레 이만큼(px)까지는 기울기를 받는다. 기울면 카드가 손가락 밑에서 빠져나가도 끊기지 않게. */
  const REACH = 48;
  function lean(e: PointerEvent) {
    if (!card || closing || !dur(1)) return;
    // 기울지 않는 바깥 상자(.peek-card) 기준으로 잰다. 기운 카드 자체로 재면 가장자리에서 흔들린다.
    const r = card.getBoundingClientRect();
    const out = e.clientX < r.left - REACH || e.clientX > r.right + REACH || e.clientY < r.top - REACH || e.clientY > r.bottom + REACH;
    if (out) {
      if (live) settle();
      return;
    }
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    live = true;
    ry = (x - 0.5) * 2 * MAX_Y;
    rx = (0.5 - y) * 2 * MAX_X;
    sx = x * 100;
    sy = y * 100;
    so = 0.85;
  }
  function settle() {
    live = false;
    rx = ry = 0;
    so = 0;
  }
  /** 열릴 때 카드가 옆으로 돌아 들어오고 빛이 한 번 훑고 지나간다. */
  function intro() {
    if (!tilt || !dur(1)) return;
    tilt.animate(
      [{ transform: 'rotateY(-95deg) rotateX(10deg)' }, { transform: 'rotateY(10deg) rotateX(-3deg)', offset: 0.7 }, { transform: 'rotateY(0) rotateX(0)' }],
      { duration: dur(620), easing: 'cubic-bezier(.2,.8,.3,1)' },
    );
    setTimeout(() => (idle = true), dur(640));
    const start = performance.now();
    so = 0.7;
    const sweep = (now: number) => {
      const k = Math.min(1, (now - start) / dur(900));
      if (!live) sx = -20 + 140 * k;
      if (k < 1 && !closing) requestAnimationFrame(sweep);
      else if (!live) so = 0;
    };
    requestAnimationFrame(sweep);
  }

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
      intro();
    });
    return () => root.remove();
  });

  async function close() {
    if (closing) return;
    closing = true;
    settle();
    if (dur(1) && card) {
      card.parentElement?.parentElement?.classList.add('leaving');
      await card.animate([{ transform: rest, opacity: 1 }, fromOrigin()], { duration: dur(200), easing: 'cubic-bezier(.4,0,.6,1)', fill: 'forwards' }).finished.catch(() => {});
    }
    origin.focus({ preventScroll: true });
    onclose();
  }

  async function enhance() {
    if (closing) return;
    // 닫히면 컴포넌트가 사라져 prop을 읽을 수 없으니 먼저 잡아 둔다.
    const open = onenhance;
    const target = player;
    await close();
    open?.(target);
  }
</script>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); void close(); } }} />

<div class="peek" data-peek-root role="presentation" onpointermove={lean} onpointerleave={settle}>
  <button class="peek-backdrop" tabindex="-1" aria-hidden="true" onclick={close}></button>
  <div class="peek-body" role="dialog" aria-modal="true" aria-label={L.peekAria({ name })} data-player-peek>
    <!-- 라커룸 카드와 같은 내용(최고 OVR·본래 포지션). 이 자리에서의 값은 카드 아래 줄에. -->
    <div class="peek-card" bind:this={card} style:transform={rest} style:--grow="{(cardH * (zoom - 1)) / 2}px" style:--grow-x="{(CARD_W * (zoom - 1)) / 2}px">
      <div class="peek-3d" class:live class:idle={idle && !live && dur(1) > 0} bind:this={tilt} role="presentation" data-peek-tilt style:--rx="{rx}deg" style:--ry="{ry}deg" style:--shine-x="{sx}%" style:--shine-y="{sy}%" style:--shine-o={so}
        onpointerdown={(e) => { tilt?.setPointerCapture(e.pointerId); lean(e); }} onpointercancel={settle} onpointerup={(e) => { if (e.pointerType !== 'mouse') settle(); }}>
        <!-- 판 두께: 카드 뒤에 같은 방패 모양을 몇 장 겹쳐 기울면 옆면이 보인다. -->
        <span class="peek-edge" style:--z="-2px" aria-hidden="true"></span><span class="peek-edge" style:--z="-4px" aria-hidden="true"></span><span class="peek-edge" style:--z="-6px" aria-hidden="true"></span>
        <div class="peek-lift"><PlayerCard {player} {name} {nation} {season} rating={player.peak} role={detailPosOf(player)} shine /></div>
      </div>
    </div>
    {#if slot != null && fit != null}<p class="peek-slot"><b>{tn(DETAIL_LABEL[slot])}</b>{L.pitchRatingFull({ peak: player.peak, rating, fit })}</p>{/if}
    <div class="peek-actions">
      {#if onenhance && player.cardValue != null}<button class="peek-close peek-share" data-act="player-enhance" onclick={enhance}>{CE.go}</button>{/if}
      {#if onshare}<button class="peek-close peek-share" data-act="player-lounge-share" onclick={() => onshare(player.careerId)}>{LC.sharePlayerAct}</button>{/if}
      <button class="peek-close" bind:this={closeButton} onclick={close}>{L.close}</button>
    </div>
  </div>
</div>

<style>
  .peek {position:fixed;inset:0;z-index:80;display:grid;place-items:center;padding:16px;}
  .peek-backdrop {position:absolute;inset:0;border:0;padding:0;background:color-mix(in srgb,#000,transparent 40%);backdrop-filter:blur(2px);animation:peek-fade .2s ease-out;cursor:zoom-out;}
  :global(.peek.leaving) .peek-backdrop {opacity:0;transition:opacity .2s;}
  :global(.peek.leaving) .peek-close {opacity:0;}
  .peek-body {position:relative;display:flex;flex-direction:column;align-items:center;gap:14px;}
  /* 확대는 transform이라 자리를 차지하지 않는다 — 늘어난 만큼 위아래·좌우 여백으로 밀어 준다. */
  /* T-11-753 3D. 원근 · 그림자는 바깥(.peek-card)이 맡는다(filter가 안쪽 3D를 납작하게 만들기 때문). 기울기는 손을 떼면 천천히, 움직이는 동안은 바로 따라온다.
     카드 뒤 방패(.peek-edge) 세 장이 판 두께, 누르면 카드가 앞으로 뜬다(.peek-lift), 쉬는 동안은 천천히 흔들린다(--sway). */
  .peek-card {width:155px;margin:var(--grow,0) var(--grow-x,0);transform-origin:center;will-change:transform;perspective:520px;filter:drop-shadow(0 16px 18px #000a);}
  @property --sway {syntax:'<angle>';inherits:false;initial-value:0deg;}
  .peek-3d {--t:.5s cubic-bezier(.2,.8,.3,1);position:relative;transform:rotateX(calc(var(--rx,0deg) + var(--sway) * .4)) rotateY(calc(var(--ry,0deg) + var(--sway)));transform-style:preserve-3d;transition:transform var(--t);touch-action:none;cursor:grab;}
  .peek-3d.live {--t:.08s linear;cursor:grabbing;}
  .peek-3d.idle {animation:peek-sway 4.2s ease-in-out infinite alternate;}
  @keyframes peek-sway {from {--sway:-7deg;} to {--sway:7deg;}}
  .peek-lift {transform:translateZ(0);transform-style:preserve-3d;transition:transform var(--t);}
  .peek-3d.live .peek-lift {transform:translateZ(16px);}
  .peek-edge {position:absolute;inset:0;transform:translateZ(var(--z));background:linear-gradient(160deg,#6b5326,#1c140a);clip-path:polygon(0 24.2px,15.625% 24.2px,23.958% 9.7px,50% 3.2px,76.042% 9.7px,84.375% 24.2px,100% 24.2px,98.958% calc(100% - 42px),89.583% calc(100% - 22.6px),50% calc(100% - 3.2px),10.417% calc(100% - 22.6px),1.042% calc(100% - 42px));}
  
  .peek-slot {margin:0;display:flex;flex-direction:column;align-items:center;gap:2px;text-align:center;color:#fff;font-size:12px;line-height:1.5;opacity:.9;}
  .peek-slot b {font-size:14px;}
  .peek-close {min-width:120px;min-height:44px;padding:0 18px;border:1px solid #ffffff55;border-radius:var(--radius-pill);background:#0006;color:#fff;font:inherit;font-weight:600;cursor:pointer;animation:peek-fade .25s ease-out;}
  .peek-actions {display:flex;flex-wrap:wrap;justify-content:center;gap:8px;}
  .peek-share {background:var(--accent);border-color:var(--accent);color:var(--on-accent,#10231a);}
  .peek-close:focus-visible {outline:3px solid var(--accent);outline-offset:3px;}
  @keyframes peek-fade {from {opacity:0;}}
  @media(prefers-reduced-motion:reduce) { .peek-backdrop,.peek-close {animation:none;} .peek-3d,.peek-lift {transform:none;transition:none;cursor:auto;animation:none;} .peek-edge {display:none;} }
</style>
