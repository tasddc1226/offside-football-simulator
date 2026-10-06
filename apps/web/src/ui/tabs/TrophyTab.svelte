<script lang="ts">
  // ui.ts trophyTab() 포트 (388~395줄)
  import type { LegendSource } from '@offside/game/types';
  import ClubMark from '../ClubMark.svelte';
  import { gameTrophyText as L } from '@offside/app-core/i18n/ko/gameTrophy';

  const { s }: { s: LegendSource } = $props();
  const trophies = $derived(s.trophies.slice().reverse());
  const awards = $derived(s.awards.slice().reverse());
  const ballon = $derived((s.ballon || []).slice().reverse());
  const stories = $derived((s.storyLog || []).slice().reverse());
</script>

<section class="card">
  <div class="eyebrow">Team Honours</div>
  <h2 style="margin-bottom:4px">{L.honours}</h2>
  {#if trophies.length}
    {#each trophies as x, i (i)}
      <div class="trophy"><span class="y">{x.year}</span><div><b>{x.t}</b><span class="muted fs-xs"><ClubMark name={x.club} id={x.clubId} size={14} /> {x.club}</span></div></div>
    {/each}
  {:else}
    <p class="empty">{L.empty}</p>
  {/if}
</section>

<section class="card">
  <div class="eyebrow">Individual</div>
  <h2 style="margin-bottom:4px">{L.individual}</h2>
  {#if awards.length}
    {#each awards as x, i (i)}
      <div class="trophy"><span class="y">{x.year}</span><div><b>{x.t}</b></div></div>
    {/each}
  {:else}
    <p class="empty">{L.empty}</p>
  {/if}
</section>

{#if ballon.length}
  <section class="card">
    <div class="eyebrow">Ballon d'Or</div>
    <h2 style="margin-bottom:4px">{L.ballon}</h2>
    {#each ballon as b, i (i)}
      <div class="trophy"><span class="y">{b.year}</span><div><b>{b.rank === 1 ? L.ballonWon : L.ballonRank({ n: b.rank })}</b> <span class="muted fs-xs">{L.nominees}</span></div></div>
    {/each}
  </section>
{/if}

<section class="card">
  <div class="eyebrow">Story Album</div>
  <h2 style="margin-bottom:4px">{L.stories}</h2>
  {#if stories.length}
    {#each stories as x, i (i)}
      <div class="trophy"><span class="y">{x.year}</span><div><b>{x.ending}</b><span class="muted fs-xs">{x.name}</span></div></div>
    {/each}
  {:else}
    <p class="empty">{L.empty}</p>
  {/if}
</section>
