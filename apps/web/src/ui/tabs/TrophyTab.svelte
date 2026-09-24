<script lang="ts">
  // ui.ts trophyTab() 포트 (388~395줄)
  import type { GameState } from '../../game/types.js';

  const { s }: { s: GameState } = $props();
  const trophies = $derived(s.trophies.slice().reverse());
  const awards = $derived(s.awards.slice().reverse());
  const ballon = $derived((s.ballon || []).slice().reverse());
  const stories = $derived((s.storyLog || []).slice().reverse());
</script>

<section class="card">
  <div class="eyebrow">Team Honours</div>
  <h2 style="margin-bottom:4px">우승 연혁</h2>
  {#if trophies.length}
    {#each trophies as x, i (i)}
      <div class="trophy"><span class="y">{x.year}</span><div><b>{x.t}</b><span class="muted" style="font-size:12px">{x.club}</span></div></div>
    {/each}
  {:else}
    <p class="empty">아직 없습니다.</p>
  {/if}
</section>

<section class="card">
  <div class="eyebrow">Individual</div>
  <h2 style="margin-bottom:4px">개인 수상</h2>
  {#if awards.length}
    {#each awards as x, i (i)}
      <div class="trophy"><span class="y">{x.year}</span><div><b>{x.t}</b></div></div>
    {/each}
  {:else}
    <p class="empty">아직 없습니다.</p>
  {/if}
</section>

{#if ballon.length}
  <section class="card">
    <div class="eyebrow">Ballon d'Or</div>
    <h2 style="margin-bottom:4px">발롱도르 순위</h2>
    {#each ballon as b, i (i)}
      <div class="trophy"><span class="y">{b.year}</span><div><b>{b.rank === 1 ? '수상' : `${b.rank}위`}</b> <span class="muted" style="font-size:12px">30인 후보</span></div></div>
    {/each}
  </section>
{/if}

<section class="card">
  <div class="eyebrow">Story Album</div>
  <h2 style="margin-bottom:4px">완결된 스토리</h2>
  {#if stories.length}
    {#each stories as x, i (i)}
      <div class="trophy"><span class="y">{x.year}</span><div><b>{x.ending}</b><span class="muted" style="font-size:12px">{x.name}</span></div></div>
    {/each}
  {:else}
    <p class="empty">아직 없습니다.</p>
  {/if}
</section>
