<script lang="ts">
  import { POS, type Pos } from '@offside/game/data';
  import { positionGuide } from '@offside/app-core/careerGuide';
  import { careerGuideText as L } from '@offside/app-core/i18n/ko/careerGuide';
  const { pos }: { pos: Pos } = $props();
  let chosen = $state<Pos | null>(null);
  const current = $derived(chosen ?? pos);
  const entries = $derived(positionGuide(current));
</script>
<details class="position-guide" data-position-guide>
  <summary class="disc-row">{L.guideTitle}<span class="disc-chev" aria-hidden="true"></span></summary>
  <div class="stack guide-body">
    <div class="guide-tabs" role="group" aria-label={L.guideTitle}>
      {#each ['FW', 'MF', 'DF', 'GK'] as p (p)}
        <button class="hof-sort" aria-pressed={current === p} onclick={() => chosen = p as Pos}>{POS[p as Pos].label}</button>
      {/each}
    </div>
    <p class="muted fs-sm">{L.guideNote}</p>
    {#each entries as e (e.id)}
      <article><b>{e.name}</b><p class="muted fs-sm">{e.desc}</p><p class="fs-sm">{L.focusLabel} · {e.focus}</p></article>
    {/each}
  </div>
</details>
<style>
  .position-guide {border-top:1px solid var(--line);}
  .guide-body {padding:0 0 12px;gap:12px;}
  .guide-tabs {display:flex;flex-wrap:wrap;gap:8px;}
  .guide-tabs button {min-height:44px;}
  article {padding:10px;border:1px solid var(--line);border-radius:8px;}
  p {margin:4px 0 0;overflow-wrap:anywhere;}
</style>
