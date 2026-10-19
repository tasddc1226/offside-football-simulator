<script lang="ts">
  // 선수 유형 도감(T-11-355) — 선수 생성 · 시즌 탭 · 확률 도감이 같이 쓴다. 항목은 app-core positionGuide가 게임 정의에서 만든다.
  import { POS, type Pos } from '@offside/game/data';
  import { positionGuide } from '@offside/app-core/careerGuide';
  import { careerGuideText as L } from '@offside/app-core/i18n/ko/careerGuide';
  const { pos, open = false }: { pos: Pos; open?: boolean } = $props();
  let chosen = $state<Pos | null>(null);
  const current = $derived(chosen ?? pos);
  const entries = $derived(positionGuide(current));
</script>
<details class="position-guide" data-position-guide {open}>
  <summary class="disc-row">{L.guideTitle}<span class="disc-chev" aria-hidden="true"></span></summary>
  <div class="stack guide-body">
    <div class="guide-tabs" role="group" aria-label={L.guideTitle}>
      {#each ['FW', 'MF', 'DF', 'GK'] as p (p)}
        <button class="hof-sort" aria-pressed={current === p} onclick={() => chosen = p as Pos}>{POS[p as Pos].label}</button>
      {/each}
    </div>
    <p class="muted fs-sm">{L.guideNote}</p>
    {#each entries as e (e.id)}
      <article data-type-entry={e.id}>
        <b>{e.name}</b><p class="muted fs-sm">{e.desc}</p><p class="fs-sm">{L.focusLabel} · {e.focus}</p>
        {#if e.combos.length}<p class="fs-sm" data-type-combos>{L.combosLabel} · {e.combos.join(', ')}</p>{/if}
        {#if e.synergies.length}<p class="fs-sm" data-type-synergies>{L.synergyLabel} · {e.synergies.map((s) => L.synergyItem(s)).join(', ')}</p>{/if}
      </article>
    {/each}
    <p class="muted fs-sm">{L.synergyNote}</p>
  </div>
</details>
<style>
  .position-guide {border-top:1px solid var(--line);}
  .guide-body {padding:0 0 12px;gap:12px;}
  .guide-tabs {display:flex;flex-wrap:wrap;gap:8px;}
  .guide-tabs button {min-height:44px;}
  article {padding:10px;border:1px solid var(--line);border-radius:var(--radius-sm);}
  p {margin:4px 0 0;overflow-wrap:anywhere;}
</style>
