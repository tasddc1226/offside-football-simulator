<script lang="ts">
  // 트로피 한 개의 그림. 우승 · 금메달은 그 대회 로고, 은 · 동메달은 유저가 그 대회 로고를 바꿨을 때만 그 로고 위에
  // 메달 표시(2 · 3)를 얹고, 아니면 트로피 · 메달 그림. 시즌 결산과 트로피 탭이 같이 쓴다(앱 TrophyEmblem.tsx).
  import { MEDAL_BADGE, type MedalColor } from '@offside/app-core/compEmblem';
  import type { CareerTrophy as Art } from '@offside/app-core/career-trophy';
  import CareerTrophy from './CareerTrophy.svelte';
  import CompIcon from './CompIcon.svelte';
  import { compIcons } from './compIcons.svelte.js';

  let {
    art,
    comp = null,
    medal = null,
    size = 48,
    still = false,
  }: {
    art: Art;
    comp?: string | null | undefined;
    medal?: { comp: string; medal: MedalColor } | null | undefined;
    size?: number;
    still?: boolean;
  } = $props();
  const onLogo = $derived(!comp && medal && compIcons.map[medal.comp] ? medal : null);
  const b = $derived(onLogo ? MEDAL_BADGE[onLogo.medal] : null);
  const bs = $derived(Math.max(14, Math.round(size * 0.42)));
</script>

{#if comp}
  <CompIcon ko={comp} {size} {still} />
{:else if onLogo && b}
  <span class="medal-logo" data-medal-logo={onLogo.medal}>
    <CompIcon ko={onLogo.comp} {size} {still} />
    <span class="medal-badge" aria-hidden="true" style="--bs:{bs}px;--fill:{b.fill};--ring:{b.ring};--ink:{b.ink}">{b.n}</span>
  </span>
{:else}
  <CareerTrophy {art} {size} />
{/if}

<style>
  .medal-logo { position: relative; display: inline-grid; flex: none; }
  .medal-badge {
    position: absolute;
    right: -3px;
    bottom: -3px;
    width: var(--bs);
    height: var(--bs);
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--fill);
    border: 1.5px solid var(--ring);
    color: var(--ink);
    font-size: calc(var(--bs) * 0.58);
    font-weight: 800;
    line-height: 1;
    pointer-events: none;
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.25);
  }
</style>
