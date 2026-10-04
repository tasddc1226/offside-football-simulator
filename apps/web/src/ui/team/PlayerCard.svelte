<script lang="ts">
  import { onMount } from 'svelte';
  import type { TeamPlayer } from '@offside/app-core/api/team';
  import { FACE_ABBR, GK_ABBR } from '@offside/game/attributes';
  import type { DetailPos } from '@offside/contracts/positions';
  import { DEFAULT_NATION, NATION_BY_CODE, flagOf } from '@offside/contracts/nations';
  import { fmtValue } from '@offside/app-core/format';

  let { player, name, rating, role, nation, compact = false, youth = false, deploymentRating, ratingLabel = '최고 OVR' }:
    { player?: TeamPlayer | undefined; name: string; rating: number; role: DetailPos; nation?: string | null | undefined; compact?: boolean; youth?: boolean; deploymentRating?: number | undefined; ratingLabel?: string } = $props();
  const country = $derived(!youth ? NATION_BY_CODE.get(nation ?? player?.nation ?? DEFAULT_NATION) : undefined);
  const tier = $derived(youth ? 'youth' : (player?.legendScore ?? 0) >= 1000 ? 'legend' : (player?.peak ?? rating) >= 80 ? 'gold' : 'silver');
  const statKeys = $derived(player?.pos === 'GK' ? ['def', 'phy', 'pas', 'pac', 'sho', 'dri'] as const : ['pac', 'sho', 'dri', 'pas', 'def', 'phy'] as const);
  const statLabels = $derived(player?.pos === 'GK' ? GK_ABBR : FACE_ABBR);
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
    <div class="card-rating" title="{ratingLabel} {rating}"><b>{rating}</b><span>{role}</span></div>
    {#if country}<span class="card-nation" role="img" aria-label="국적 {country.ko}" title={country.ko}>{flagOf(country.code)}</span>{/if}
    <div class="card-art" aria-hidden="true">
      <svg viewBox="0 0 100 96"><path d="M30 10 15 17 3 38 20 48 26 36 24 90 76 90 74 36 80 48 97 38 85 17 70 10 62 5Q50 16 38 5Z" /><path class="shirt-trim" d="M38 5Q50 25 62 5M25 73H75M34 12V87M66 12V87" /></svg>
      <span class="shirt-number">{player?.number ?? (youth ? '+' : name.slice(0, 1))}</span>
    </div>
    <strong class="card-name" class:scrolling={nameOverflow > 1} class:in-view={inView} title={name}
      bind:this={nameViewport} bind:clientWidth={viewportWidth} style:--name-offset="-{nameOverflow}px" style:--name-duration="{nameDuration}s">
      <span class="name-track" bind:offsetWidth={nameWidth}>{name}</span>
    </strong>
    {#if deploymentRating !== undefined}<span class="card-deployment" title="포지션 OVR {deploymentRating}"><span>포지션 OVR</span><b>{deploymentRating}</b></span>{/if}
    {#if !compact}
      <div class="card-divider"></div>
      <div class="card-career"><span title="레전드 점수">LS</span><b>{(player?.legendScore ?? 0).toLocaleString()}</b></div>
      <dl class="card-attributes" aria-label="선수 능력치">
        {#each statKeys as key (key)}
          <div><dt>{statLabels[key]}</dt><dd>{player?.attrs ? Math.round(player.attrs[key]) : '—'}</dd></div>
        {/each}
      </dl>
      <div class="card-foot">{!player?.attrs ? '능력치 기록 없음' : player.attrsEstimated ? '추정 능력치' : player.cardValue ? `기준가 ${fmtValue(player.cardValue)}` : tier === 'legend' ? '레전드 커리어' : '나의 커리어'}</div>
    {/if}
  </div>
</div>

<style>
  .player-card { --card-base:#e8d5a8; --card-light:#fff2ce; --card-dark:#8a6324; --card-ink:#392b14; --card-line:#b79654; width:100%; padding:2px; background:var(--card-line); clip-path:polygon(0 9%,16% 9%,25% 2%,50% 0,75% 2%,84% 9%,100% 9%,98% 84%,86% 93%,50% 100%,14% 93%,2% 84%); filter:drop-shadow(0 4px 5px #0003); }
  .player-card[data-tier='legend'] { --card-base:#28382e; --card-light:#51614b; --card-dark:#101e17; --card-ink:#fce7b1; --card-line:#d1ac5f; }
  .player-card[data-tier='silver'] { --card-base:#d6dfe0; --card-light:#f8faf6; --card-dark:#83989c; --card-ink:#243339; --card-line:#9fb3b6; }
  .player-card[data-tier='youth'] { --card-base:#d5e4d8; --card-light:#eaf3e9; --card-dark:#9bae9b; --card-ink:#365342; --card-line:#8cab97; opacity:.82; }
  .card-face { position:relative; overflow:hidden; min-height:183px; padding:28px 10px 20px; clip-path:inherit; background:linear-gradient(135deg,transparent 34%,#ffffff25 34.5%,transparent 35%,transparent 62%,#ffffff1c 62.5%,transparent 63%),radial-gradient(ellipse at 80% 10%,var(--card-light),transparent 70%),linear-gradient(165deg,var(--card-base),var(--card-dark)); color:var(--card-ink); }
  .card-rating { position:absolute; top:28px; left:11px; display:flex; flex-direction:column; align-items:center; z-index:1; }
  .card-rating b { font-family:var(--display); font-size:2.3rem; font-weight:800; line-height:.9; }
  .card-rating span { font-family:var(--display); font-size:.82rem; font-weight:700; line-height:1; margin-top:4px; }
  .card-nation {position:absolute;top:82px;left:11px;z-index:1;width:36px;text-align:center;font-family:system-ui,sans-serif;font-size:18px;line-height:18px;}
  .card-deployment {display:flex;flex-direction:column;align-items:center;font-size:8px;line-height:10px;}
  .card-deployment b {font-family:var(--display);font-size:12px;line-height:13px;}
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
  .card-career { display:flex;justify-content:center;align-items:baseline;gap:4px;font-size:.72rem; }
  .card-career b { font-family:var(--display); font-size:1.15rem; }
  .card-attributes {display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px 4px;margin:8px 0 0;text-align:center;}
  .card-attributes dt {font-size:10px;line-height:1.3;font-weight:600;}
  .card-attributes dd {margin:0;font-family:var(--display);font-size:1.25rem;line-height:1.1;font-weight:700;}
  .card-foot { font-size:.6rem; text-align:center; margin-top:7px; opacity:.8; }
  .compact .card-face { min-height:0; height:100px; padding:11px 4px 13px; }
  .compact .card-rating { top:14px; left:7px; }
  .compact .card-rating b { font-size:1.6rem; }
  .compact .card-rating span { font-size:.62rem; margin-top:2px; }
  .compact .card-nation {top:13px;left:auto;right:5px;width:16px;font-size:12px;line-height:14px;}
  .compact .card-art { height:48px; margin:10px 0 0 17px; }
  .compact .shirt-number { font-size:1.15rem; }
  .compact .card-name { font-size:11px; margin-top:3px; }
  .compact.deployed .card-art {height:36px;}
  @media(max-width:440px) { .compact .card-face { height:88px; padding:8px 3px 10px; } .compact .card-rating { left:5px;top:11px; } .compact .card-rating b { font-size:1.3rem; } .compact .card-art { height:34px;margin-top:8px; } .compact .shirt-number {font-size:1rem;} .compact.deployed .card-art {height:24px;} }
</style>
