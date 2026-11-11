<script lang="ts">
  import { tn } from '@offside/game/i18n/names';
  import TrophyYears from '../TrophyYears.svelte';
  // ui.ts trophyTab() 포트 (388~395줄)
  import type { LegendSource } from '@offside/game/types';
  import { gameTrophyText as L } from '@offside/app-core/i18n/ko/gameTrophy';
  import type { EraState } from '@offside/game/era';
  import { eraTab } from '@offside/app-core/era-view';
  import EraTab from '../era/EraTab.svelte';

  const { s }: { s: LegendSource & { era?: EraState | undefined } } = $props();
  const era = $derived(eraTab(s));
  const ballon = $derived((s.ballon || []).slice().reverse());
  const stories = $derived((s.storyLog || []).slice().reverse());
</script>

<section class="card">
  <div class="eyebrow">Team Honours</div>
  <h2 style="margin-bottom:4px">{L.honours}</h2>
  {#if s.trophies.length}
    <!-- T-11-695 같은 해 우승은 한 묶음(연도 한 번). 리그·대회 우승 · 아시안게임 · 올림픽 금메달은 그 대회 로고 -->
    <TrophyYears items={s.trophies} />
  {:else}
    <p class="empty">{L.empty}</p>
  {/if}
</section>

<section class="card">
  <div class="eyebrow">Individual</div>
  <h2 style="margin-bottom:4px">{L.individual}</h2>
  {#if s.awards.length}
    <TrophyYears items={s.awards} icons={false} />
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

{#if era}<EraTab v={era} />{/if}

<section class="card">
  <div class="eyebrow">Story Album</div>
  <h2 style="margin-bottom:4px">{L.stories}</h2>
  {#if stories.length}
    {#each stories as x, i (i)}
      <div class="trophy"><span class="y">{x.year}</span><div><b>{tn(x.ending)}</b><span class="muted fs-xs">{tn(x.name)}</span></div></div>
    {/each}
  {:else}
    <p class="empty">{L.empty}</p>
  {/if}
</section>
