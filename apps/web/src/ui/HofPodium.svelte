<script lang="ts">
  import type { PublicHofEntry } from '@offside/contracts';
  import { posLabel } from '@offside/game/data';
  import { anonName } from '@offside/app-core/format';
  import { DEFAULT_NATION, NATION_BY_CODE, flagOf } from '@offside/contracts/nations';
  import { openPublicLegend } from './legend.js';
  import ClubMark from './ClubMark.svelte';
  import Laurel from './Laurel.svelte';

  const { players, label, unit, showPosition = true }: {
    players: { entry: PublicHofEntry; rank: number; value: number | string; own: boolean }[];
    label: string;
    unit: string;
    showPosition?: boolean;
  } = $props();
  const medals = ['gold', 'silver', 'bronze'];
  const places = [2, 1, 3];
  const ordered = $derived([...players].sort((a, b) => places.indexOf(a.rank) - places.indexOf(b.rank)));
</script>

<div class="hof-podium" role="group" aria-label="{label} 상위 3명">
  {#each ordered as player (player.entry.id)}
    {@const h = player.entry}
    {@const name = h.name ?? anonName(h.pos, h.number)}
    {@const country = NATION_BY_CODE.get(h.nation || DEFAULT_NATION) ?? NATION_BY_CODE.get(DEFAULT_NATION)!}
    {@const value = typeof player.value === 'number' ? player.value.toLocaleString('ko-KR') : player.value}
    <button class="hof-podium-player medal {medals[player.rank - 1]}" data-hof-id={h.id} data-hof-podium-rank={player.rank} style:grid-column={places.indexOf(player.rank) + 1} aria-label="{player.rank}위 {name}, {country.ko}, {label} {value}{unit}, 상세 기록 보기" onclick={() => void openPublicLegend(h)}>
      <span class="hof-podium-profile">
        <span class="hof-podium-medal" aria-hidden="true"><Laurel /><strong>{player.rank}</strong></span>
        <span class="hof-podium-club"><ClubMark name={h.lastClub} id={h.lastClubId} size={24} /><span class="hof-flag" role="img" aria-label={country.ko} title={country.ko} data-hof-nation={country.code}>{flagOf(country.code)}</span></span>
        <b class="hof-podium-name" title={name}>{name}</b>
        {#if showPosition || player.own}<span class="hof-podium-pos">{showPosition ? posLabel({ pos: h.pos, dpos: h.dpos }) : ''}{player.own ? `${showPosition ? ' · ' : ''}내 선수` : ''}</span>{/if}
      </span>
      <span class="hof-podium-step">
        <strong class="hof-podium-value num">{value}{#if unit}<small>{unit}</small>{/if}</strong>
        <span class="hof-podium-place">{player.rank}위</span>
      </span>
    </button>
  {/each}
</div>

<style>
  .hof-podium {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    align-items: end;
    gap: 6px;
    margin: 16px 0 20px;
    border-bottom: 2px solid var(--line);
  }
  .hof-podium-player {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    min-width: 0;
    grid-row: 1;
    border: 0;
    background: none;
    padding: 0;
    color: var(--ink);
    font: inherit;
    text-align: center;
    cursor: pointer;
  }
  .hof-podium-player:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
    border-radius: 8px;
  }
  .hof-podium-profile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 0 2px 10px;
    animation: podium-arrive 250ms ease-out both;
  }
  .hof-podium-medal {
    position: relative;
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    color: var(--medal-text);
  }
  .hof-podium-medal strong {
    position: relative;
    font-family: var(--display);
    font-size: 22px;
  }
  .hof-podium-club {
    display: flex;
    min-height: 24px;
    align-items: center;
    gap: 6px;
  }
  .hof-flag {
    font-size: 16px;
    line-height: 1;
  }
  .hof-podium-name {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    overflow-wrap: anywhere;
    width: 100%;
    min-height: 39px;
    font-size: 14px;
    line-height: 1.4;
  }
  .gold .hof-podium-name {
    font-size: 16px;
    min-height: 45px;
  }
  .hof-podium-pos {
    color: var(--muted);
    font-size: 12px;
    line-height: 1.4;
  }
  .hof-podium-step {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 3px;
    min-height: 56px;
    padding: 6px 3px;
    border: 1px solid color-mix(in srgb, var(--medal) 40%, var(--line));
    border-bottom: 0;
    border-radius: 8px 8px 0 0;
    background: color-mix(in srgb, var(--medal) 16%, var(--surface));
  }
  .silver .hof-podium-step {
    min-height: 76px;
  }
  .gold .hof-podium-step {
    min-height: 96px;
    background: color-mix(in srgb, var(--medal) 24%, var(--surface));
  }
  .hof-podium-value {
    max-width: 100%;
    font-size: clamp(16px, 4.5vw, 22px);
    line-height: 1.25;
    overflow-wrap: anywhere;
  }
  .gold .hof-podium-value {
    font-size: clamp(18px, 5vw, 24px);
  }
  .hof-podium-value small {
    margin-left: 2px;
    font: 500 12px var(--body);
  }
  .hof-podium-place {
    font-size: 12px;
    font-weight: 600;
  }
  @keyframes podium-arrive {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .hof-podium-profile {
      animation: none;
    }
  }
</style>
