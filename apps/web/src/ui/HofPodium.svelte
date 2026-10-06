<script lang="ts">
  import type { PublicHofEntry } from '@offside/contracts';
  import { posAbbr, posLabel } from '@offside/game/data';
  import { PODIUM_FACE_BOTTOM, PODIUM_FACE_TOP, PODIUM_H, PODIUM_TONES, PODIUM_W, podiumPaths } from '@offside/game/podium';
  import { anonName } from '@offside/app-core/format';
  import { DEFAULT_NATION, NATION_BY_CODE, flagOf } from '@offside/contracts/nations';
  import { openPublicLegend } from './legend.js';
  import ClubMark from './ClubMark.svelte';
  import Laurel from './Laurel.svelte';
  import { hofText as L } from '@offside/app-core/i18n/ko/hof';
  import { tn } from '@offside/game/i18n/names';
  import { intlLocale } from '@offside/contracts/i18n';

  // 단상 그림은 순위마다 하나라 모듈에서 한 번만 만든다.

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

<div class="hof-podium" role="group" aria-label={L.podiumLabel({ label })}>
  {#each ordered as player (player.entry.id)}
    {@const h = player.entry}
    {@const r = player.rank as 1 | 2 | 3}
    {@const name = h.name ?? anonName(h.pos, h.number)}
    {@const country = NATION_BY_CODE.get(h.nation || DEFAULT_NATION) ?? NATION_BY_CODE.get(DEFAULT_NATION)!}
    {@const value = typeof player.value === 'number' ? player.value.toLocaleString(intlLocale()) : player.value}
    <button class="hof-podium-player medal {medals[player.rank - 1]}" data-hof-id={h.id} data-hof-podium-rank={player.rank} style:grid-column={places.indexOf(player.rank) + 1} aria-label={L.podiumPlayer({ rank: player.rank, name, country: tn(country.ko), label, value, unit })} onclick={() => void openPublicLegend(h)}>
      <span class="hof-podium-profile">
        <span class="hof-podium-medal" aria-hidden="true"><Laurel /><strong>{player.rank}</strong></span>
        <!-- 국기는 이름 앞, 엠블럼은 은퇴 시점 구단 이름 앞. -->
        <b class="hof-podium-name" title={name}><span class="hof-flag" role="img" aria-label={tn(country.ko)} title={tn(country.ko)} data-hof-nation={country.code}>{flagOf(country.code)}</span> {name}{#if showPosition}<span class="hof-podium-pos" title={posLabel({ pos: h.pos, dpos: h.dpos })}>{posAbbr({ pos: h.pos, dpos: h.dpos })}</span>{/if}</b>
        {#if h.lastClub}<span class="hof-podium-team" data-hof-club><ClubMark name={h.lastClub} id={h.lastClubId} size={16} /><span>{tn(h.lastClub)}</span></span>{/if}
        {#if player.own}<span class="hof-podium-mine">{L.mine}</span>{/if}
        <!-- T-11-124 시상대 위에 선 전성기 모습(마지막 구단 유니폼). 그림은 따로 불러오고 자리는 미리 잡아 둔다. -->
        <span class="hof-podium-avatar" aria-hidden="true">{#await import('./PrimeAvatar.svelte') then { default: PrimeAvatar }}<PrimeAvatar entry={h} />{/await}</span>
      </span>
      <!-- 도트 단상(podium.ts). 값·순위는 앞면 위에 겹쳐 쓴다. -->
      <span class="hof-podium-step" style:--podium-ink={PODIUM_TONES[r].ink}>
        <svg class="hof-podium-block" viewBox="0 0 {PODIUM_W} {PODIUM_H[r]}" shape-rendering="crispEdges" aria-hidden="true">{#each podiumPaths(r) as p (p.fill)}<path d={p.d} fill={p.fill} />{/each}</svg>
        <span class="hof-podium-face" style:top="{(PODIUM_FACE_TOP / PODIUM_H[r]) * 100}%" style:bottom="{(PODIUM_FACE_BOTTOM / PODIUM_H[r]) * 100}%">
          <strong class="hof-podium-value num">{value}{#if unit}<small>{unit}</small>{/if}</strong>
          <span class="hof-podium-place">{L.rankN({ rank: player.rank })}</span>
        </span>
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
    position: relative;
    z-index: 1; /* 도트 선수가 단상 윗면을 밟도록 단상 위에 그린다. */
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
  .hof-podium-team {
    display: flex;
    max-width: 100%;
    align-items: center;
    justify-content: center;
    gap: 4px;
    color: var(--muted);
    font-size: 12px;
    line-height: 1.4;
  }
  .hof-podium-team > span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
    font-size: 14px;
    line-height: 1.4;
  }
  .gold .hof-podium-name {
    font-size: 16px;
  }
  /* 포지션 약어는 이름 바로 오른쪽. */
  .hof-podium-pos {
    margin-left: 4px;
    color: var(--muted);
    font-size: 12px;
    font-weight: 600;
  }
  .hof-podium-mine {
    color: var(--muted);
    font-size: 12px;
    line-height: 1.4;
  }
  /* 도트 선수가 단상 윗면(밟는 곳)에 서도록 아래로 내린다: 프로필 여백 10px + 그림 아래 빈 두 줄 + 윗면 깊이 8px.
     2·3위 2배, 1위 3배(좁은 화면은 모두 2배). */
  .hof-podium-avatar {
    display: block;
    width: 48px;
    height: 64px;
    margin: 2px 0 -22px;
  }
  .gold .hof-podium-avatar {
    width: 72px;
    height: 96px;
    margin-bottom: -24px;
  }
  @media (max-width: 359px) {
    .gold .hof-podium-avatar {
      width: 48px;
      height: 64px;
      margin-bottom: -22px;
    }
  }
  .hof-podium-avatar :global(.avatar) {
    width: 100%;
    height: 100%;
  }
  .hof-podium-step {
    position: relative;
    display: block;
  }
  .hof-podium-block {
    display: block;
    width: 100%;
    height: auto;
  }
  .hof-podium-face {
    position: absolute;
    inset-inline: 6%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 1px;
    color: var(--podium-ink);
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
    font-weight: 700;
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
