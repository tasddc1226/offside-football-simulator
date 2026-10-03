<script lang="ts">
  import { onMount } from 'svelte';
  import type { TeamPlayer } from '@offside/app-core/api/team';
  import { FACE_ABBR, GK_ABBR } from '@offside/game/attributes';
  import { FACE_ATTRS, type DetailPos } from '@offside/contracts/positions';

  let { player, name, rating, role, compact = false, youth = false, deploymentRating, ratingLabel = '최고 OVR' }:
    { player?: TeamPlayer | undefined; name: string; rating: number; role: DetailPos; compact?: boolean; youth?: boolean; deploymentRating?: number | undefined; ratingLabel?: string } = $props();
  const tier = $derived(youth ? 'youth' : (player?.legendScore ?? 0) >= 1000 ? 'legend' : (player?.peak ?? rating) >= 80 ? 'gold' : 'silver');
  let nameViewport: HTMLElement;
  let viewportWidth = $state(0);
  let nameWidth = $state(0);
  let inView = $state(false);
  const nameOverflow = $derived(Math.max(0, nameWidth - viewportWidth));
  const nameDuration = $derived(Math.max(8, nameOverflow / 12 + 4));
  onMount(() => {
    const observer = new IntersectionObserver(([entry]) => (inView = !!entry?.isIntersecting));
    observer.observe(nameViewport);
    return () => observer.disconnect();
  });
</script>

<div class="player-card" class:compact class:youth class:deployed={deploymentRating !== undefined} data-tier={tier}>
  <div class="card-face">
    <div class="card-rating" title="{ratingLabel} {rating}">{#if !compact}<small>{ratingLabel}</small>{/if}<b>{rating}</b><span>{role}</span></div>
    <div class="card-art" aria-hidden="true">
      <svg viewBox="0 0 100 96"><path d="M30 10 15 17 3 38 20 48 26 36 24 90 76 90 74 36 80 48 97 38 85 17 70 10 62 5Q50 16 38 5Z" /><path class="shirt-trim" d="M38 5Q50 25 62 5M25 73H75M34 12V87M66 12V87" /></svg>
      <span class="shirt-number">{player?.number ?? (youth ? '+' : name.slice(0, 1))}</span>
    </div>
    <strong class="card-name" class:scrolling={nameOverflow > 1} class:in-view={inView} title={name}
      bind:this={nameViewport} bind:clientWidth={viewportWidth} style:--name-offset="-{nameOverflow}px" style:--name-duration="{nameDuration}s">
      <span class="name-track" bind:offsetWidth={nameWidth}>{name}</span>
    </strong>
    {#if deploymentRating !== undefined}<span class="card-deployment" title="배치 실력 {deploymentRating}">배치 <b>{deploymentRating}</b></span>{/if}
    {#if !compact}
      <div class="card-divider"></div>
      {#if player?.attrs}
        <dl class="card-attributes">
          {#each FACE_ATTRS as key (key)}<div><dt>{(player.pos === 'GK' ? GK_ABBR : FACE_ABBR)[key]}</dt><dd>{player.attrs[key]}</dd></div>{/each}
        </dl>
      {:else}
        <div class="card-career"><span title="레전드 점수">LS</span><b>{(player?.legendScore ?? 0).toLocaleString()}</b></div>
      {/if}
      <div class="card-foot">{tier === 'legend' ? '레전드 커리어' : '나의 커리어'}</div>
    {/if}
  </div>
</div>

<style>
  .player-card { --card-base:#e8d5a8; --card-light:#fff2ce; --card-dark:#8a6324; --card-ink:#392b14; --card-line:#b79654; width:100%; padding:2px; background:var(--card-line); clip-path:polygon(0 9%,16% 9%,25% 2%,50% 0,75% 2%,84% 9%,100% 9%,98% 84%,86% 93%,50% 100%,14% 93%,2% 84%); filter:drop-shadow(0 4px 5px #0003); }
  .player-card[data-tier='legend'] { --card-base:#28382e; --card-light:#51614b; --card-dark:#101e17; --card-ink:#fce7b1; --card-line:#d1ac5f; }
  .player-card[data-tier='silver'] { --card-base:#d6dfe0; --card-light:#f8faf6; --card-dark:#83989c; --card-ink:#243339; --card-line:#9fb3b6; }
  .player-card[data-tier='youth'] { --card-base:#d5e4d8; --card-light:#eaf3e9; --card-dark:#9bae9b; --card-ink:#365342; --card-line:#8cab97; opacity:.82; }
  .card-face { position:relative; overflow:hidden; min-height:183px; padding:17px 10px 19px; clip-path:inherit; background:linear-gradient(135deg,transparent 34%,#ffffff25 34.5%,transparent 35%,transparent 62%,#ffffff1c 62.5%,transparent 63%),radial-gradient(ellipse at 80% 10%,var(--card-light),transparent 70%),linear-gradient(165deg,var(--card-base),var(--card-dark)); color:var(--card-ink); }
  .card-rating { position:absolute; top:17px; left:11px; display:flex; flex-direction:column; align-items:center; z-index:1; }
  .card-rating b { font-family:var(--display); font-size:2.3rem; font-weight:800; line-height:.9; }
  .card-rating span { font-family:var(--display); font-size:.82rem; font-weight:700; margin-top:4px; }
  .card-rating small {font-size:.55rem;line-height:1.4;margin-bottom:3px;white-space:nowrap;}
  .card-deployment {display:block;text-align:center;font-size:11px;line-height:1.3;}
  .card-art { position:relative; height:72px; margin-left:26px; }
  .card-art svg { width:100%; height:100%; fill:var(--card-dark); stroke:var(--card-ink); stroke-opacity:.4; stroke-width:1.4; }
  .card-art .shirt-trim { fill:none; stroke:var(--card-light); stroke-width:2; stroke-opacity:.65; }
  .shirt-number { position:absolute; inset:25% 0 0; display:flex; align-items:center; justify-content:center; font-family:var(--display); font-size:1.8rem; font-weight:700; }
  .card-name { display:block; margin-top:4px; text-align:center; font-size:.88rem; white-space:nowrap; overflow:hidden; line-height:1.6; }
  .name-track {display:inline-block;width:max-content;vertical-align:top;}
  .card-name.scrolling {text-align:left;}
  .card-name.scrolling .name-track {animation:card-name-scroll var(--name-duration) linear infinite;}
  .card-name:not(.in-view) .name-track,
  .player-card:hover .name-track,
  .player-card:active .name-track,
  :global(button:focus-visible) .name-track {animation-play-state:paused;}
  @keyframes card-name-scroll {0%,15% {transform:translateX(0);} 85%,100% {transform:translateX(var(--name-offset));}}
  @media(prefers-reduced-motion:reduce) {
    .card-name.scrolling {overflow-x:auto;scrollbar-width:none;}
    .card-name.scrolling .name-track {animation:none;}
    .card-name::-webkit-scrollbar {display:none;}
  }
  .card-divider { height:1px; background:var(--card-ink); opacity:.25; margin:4px 0 6px; }
  .card-attributes { display:grid; grid-template-columns:1fr 1fr; gap:2px 10px; margin:0; }
  .card-attributes div { display:flex; flex-direction:row-reverse; justify-content:space-between; font-size:.7rem; }
  .card-attributes dt { opacity:.8; } .card-attributes dd { margin:0; font-weight:700; }
  .card-career { display:flex; flex-direction:column; align-items:center; font-size:.72rem; padding:8px 0; }
  .card-career b { font-family:var(--display); font-size:1.15rem; }
  .card-foot { font-size:.6rem; text-align:center; margin-top:7px; opacity:.8; }
  .compact .card-face { min-height:0; height:100px; padding:11px 4px 13px; }
  .compact .card-rating { top:14px; left:7px; }
  .compact .card-rating b { font-size:1.6rem; }
  .compact .card-rating span { font-size:.62rem; margin-top:2px; }
  .compact .card-art { height:48px; margin:10px 0 0 17px; }
  .compact .shirt-number { font-size:1.15rem; }
  .compact .card-name { font-size:11px; margin-top:3px; }
  .compact.deployed .card-art {height:36px;}
  @media(max-width:440px) { .compact .card-face { height:88px; padding:8px 3px 10px; } .compact .card-rating { left:5px;top:11px; } .compact .card-rating b { font-size:1.3rem; } .compact .card-art { height:34px;margin-top:8px; } .compact .shirt-number {font-size:1rem;} .compact.deployed .card-art {height:24px;} }
</style>
